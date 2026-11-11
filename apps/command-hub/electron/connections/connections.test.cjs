// Tests for Connections, with a fake cipher, stubbed fetch and a stubbed
// Credential Manager. All accounts and tokens here are fictional.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { createConnections } = require('./index.cjs')
const { decodeBlob, validTarget } = require('./wincred.cjs')
const gcloud = require('./connectors/gcloud.cjs')._internal
const claude = require('./connectors/claude.cjs')._internal
const { SAFE_ARG } = require('./run.cjs')

const cipher = (available = true) => ({
  isAvailable: () => available,
  encrypt: (s) => `enc:${Buffer.from(s).toString('base64')}`,
  decrypt: (s) => {
    if (!s.startsWith('enc:')) throw new Error('bad')
    return Buffer.from(s.slice(4), 'base64').toString()
  },
})

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'connections-'))
}

function fakeFetch(calls, status = 200) {
  return async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization })
    return { status, ok: status < 300, statusText: 'x', json: async () => ({ displayName: 'Demo User' }) }
  }
}

test('atlassian direct token is stored encrypted and never listed', async () => {
  const dataDir = tmp()
  const calls = []
  const svc = createConnections({ dataDir, cipher: cipher(), deps: { fetch: fakeFetch(calls) } })
  const status = await svc.save({
    kind: 'atlassian',
    values: { siteUrl: 'demo-team.atlassian.net', tokenSource: 'direct', email: 'demo@example.com' },
    secrets: { token: 'tok-123' },
  })
  assert.equal(status.state, 'ok')
  assert.equal(calls[0].url, 'https://demo-team.atlassian.net/rest/api/3/myself')
  assert.equal(calls[0].auth, `Basic ${Buffer.from('demo@example.com:tok-123').toString('base64')}`)

  const raw = fs.readFileSync(path.join(dataDir, 'connections.json'), 'utf8')
  assert.ok(!raw.includes('tok-123'))
  const list = await svc.list()
  assert.ok(!JSON.stringify(list).includes('tok-123'))
  assert.deepEqual(list.connections[0].secretsSet, { token: true })

  // Saving again without a token keeps it.
  await svc.save({ kind: 'atlassian', values: { siteUrl: 'demo-team.atlassian.net', tokenSource: 'direct', email: 'demo@example.com' } })
  assert.deepEqual(await svc.getCredentials('atlassian'), { siteUrl: 'https://demo-team.atlassian.net', email: 'demo@example.com', token: 'tok-123' })
})

test('atlassian refuses to save a token without encryption', async () => {
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(false), deps: { fetch: fakeFetch([]) } })
  await assert.rejects(
    svc.save({ kind: 'atlassian', values: { siteUrl: 'x.atlassian.net', tokenSource: 'direct', email: 'a@example.com' }, secrets: { token: 't' } }),
    /encryption/,
  )
})

test('atlassian Credential Manager entry is read each time, not copied', async () => {
  const dataDir = tmp()
  const calls = []
  let secret = 'cm-token-1'
  const svc = createConnections({
    dataDir,
    cipher: cipher(),
    deps: {
      fetch: fakeFetch(calls),
      readCredential: async (target) => {
        assert.equal(target, 'atlassian-demo')
        return { userName: 'cm@example.com', secret }
      },
    },
  })
  const s = await svc.save({
    kind: 'atlassian',
    values: { siteUrl: 'https://demo.atlassian.net/jira', tokenSource: 'wincred', credentialTarget: 'atlassian-demo', email: '' },
    secrets: { token: 'should-be-dropped' },
  })
  assert.equal(s.state, 'ok')
  const raw = fs.readFileSync(path.join(dataDir, 'connections.json'), 'utf8')
  assert.ok(!raw.includes('cm-token') && !raw.includes('should-be-dropped'))
  secret = 'cm-token-2'
  const creds = await svc.getCredentials('atlassian')
  assert.deepEqual(creds, { siteUrl: 'https://demo.atlassian.net', email: 'cm@example.com', token: 'cm-token-2' })
})

test('atlassian 401 reads as expired, and validation catches missing fields', async () => {
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { fetch: fakeFetch([], 401) } })
  const s = await svc.save({ kind: 'atlassian', values: { siteUrl: 'd.atlassian.net', tokenSource: 'direct', email: 'a@example.com' }, secrets: { token: 'old' } })
  assert.equal(s.state, 'expired')
  await assert.rejects(svc.save({ kind: 'atlassian', values: { siteUrl: 'http://d.atlassian.net', tokenSource: 'direct', email: 'a@example.com' } }), /https/)
  await assert.rejects(svc.save({ kind: 'atlassian', values: { siteUrl: 'd.atlassian.net', tokenSource: 'wincred' } }), /Credential Manager/)
  await assert.rejects(svc.save({ kind: 'nope' }), /Unknown connector/)
})

test('remove forgets the connection', async () => {
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { fetch: fakeFetch([]) } })
  await svc.save({ kind: 'atlassian', values: { siteUrl: 'd.atlassian.net', tokenSource: 'direct', email: 'a@example.com' }, secrets: { token: 't' } })
  assert.equal(await svc.remove({ kind: 'atlassian' }), true)
  assert.equal((await svc.list()).connections.length, 0)
  await assert.rejects(svc.getCredentials('atlassian'), /Connections page/)
})

test('credential blobs decode as UTF-16LE or UTF-8', () => {
  assert.equal(decodeBlob(Buffer.from('abc-123', 'utf16le')), 'abc-123')
  assert.equal(decodeBlob(Buffer.from('abc-1234', 'utf8')), 'abc-1234')
  assert.equal(decodeBlob(Buffer.from('tok\0', 'utf16le')), 'tok')
  assert.equal(decodeBlob(Buffer.alloc(0)), '')
  assert.throws(() => validTarget(' '), /Enter/)
  assert.throws(() => validTarget('a\nb'), /not valid/)
})

test('gcloud status folds the checks', () => {
  const list = { stdout: JSON.stringify([{ account: 'demo@example.com', status: 'ACTIVE' }]) }
  const ok = { code: 0, stderr: '' }
  assert.equal(gcloud.summarize({ list: { notFound: true } }).state, 'unavailable')
  assert.equal(gcloud.summarize({ list, user: ok, adc: ok, project: 'demo-proj' }).state, 'ok')
  const expired = gcloud.summarize({ list, user: { code: 1, stderr: 'ERROR: Reauthentication failed. cannot prompt during non-interactive execution.' }, adc: ok })
  assert.equal(expired.state, 'expired')
  assert.equal(expired.details.find((d) => d.label === 'gcloud login').value, 'Expired')
  const noAdc = gcloud.summarize({ list, user: ok, adc: { code: 1, stderr: 'ERROR: Could not automatically determine credentials.' } })
  assert.equal(noAdc.state, 'expired')
  assert.equal(noAdc.details.find((d) => d.label === 'Application default credentials').value, 'Not set up')
  assert.equal(gcloud.summarize({ list: { stdout: '[]' }, user: { code: 1 }, adc: { code: 1, stderr: '' } }).state, 'needs-setup')
})

test('claude status reads the login without exposing tokens', () => {
  const now = Date.parse('2026-06-01T00:00:00Z')
  const config = { oauthAccount: { emailAddress: 'demo@example.com', organizationName: 'Demo Org' } }
  const ok = claude.summarize({ creds: { claudeAiOauth: { accessToken: 'a', refreshToken: 'r', expiresAt: 1, subscriptionType: 'max' } }, config, cli: '2.0.0', now })
  assert.equal(ok.state, 'ok')
  assert.ok(!JSON.stringify(ok).includes('"a"') && !JSON.stringify(ok).includes('"r"'))
  assert.equal(ok.details.find((d) => d.label === 'Plan').value, 'Claude Max')
  assert.equal(claude.summarize({ creds: { claudeAiOauth: { accessToken: 'a', expiresAt: now - 1 } }, cli: 'x', now }).state, 'expired')
  assert.equal(claude.summarize({ env: { ANTHROPIC_API_KEY: true }, now }).state, 'ok')
  assert.equal(claude.summarize({ cli: 'x', now }).state, 'needs-setup')
  assert.equal(claude.summarize({ now }).state, 'unavailable')
  const loc = claude.locations({ CLAUDE_CONFIG_DIR: '/cfg' }, '/home/demo')
  assert.equal(loc.credentials, path.join('/cfg', '.credentials.json'))
})

test('command arguments must be fixed tokens', () => {
  assert.ok(SAFE_ARG.test('application-default'))
  assert.ok(SAFE_ARG.test('--format=json'))
  assert.ok(!SAFE_ARG.test('a&b'))
  assert.ok(!SAFE_ARG.test('a b'))
})
