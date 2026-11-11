const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const mime = require('./mime.cjs')
const oauth = require('./oauth.cjs')
const { createStore } = require('./store.cjs')
const gmail = require('./connectors/gmail.cjs')
const { describeConnectors } = require('./connectors/index.cjs')

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64url')

test('buildMessage writes headers, encodes non-ASCII and strips header injection', () => {
  const raw = mime.buildMessage(
    { from: 'me@example.com', to: 'Ana Pérez <ana@example.com>, bo@example.org', subject: 'Café\r\nBcc: evil@x.com', body: 'Hi\nthere' },
    { date: new Date('2026-01-02T03:04:05Z') },
  )
  const [head, body] = raw.split('\r\n\r\n')
  assert.match(head, /^From: me@example.com$/m)
  assert.match(head, /^To: =\?UTF-8\?B\?[^?]+\?= <ana@example.com>, bo@example.org$/m)
  assert.match(head, /^Subject: =\?UTF-8\?B\?/m)
  assert.doesNotMatch(head, /^Bcc:/m)
  assert.equal(mime.decodeHeaderText(/^Subject: (.*)$/m.exec(head)[1]), 'Café Bcc: evil@x.com')
  assert.equal(Buffer.from(body, 'base64').toString('utf8'), 'Hi\r\nthere')
})

test('buildMessage rejects missing and invalid recipients', () => {
  assert.throws(() => mime.buildMessage({ subject: 'x' }), /at least one recipient/)
  assert.throws(() => mime.buildMessage({ to: 'not an address' }), /not an email address/)
})

test('address helpers', () => {
  assert.deepEqual(mime.splitAddresses('"Doe, Jane" <j@x.com>; k@y.com,'), ['"Doe, Jane" <j@x.com>', 'k@y.com'])
  assert.equal(mime.nameOf('"Doe, Jane" <j@x.com>'), 'Doe, Jane')
  assert.equal(mime.addressOf('Jane <J@X.com>'), 'j@x.com')
  assert.equal(mime.replySubject('RE: hi'), 'RE: hi')
  assert.equal(mime.replySubject('hi'), 'Re: hi')
})

test('extractBodies picks text, html and attachments from a MIME tree', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64url('plain ✓') } },
          { mimeType: 'text/html', body: { data: b64url('<p>html</p>') } },
        ],
      },
      { mimeType: 'application/pdf', filename: 'a.pdf', body: { attachmentId: 'att1', size: 10 } },
    ],
  }
  assert.deepEqual(mime.extractBodies(payload), {
    text: 'plain ✓',
    html: '<p>html</p>',
    attachments: [{ id: 'att1', filename: 'a.pdf', mimeType: 'application/pdf', size: 10 }],
  })
})

test('PKCE challenge is the S256 of the verifier', () => {
  const p = oauth.createPkce()
  assert.ok(p.verifier.length >= 43 && p.verifier.length <= 128)
  assert.equal(p.challenge, crypto.createHash('sha256').update(p.verifier).digest('base64url'))
})

test('loopback accepts only the matching state and closes after the code', async () => {
  const lb = await oauth.startLoopback()
  assert.match(lb.redirectUri, /^http:\/\/127\.0\.0\.1:\d+$/)
  const code = lb.waitForCode('good', 5000)
  const wrong = await fetch(`${lb.redirectUri}/?code=x&state=bad`)
  assert.equal(wrong.status, 400)
  const ok = await fetch(`${lb.redirectUri}/?code=the-code&state=good`)
  assert.equal(ok.status, 200)
  assert.equal(await code, 'the-code')
  await assert.rejects(fetch(`${lb.redirectUri}/?code=y&state=good`))
})

test('loopback rejects on provider error and on close', async () => {
  const lb = await oauth.startLoopback()
  const p = assert.rejects(lb.waitForCode('s', 5000), /cancelled/)
  await fetch(`${lb.redirectUri}/?error=access_denied&state=s`)
  await p
  const lb2 = await oauth.startLoopback()
  const p2 = lb2.waitForCode('s', 5000)
  lb2.close()
  await assert.rejects(p2, /cancelled/)
})

const fakeCipher = { isAvailable: () => true, encrypt: (s) => `enc:${Buffer.from(s).toString('base64')}`, decrypt: (s) => Buffer.from(s.slice(4), 'base64').toString() }

test('store encrypts secrets and credentials and never lists them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-store-'))
  const store = createStore(dir, fakeCipher)
  const fields = gmail.configFields
  await store.saveConfig('gmail', fields, { values: { clientId: ' id.apps.googleusercontent.com ', clientSecret: 'GOCSPX-secret' } })
  const raw = fs.readFileSync(path.join(dir, 'config.json'), 'utf8')
  assert.doesNotMatch(raw, /GOCSPX-secret/)
  assert.deepEqual(await store.describeConfig('gmail'), { values: { clientId: 'id.apps.googleusercontent.com' }, secretsSet: { clientSecret: true } })
  // An empty secret keeps the stored one; clearSecrets removes it.
  await store.saveConfig('gmail', fields, { values: { clientId: 'id.apps.googleusercontent.com', clientSecret: '' } })
  assert.equal((await store.getConfig('gmail')).secrets.clientSecret, 'GOCSPX-secret')
  await store.saveConfig('gmail', fields, { values: { clientId: 'id.apps.googleusercontent.com' }, clearSecrets: ['clientSecret'] })
  assert.deepEqual((await store.getConfig('gmail')).secrets, {})

  const a = await store.upsertAccount({ kind: 'gmail', address: 'me@example.com', name: 'me' }, { refreshToken: 'rt-1' })
  assert.equal(a.credentials, undefined)
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'), /rt-1/)
  const again = await store.upsertAccount({ kind: 'gmail', address: 'ME@example.com', name: 'me' }, { refreshToken: 'rt-2' })
  assert.equal(again.id, a.id)
  assert.equal((await store.listAccounts()).length, 1)
  assert.deepEqual(await store.getCredentials(a.id), { refreshToken: 'rt-2' })
  await store.removeAccount(a.id)
  assert.deepEqual(await store.listAccounts(), [])
})

test('store refuses to save secrets without encryption', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-store-'))
  const store = createStore(dir, { ...fakeCipher, isAvailable: () => false })
  await assert.rejects(store.saveConfig('gmail', gmail.configFields, { values: { clientSecret: 'x' } }), /will not store/)
})

/** A tiny fake of the token endpoint and the Gmail API. */
function fakeGoogle() {
  const calls = []
  const sent = []
  let tokenCount = 0
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const msg = (id, from, subject, labels, extra = {}) => ({
    id,
    threadId: 't1',
    labelIds: labels,
    snippet: 'Hello &amp; welcome',
    internalDate: String(Date.parse('2026-03-01T10:00:00Z')),
    payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }, ...(extra.headers ?? [])], body: { data: b64url('Body text') } },
  })
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url)
    calls.push(`${init.method ?? 'GET'} ${u.pathname}`)
    if (u.host === 'oauth2.googleapis.com') {
      const form = new URLSearchParams(init.body)
      if (form.get('refresh_token') === 'dead') return json(400, { error: 'invalid_grant' })
      tokenCount++
      return json(200, { access_token: `at-${tokenCount}`, expires_in: 3600 })
    }
    const auth = init.headers?.Authorization
    if (auth === 'Bearer stale') return json(401, { error: { message: 'expired' } })
    const p = u.pathname.replace('/gmail/v1/users/me', '')
    if (p === '/profile') return json(200, { emailAddress: 'me@example.com' })
    if (p === '/labels') return json(200, { labels: [{ id: 'INBOX', type: 'system' }, { id: 'SENT', type: 'system' }, { id: 'Label_2', name: 'Zeta', type: 'user' }, { id: 'Label_1', name: 'Alpha', type: 'user' }] })
    if (p === '/labels/INBOX') return json(200, { id: 'INBOX', threadsUnread: 3 })
    if (p === '/threads') return json(200, { threads: [{ id: 't1' }], nextPageToken: 'next', resultSizeEstimate: 1 })
    if (p === '/threads/t1') return json(200, { id: 't1', messages: [msg('m1', 'Ana <ana@example.com>', 'Plans', ['INBOX']), msg('m2', 'Bo <bo@example.com>', 'Re: Plans', ['INBOX', 'UNREAD'])] })
    if (p === '/threads/t1/modify') return json(200, { id: 't1', messages: [{ labelIds: ['Label_1'] }], body: JSON.parse(init.body) })
    if (p === '/messages/m2') return json(200, msg('m2', 'Bo <bo@example.com>', 'Re: Plans', [], { headers: [{ name: 'Message-ID', value: '<m2@mail>' }, { name: 'References', value: '<m1@mail>' }] }))
    if (p === '/messages/send') {
      sent.push(JSON.parse(init.body))
      return json(200, { id: 'new', threadId: 't1' })
    }
    return json(404, { error: { message: `no route ${p}` } })
  }
  return { fetchImpl, calls, sent }
}

const config = { clientId: 'x.apps.googleusercontent.com', clientSecret: 's' }

test('gmail session lists folders and thread summaries', async () => {
  const g = fakeGoogle()
  const s = gmail.createSession({ fetch: g.fetchImpl }, { config, credentials: { refreshToken: 'rt' } })
  const folders = await s.listFolders()
  assert.deepEqual(
    folders.map((f) => [f.id, f.kind, f.unread]),
    [
      ['INBOX', 'system', 3],
      ['SENT', 'system', undefined],
      ['Label_1', 'user', undefined],
      ['Label_2', 'user', undefined],
    ],
  )
  const { threads, nextPageToken } = await s.listThreads({ folderId: 'INBOX', query: 'from:ana' })
  assert.equal(nextPageToken, 'next')
  assert.equal(threads[0].subject, 'Plans')
  assert.equal(threads[0].messageCount, 2)
  assert.equal(threads[0].unread, true)
  assert.equal(threads[0].snippet, 'Hello & welcome')
  assert.deepEqual(threads[0].participants, ['Ana', 'Bo'])
  // One token refresh served every call.
  assert.equal(g.calls.filter((c) => c.includes('/token')).length, 1)
})

test('gmail session refreshes after a 401 and reports a dead refresh token as reauth', async () => {
  const g = fakeGoogle()
  const s = gmail.createSession({ fetch: g.fetchImpl }, { config, credentials: { refreshToken: 'rt' }, accessToken: { token: 'stale', expiresAt: Date.now() + 3600_000 } })
  const t = await s.getThread('t1')
  assert.equal(t.messages[1].text, 'Body text')
  assert.equal(t.messages[1].unread, true)
  const dead = gmail.createSession({ fetch: g.fetchImpl }, { config, credentials: { refreshToken: 'dead' } })
  await assert.rejects(dead.listFolders(), (e) => e.code === 'reauth')
})

test('gmail replies thread with In-Reply-To and References from the original', async () => {
  const g = fakeGoogle()
  const s = gmail.createSession({ fetch: g.fetchImpl }, { config, credentials: { refreshToken: 'rt' } })
  await s.send({ to: 'bo@example.com', subject: 'Re: Plans', body: 'Sounds good', replyTo: { messageId: 'm2' } })
  assert.equal(g.sent[0].threadId, 't1')
  const raw = Buffer.from(g.sent[0].raw, 'base64url').toString('utf8')
  assert.match(raw, /^From: me@example.com\r$/m)
  assert.match(raw, /^In-Reply-To: <m2@mail>\r$/m)
  assert.match(raw, /^References: <m1@mail> <m2@mail>\r$/m)
})

test('gmail modifyThread only passes labels a user may set', async () => {
  const g = fakeGoogle()
  let body
  const s = gmail.createSession(
    { fetch: async (url, init) => ((body = init?.body && url.includes('/modify') ? JSON.parse(init.body) : body), g.fetchImpl(url, init)) },
    { config, credentials: { refreshToken: 'rt' } },
  )
  await s.modifyThread('t1', { add: ['Label_1', 'SENT', 'STARRED'], remove: ['INBOX', 'DRAFT'] })
  assert.deepEqual(body, { addLabelIds: ['Label_1', 'STARRED'], removeLabelIds: ['INBOX'] })
})

test('gmail config requires a desktop OAuth client id', () => {
  assert.throws(() => gmail.createSession({ fetch }, { config: { clientId: 'nope' }, credentials: {} }), /client ID/)
})

test('connector descriptions carry no functions or secrets', () => {
  const [g] = describeConnectors()
  assert.equal(g.kind, 'gmail')
  assert.deepEqual(
    g.configFields.map((f) => [f.key, f.secret]),
    [
      ['clientId', false],
      ['clientSecret', true],
    ],
  )
  assert.equal(JSON.stringify(describeConnectors()).includes('function'), false)
})
