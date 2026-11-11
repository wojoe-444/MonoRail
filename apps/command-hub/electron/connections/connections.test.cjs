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

test('claude account type follows what Claude Code reports, and the override wins', () => {
  const type = (input) => claude.detectAccount(input).type
  // claude auth status --json
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'max' } }), 'subscription')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'team' } }), 'subscription')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: 'enterprise' } }), 'enterprise')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty', subscriptionType: null } }), 'unknown')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'api_key', apiProvider: 'firstParty', apiKeySource: '/login managed key' } }), 'api')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'api_key_helper', apiProvider: 'firstParty' } }), 'api')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'third_party', apiProvider: 'bedrock' } }), 'api')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' }, env: {} }), 'subscription')
  assert.equal(type({ auth: { loggedIn: true, authMethod: 'oauth_token', apiProvider: 'firstParty' }, env: { ANTHROPIC_AUTH_TOKEN: true } }), 'api')
  assert.equal(type({ auth: { loggedIn: false, authMethod: 'none', apiProvider: 'firstParty' } }), 'unknown')
  // Older CLI: files and environment.
  assert.equal(type({ creds: { claudeAiOauth: { refreshToken: 'r', subscriptionType: 'enterprise' } } }), 'enterprise')
  assert.equal(type({ creds: { claudeAiOauth: { refreshToken: 'r', subscriptionType: 'pro' } } }), 'subscription')
  assert.equal(type({ creds: { claudeAiOauth: { refreshToken: 'r', subscriptionType: 'max' } }, env: { ANTHROPIC_API_KEY: true } }), 'api', 'an API key in the environment wins for the SDK')
  assert.equal(type({ config: { primaryApiKey: 'x' } }), 'api')
  assert.equal(type({}), 'unknown')

  const now = Date.parse('2026-06-01T00:00:00Z')
  const creds = { claudeAiOauth: { accessToken: 'a', refreshToken: 'r', subscriptionType: 'enterprise' } }
  const detected = claude.summarize({ creds, now })
  assert.equal(detected.account.type, 'enterprise')
  assert.equal(detected.account.billedAtApiPrices, true)
  assert.equal(detected.account.source, 'detected')
  const overridden = claude.summarize({ creds, now, override: 'subscription' })
  assert.equal(overridden.account.type, 'subscription')
  assert.equal(overridden.account.detected, 'enterprise')
  assert.equal(overridden.account.source, 'override')
  assert.equal(overridden.account.billedAtApiPrices, false)
  assert.equal(claude.summarize({ creds, now, override: 'auto' }).account.source, 'detected')
  assert.equal(claude.summarize({ creds, now, override: 'nonsense' }).account.type, 'enterprise')
  assert.ok(!JSON.stringify(overridden).includes('"a"') && !JSON.stringify(overridden).includes('"r"'))

  // A Console login with no credentials file is still signed in.
  assert.equal(claude.summarize({ auth: { loggedIn: true, authMethod: 'api_key', apiProvider: 'firstParty' }, cli: 'x', now }).state, 'ok')

  assert.equal(claude.parseAuthStatus({ code: 1, stdout: '{"loggedIn":false,"authMethod":"none"}' }).loggedIn, false)
  assert.equal(claude.parseAuthStatus({ code: 1, stdout: "error: unknown command 'auth'" }), undefined)
  assert.equal(claude.parseAuthStatus({ notFound: true, stdout: '' }), undefined)
})

test('the Claude account override is a saved setting and reaches the summary file', async () => {
  const dataDir = path.join(tmp(), 'modules', 'connections')
  const svc = createConnections({ dataDir, cipher: cipher() })
  await svc.save({ kind: 'claude', values: { accountType: 'enterprise' } })
  const account = await svc.claudeAccount()
  assert.equal(account.type, 'enterprise')
  assert.equal(account.source, 'override')
  assert.equal((await svc.list()).connections.find((c) => c.kind === 'claude').values.accountType, 'enterprise')
  await new Promise((r) => setTimeout(r, 50))
  const cacheLib = require('../cache/index.cjs')
  const summary = (await cacheLib.readSummaries(path.dirname(path.dirname(dataDir))))['connections.summary']
  assert.deepEqual(summary.summary.connections.claude.account, { type: 'enterprise', source: 'override', billedAtApiPrices: true })
})

test('command arguments must be fixed tokens', () => {
  assert.ok(SAFE_ARG.test('application-default'))
  assert.ok(SAFE_ARG.test('--format=json'))
  assert.ok(!SAFE_ARG.test('a&b'))
  assert.ok(!SAFE_ARG.test('a b'))
})

test('checks are reused until forced or the connection changes', async () => {
  const { KeyedCache } = require('../cache/keyed.cjs')
  let now = 0
  const checks = new KeyedCache('connections.sign-in', { now: () => now })
  const calls = []
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { fetch: fakeFetch(calls) }, checks })
  await svc.save({ kind: 'atlassian', values: { siteUrl: 'd.atlassian.net', tokenSource: 'direct', email: 'a@example.com' }, secrets: { token: 't' } })
  assert.equal(calls.length, 1)
  await svc.check('atlassian')
  assert.equal(calls.length, 1, 'reused within 15 minutes')
  await svc.check('atlassian', { force: true })
  assert.equal(calls.length, 2, 'Check button forces')
  now += 16 * 60_000
  await svc.check('atlassian')
  assert.equal(calls.length, 3, 'stale after 15 minutes')
  await svc.save({ kind: 'atlassian', values: { siteUrl: 'e.atlassian.net', tokenSource: 'direct', email: 'a@example.com' } })
  assert.equal(calls.at(-1).url, 'https://e.atlassian.net/rest/api/3/myself')
})

// ---------- pi ----------

const pi = require('./connectors/pi.cjs')._internal
const gitc = require('./connectors/git.cjs')._internal
const fakePiSdk = () => ({ name: '@earendil-works/pi-coding-agent', version: '1.5.2', dir: '/x', entry: '/x/dist/index.js' })

test('pi: saving writes scoped models into pi settings and keeps the rest', async () => {
  const piAgentDir = tmp()
  const settingsFile = path.join(piAgentDir, 'settings.json')
  fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'dark', enabledModels: ['openai/*'] }))
  fs.writeFileSync(path.join(piAgentDir, 'auth.json'), JSON.stringify({ anthropic: { type: 'oauth', access: 'secret-access', refresh: 'secret-refresh' } }))
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { piAgentDir, findPiSdk: fakePiSdk } })

  const s = await svc.save({ kind: 'pi', values: { scopedModels: pi.DEFAULT_SCOPED_MODELS.join(', ') } })
  const written = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  assert.deepEqual(written, { theme: 'dark', enabledModels: pi.DEFAULT_SCOPED_MODELS })
  assert.equal(s.state, 'ok')
  assert.match(s.summary, /3 scoped models/)
  assert.ok(!JSON.stringify(s).includes('secret-'), 'never returns pi credentials')
  assert.ok(!fs.existsSync(`${settingsFile}.lock`), 'releases the lock')

  // /scoped-models changed it in pi: the check says so, Apply puts it back.
  fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'dark', enabledModels: ['anthropic/claude-opus-5-5'] }))
  const drift = await svc.check('pi', { force: true })
  assert.equal(drift.state, 'error')
  await svc.runAction({ kind: 'pi', action: 'apply-scoped-models' })
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')).enabledModels, pi.DEFAULT_SCOPED_MODELS)

  // An empty list means all models: the key is removed.
  await svc.save({ kind: 'pi', values: { scopedModels: '' } })
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile, 'utf8')), { theme: 'dark' })
})

test('pi: refuses odd patterns and unreadable settings, waits for pi lock', async () => {
  assert.deepEqual(pi.parsePatterns('a/b,  c/d\nc/d '), ['a/b', 'c/d'])
  assert.throws(() => pi.validatePatterns(['anthropic/x; rm -rf']), /not a model pattern/)
  assert.doesNotThrow(() => pi.validatePatterns(['anthropic/*sonnet*:high', 'openai/gpt-5.5']))
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { piAgentDir: tmp(), findPiSdk: fakePiSdk } })
  await assert.rejects(svc.save({ kind: 'pi', values: { scopedModels: 'bad"model' } }), /not a model pattern/)

  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'settings.json'), '{ not json')
  await assert.rejects(pi.applyScopedModels(dir, ['a/b']))
  assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), '{ not json', 'leaves a broken file alone')

  // A fresh lock held by pi: wait, then give up with a readable message.
  const dir2 = tmp()
  fs.mkdirSync(path.join(dir2, 'settings.json.lock'))
  await assert.rejects(pi.withPiLock(path.join(dir2, 'settings.json'), async () => {}, { attempts: 2, delayMs: 5 }), /busy/)
  // A stale one (older than 10 s) is taken over.
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(path.join(dir2, 'settings.json.lock'), old, old)
  assert.equal(await pi.applyScopedModels(dir2, ['a/b']), true)
})

test('pi: status when missing or not signed in', () => {
  assert.equal(pi.summarize({ sdk: undefined, settings: {} }).state, 'unavailable')
  const s = pi.summarize({ sdk: { name: '@mariozechner/pi-coding-agent', version: '0.9.0' }, settings: {}, providers: [] })
  assert.equal(s.state, 'needs-setup')
  assert.match(s.details[0].value, /old package name/)
})

// ---------- git ----------

test('git: version, identity and credential helper', () => {
  const ok = (stdout) => ({ code: 0, stdout, stderr: '' })
  const unset = { code: 1, stdout: '', stderr: '' }
  assert.equal(gitc.summarize({ version: { code: -1, stdout: '', stderr: '', notFound: true } }).state, 'unavailable')

  const s = gitc.summarize({ version: ok('git version 2.47.1.windows.1\n'), name: ok('Sam Demo\n'), email: ok('sam@example.com\n'), helpers: ok('manager\n') })
  assert.equal(s.state, 'ok')
  assert.equal(s.details.find((d) => d.label === 'Credential helper').value, 'Git Credential Manager')

  const n = gitc.summarize({ version: ok('git version 2.45.0\n'), name: unset, email: ok('sam@example.com\n'), helpers: unset })
  assert.equal(n.state, 'needs-setup')
  assert.match(n.summary, /user\.name is not set/)
  assert.equal(n.details.find((d) => d.label === 'Credential helper').ok, false)

  // An empty entry resets the list, as git does; paths show their name only.
  assert.deepEqual(gitc.parseHelpers('store\n\nC:/Program Files/Git/mingw64/bin/git-credential-manager.exe\n').map(gitc.helperName), ['manager'])
  assert.equal(gitc.helperName('!f() { echo secret; }; f'), 'custom script')
})

test('git: status runs only fixed, safe arguments and never asks for credentials', async () => {
  const calls = []
  const runTool = async (cmd, args) => {
    calls.push([cmd, ...args])
    return { code: 0, stdout: args[0] === '--version' ? 'git version 2.47.1' : 'x', stderr: '' }
  }
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { runTool } })
  const s = await svc.save({ kind: 'git' })
  assert.equal(s.state, 'ok')
  for (const c of calls) {
    for (const a of c) assert.match(a, SAFE_ARG)
    assert.ok(!c.includes('credential') && !c.includes('fill'))
  }
})

test('pi: scoped list is shown grouped by provider', () => {
  assert.equal(pi.shortList(['anthropic/a', 'openai/b', 'anthropic/c', '*sonnet*']), 'anthropic: a, c; openai: b; *sonnet*')
})

// ---------- pi > Playwright browser ----------

const pw = require('./connectors/pi-playwright.cjs')._internal

/** A pi agent dir with pi-playwright installed the way `pi install npm:pi-playwright` leaves it. */
function fakePiWithPlaywright({ listed = true, cli = true } = {}) {
  const dir = tmp()
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ enabledModels: ['a/b'], ...(listed ? { packages: ['npm:pi-playwright@^0.1.2'] } : {}) }))
  const pkg = path.join(dir, 'npm', 'node_modules', 'pi-playwright')
  fs.mkdirSync(path.join(pkg, 'skills', 'playwright-browser', 'scripts'), { recursive: true })
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'pi-playwright', version: '0.1.2' }))
  fs.writeFileSync(path.join(pkg, 'skills', 'playwright-browser', 'scripts', 'pw.js'), '')
  if (cli) {
    const c = path.join(dir, 'npm', 'node_modules', '@playwright', 'cli')
    fs.mkdirSync(c, { recursive: true })
    fs.writeFileSync(path.join(c, 'package.json'), JSON.stringify({ name: '@playwright/cli', version: '0.1.24', bin: { 'playwright-cli': 'playwright-cli.js' } }))
    fs.writeFileSync(path.join(c, 'playwright-cli.js'), '')
  }
  return dir
}

/** A browser user data folder; `ext` lists profiles that have the extension, `prefs` ones that only list it in Preferences. */
function fakeBrowser({ profiles = ['Default', 'Profile 1'], ext = [], prefs = [], lastUsed } = {}) {
  const dir = tmp()
  for (const p of profiles) fs.mkdirSync(path.join(dir, p), { recursive: true })
  for (const p of ext) fs.mkdirSync(path.join(dir, p, 'Extensions', pw.EXTENSION_ID, '1.0.0'), { recursive: true })
  for (const p of prefs) {
    fs.writeFileSync(path.join(dir, p, 'Secure Preferences'), JSON.stringify({ extensions: { settings: { [pw.EXTENSION_ID]: { state: 1 } } }, account_info: [{ email: 'private@example.com' }] }))
  }
  if (lastUsed) fs.writeFileSync(path.join(dir, 'Local State'), JSON.stringify({ profile: { last_used: lastUsed, info_cache: { [lastUsed]: { name: 'Private Name' } } } }))
  return dir
}

test('pi playwright: is a subconnector of pi', async () => {
  const svc = createConnections({ dataDir: tmp(), cipher: cipher() })
  const { connectors } = await svc.list()
  const c = connectors.find((x) => x.kind === 'pi-playwright')
  assert.equal(c.parent, 'pi')
  assert.ok(connectors.findIndex((x) => x.kind === 'pi') < connectors.indexOf(c))
})

test('pi playwright: finds the extension per profile, last used first, names only', async () => {
  const b = fakeBrowser({ profiles: ['Default', 'Profile 1', 'Profile 2', 'System Profile'], ext: ['Default'], prefs: ['Profile 2'], lastUsed: 'Profile 2' })
  const found = await pw.findExtensionProfiles(b)
  assert.deepEqual(found.withExtension, ['Profile 2', 'Default'])
  assert.ok(!JSON.stringify(found).includes('Private') && !JSON.stringify(found).includes('private@'), 'drops everything but folder names')
  assert.equal((await pw.findExtensionProfiles(path.join(b, 'nope'))).found, false)
  assert.match(pw.userDataDir('chrome', { platform: 'win32', env: { LOCALAPPDATA: 'C:\\L' }, home: 'C:\\H' }), /Google.Chrome.User Data$/)
  assert.match(pw.userDataDir('msedge', { platform: 'darwin', env: {}, home: '/Users/x' }), /Application Support.Microsoft Edge$/)
})

test('pi playwright: recognises how pi lists the package', () => {
  const d = '/agent'
  assert.equal(pw.matchSource('npm:pi-playwright', d).type, 'npm')
  assert.equal(pw.matchSource('npm:pi-playwright@0.1.2', d).dir, path.join(d, 'npm', 'node_modules', 'pi-playwright'))
  assert.equal(pw.matchSource('npm:pi-playwright-extra', d), undefined)
  assert.equal(pw.matchSource('git:github.com/guwidoe/pi-playwright@v0.1.2', d).dir, path.join(d, 'git', 'github.com', 'guwidoe', 'pi-playwright'))
  assert.equal(pw.matchSource('https://github.com/guwidoe/pi-playwright.git', d).type, 'git')
  assert.equal(pw.matchSource('../src/pi-playwright', d).type, 'local')
})

test('pi playwright: status walks through install, extension and ready', async () => {
  const base = { findPiSdk: fakePiSdk, env: {} }
  const status = (deps, conn) => require('./connectors/pi-playwright.cjs').status(conn, { ...base, ...deps })

  assert.equal((await status({ findPiSdk: () => undefined, piAgentDir: tmp(), browserDataDir: () => fakeBrowser() })).state, 'unavailable')

  const missing = await status({ piAgentDir: tmp(), browserDataDir: () => fakeBrowser({ ext: ['Default'] }) })
  assert.equal(missing.state, 'needs-setup')
  assert.deepEqual(missing.actions, ['install-skill'])

  const piDir = fakePiWithPlaywright()
  const noExt = await status({ piAgentDir: piDir, browserDataDir: () => fakeBrowser() })
  assert.equal(noExt.state, 'needs-setup')
  assert.deepEqual(noExt.actions, ['open-extension-page'])

  const ready = await status({ piAgentDir: piDir, browserDataDir: () => fakeBrowser({ ext: ['Profile 1'] }) })
  assert.equal(ready.state, 'ok')
  assert.equal(ready.details.find((d) => d.label === 'Playwright Extension').value, 'Installed in Profile 1')
  assert.equal(ready.details.find((d) => d.label === 'Playwright CLI').value, '0.1.24')

  // A chosen profile without the extension says where it is instead.
  const wrong = await status({ piAgentDir: piDir, browserDataDir: () => fakeBrowser({ ext: ['Profile 1'] }) }, { values: { profile: 'Default' } })
  assert.equal(wrong.state, 'needs-setup')
  assert.match(wrong.details.find((d) => d.label === 'Playwright Extension').value, /found in Profile 1/)

  // The extension token: only whether it is set, never its value.
  const token = await status({ piAgentDir: piDir, env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: 'secret-token-value' }, browserDataDir: () => fakeBrowser({ ext: ['Default'] }) })
  assert.match(token.details.find((d) => d.label === 'Tab prompt').value, /Skipped/)
  assert.ok(!JSON.stringify(token).includes('secret-token-value'))

  // Installed folder without a settings entry: pi would not load it.
  assert.equal((await status({ piAgentDir: fakePiWithPlaywright({ listed: false }), browserDataDir: () => fakeBrowser({ ext: ['Default'] }) })).state, 'needs-setup')
  assert.equal((await status({ piAgentDir: fakePiWithPlaywright({ cli: false }), browserDataDir: () => fakeBrowser({ ext: ['Default'] }) })).state, 'error')
})

test('pi playwright: saving writes the skill, off or remove takes it away, never a foreign one', async () => {
  const piAgentDir = fakePiWithPlaywright()
  const browser = fakeBrowser({ ext: ['Default'] })
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps: { piAgentDir, findPiSdk: fakePiSdk, env: {}, browserDataDir: () => browser } })
  const file = path.join(piAgentDir, 'skills', pw.SKILL_NAME, 'SKILL.md')

  const s = await svc.save({ kind: 'pi-playwright', values: { browser: 'msedge', profile: 'Profile 1', teachPi: 'yes' } })
  const text = fs.readFileSync(file, 'utf8')
  assert.match(text, /^---\nname: use-my-browser\ndescription: /)
  assert.match(text, /PLAYWRIGHT_MCP_PROFILE_DIR_NAME="Profile 1" node ".*pw\.js" attach --extension=msedge/)
  assert.ok(text.includes(pw.SKILL_MARKER))
  assert.ok(!text.includes('\\'), 'forward slashes only')
  assert.equal(s.details.find((d) => d.label === 'Skill for pi').value, 'use-my-browser: up to date')
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(piAgentDir, 'settings.json'), 'utf8')).enabledModels, ['a/b'], "pi's settings are left alone")

  await svc.save({ kind: 'pi-playwright', values: { browser: 'chrome', teachPi: 'no' } })
  assert.ok(!fs.existsSync(file))
  await svc.save({ kind: 'pi-playwright', values: { browser: 'chrome', teachPi: 'yes' } })
  assert.ok(fs.existsSync(file))
  await svc.remove({ kind: 'pi-playwright' })
  assert.ok(!fs.existsSync(file), 'removed with the connection')

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '---\nname: use-my-browser\ndescription: mine\n---\n')
  await assert.rejects(svc.save({ kind: 'pi-playwright', values: { browser: 'chrome', teachPi: 'yes' } }), /did not write/)
  assert.match(fs.readFileSync(file, 'utf8'), /description: mine/)
  await svc.remove({ kind: 'pi-playwright' })
  assert.ok(fs.existsSync(file), 'a foreign skill survives removal')

  await assert.rejects(svc.save({ kind: 'pi-playwright', values: { browser: 'firefox' } }), /Chrome or Microsoft Edge/)
  await assert.rejects(svc.save({ kind: 'pi-playwright', values: { profile: 'x"; rm -rf' } }), /profile folder/)
})

test('pi playwright: test attaches with the extension and detaches, passing the env through', async () => {
  const piAgentDir = fakePiWithPlaywright()
  const browser = fakeBrowser({ ext: ['Default'] })
  const calls = []
  const { EventEmitter } = require('node:events')
  const spawnFake = (code) => (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts.env, shell: opts.shell })
    const child = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    setImmediate(() => {
      if (args.includes('attach') && code) child.stderr.emit('data', 'Error: Playwright Extension not found in "x".\n')
      child.emit('close', args.includes('attach') ? code : 0)
    })
    return child
  }
  const deps = { piAgentDir, findPiSdk: fakePiSdk, env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: 't0k' }, browserDataDir: () => browser, nodeExecutable: '/node', spawn: spawnFake(0) }
  const svc = createConnections({ dataDir: tmp(), cipher: cipher(), deps })
  await svc.save({ kind: 'pi-playwright', values: { browser: 'chrome', profile: 'Default', teachPi: 'no' } })
  await svc.runAction({ kind: 'pi-playwright', action: 'test-attach' })
  await new Promise((r) => setTimeout(r, 50))
  const job = svc.getJob({ kind: 'pi-playwright' })
  assert.equal(job.state, 'done', job.error)
  assert.match(job.note, /Connected/)
  assert.deepEqual(calls.map((c) => c.args.slice(1)), [['-s=monorail-check', 'attach', '--extension=chrome'], ['-s=monorail-check', 'detach']])
  assert.equal(calls[0].shell, false)
  assert.equal(calls[0].env.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(calls[0].env.PLAYWRIGHT_MCP_PROFILE_DIR_NAME, 'Default')
  assert.equal(calls[0].env.PLAYWRIGHT_MCP_EXTENSION_TOKEN, 't0k', 'passed through untouched')
  assert.ok(!JSON.stringify(job).includes('t0k'))

  deps.spawn = spawnFake(1)
  calls.length = 0
  await svc.runAction({ kind: 'pi-playwright', action: 'test-attach' })
  await new Promise((r) => setTimeout(r, 50))
  const failed = svc.getJob({ kind: 'pi-playwright' })
  assert.equal(failed.state, 'failed')
  assert.match(failed.error, /Playwright Extension not found/)
  assert.equal(calls.length, 2, 'detaches even after a failure')
})
