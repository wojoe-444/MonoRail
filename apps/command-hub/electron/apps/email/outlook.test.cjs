const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const outlook = require('./connectors/outlook.cjs')
const { assertWritable, describeConnectors } = require('./connectors/index.cjs')
const { runJsonHelper } = require('./helper.cjs')
const { mergeSearch } = require('./search.cjs')
const { createStore } = require('./store.cjs')

const { encodeId, decodeId, daslFilter, dedupe, describeStores } = outlook._internal

const fakeCipher = { isAvailable: () => true, encrypt: (s) => Buffer.from(s).toString('base64'), decrypt: (s) => Buffer.from(s, 'base64').toString() }

/** env.powershell stand-in: records calls, answers from a table of ops. */
function fakeEnv(answers) {
  const calls = []
  return {
    calls,
    env: {
      powershell: async (script, args, opts) => {
        assert.match(script, /GetActiveObject\('Outlook\.Application'\)/)
        calls.push({ args, opts })
        const a = answers[args.op]
        if (a instanceof Error) throw a
        return typeof a === 'function' ? a(args) : a
      },
    },
  }
}
const err = (code, message = code) => Object.assign(new Error(message), { code })

test('message ids round-trip and reject junk', () => {
  const id = encodeId({ entryId: '00000000ABCDEF', messageId: '<a@b.example>' })
  assert.deepEqual(decodeId(id), { entryId: '00000000ABCDEF', messageId: '<a@b.example>' })
  assert.throws(() => decodeId('not base64 json'), /not valid/)
  // An EntryID is hex; anything else is dropped.
  assert.deepEqual(decodeId(Buffer.from(JSON.stringify({ e: 'x"; Remove-Item', m: '<m@x>' })).toString('base64url')), { entryId: '', messageId: '<m@x>' })
})

test('DASL filter ANDs words, escapes quotes and adds unread', () => {
  assert.equal(daslFilter({}), '')
  const f = daslFilter({ query: "o'brien report", unreadOnly: true })
  assert.match(f, /^@SQL=\(/)
  assert.match(f, /like '%o''brien%'/)
  assert.match(f, /like '%report%'/)
  assert.match(f, / AND "urn:schemas:httpmail:read" = 0$/)
  assert.equal(f.split(') AND (').length, 2)
  assert.doesNotMatch(daslFilter({ query: '100%' }), /100%%/)
})

test('dedupe keeps the first of each internet message id', () => {
  const out = dedupe([
    { entryId: 'A', messageId: '<1@x>' },
    { entryId: 'B', messageId: '<1@X>' },
    { entryId: 'C', messageId: '' },
    { entryId: 'C', messageId: '' },
  ])
  assert.deepEqual(
    out.map((x) => x.entryId),
    ['A', 'C'],
  )
})

test('discover marks shared stores and reports Outlook not running', async () => {
  const stores = describeStores([
    { storeId: 'S1', name: 'Pat (fictional)', address: 'pat@example.com', exchangeType: 0 },
    { storeId: 'S2', name: 'Team Reports', address: null, exchangeType: 4 },
    { storeId: 'S3', name: 'Old archive', exchangeType: 3, isDataFile: true },
  ])
  assert.deepEqual(
    stores.map((s) => [s.key, s.shared, s.kindLabel, s.address]),
    [
      ['S1', false, 'Mailbox', 'pat@example.com'],
      ['S2', true, 'Shared mailbox', ''],
      ['S3', false, 'Data file', ''],
    ],
  )
  assert.equal(outlook.accountFromStore(stores[1]).readOnly, true)
  assert.equal(outlook.accountFromStore(stores[1], { readOnly: false }).readOnly, false)

  const down = fakeEnv({ discover: err('not-running', 'Outlook is not running.') })
  assert.deepEqual(await outlook.discover(down.env), { status: 'not-running', message: 'Outlook is not running.', stores: [] })
  assert.equal((await outlook.discover({})).status, 'unavailable')
})

test('session passes store, skip list and filters to the helper and maps results', async () => {
  const f = fakeEnv({
    folders: { folders: [{ id: 'INBOX', name: 'Inbox', path: 'Inbox', role: 'inbox', depth: 0, unread: 3 }, { id: 'Inbox\\Reports', name: 'Reports', path: 'Inbox\\Reports', parentId: 'INBOX', depth: 1 }], timedOut: false },
    list: {
      items: [
        { entryId: 'E1', messageId: '<1@x>', subject: 'Weekly numbers', from: 'Sam Lee <sam@example.com>', date: '2026-11-10T10:00:00.000Z', unread: true, flagged: true, attachments: 1, folderId: 'INBOX' },
        { entryId: 'E2', messageId: '<1@x>', subject: 'Weekly numbers', from: 'Sam Lee <sam@example.com>', date: '2026-11-10T10:00:00.000Z', folderId: 'INBOX' },
      ],
      more: true,
    },
  })
  const s = outlook.createSession(f.env, { account: { key: 'STORE-1', settings: { skipFolders: ['Inbox\\Noise'] } } })
  const folders = await s.listFolders()
  assert.deepEqual(
    folders.folders.map((x) => [x.id, x.kind, x.parentId]),
    [
      ['INBOX', 'system', null],
      ['Inbox\\Reports', 'user', 'INBOX'],
    ],
  )
  const page = await s.listThreads({ folderId: 'Inbox\\Reports', query: 'numbers', daysBack: 7, unreadOnly: true })
  const call = f.calls.at(-1).args
  assert.equal(call.storeId, 'STORE-1')
  assert.deepEqual(call.skip, ['Inbox\\Noise'])
  assert.equal(call.folderId, 'Inbox\\Reports')
  assert.equal(call.daysBack, 7)
  assert.match(call.filter, /numbers/)
  assert.equal(call.allFolders, false)
  assert.equal(page.threads.length, 1, 'deduplicated by internet message id')
  assert.deepEqual(page.threads[0].labelIds, ['INBOX', 'UNREAD', 'STARRED'])
  assert.equal(page.threads[0].hasAttachments, true)
  assert.equal(page.threads[0].dedupeKey, '<1@x>')
  assert.equal(page.nextPageToken, '25')
  assert.deepEqual(decodeId(page.threads[0].id), { entryId: 'E1', messageId: '<1@x>' })
})

test('full-store search is opt-in, gets a longer limit and reports stopping early', async () => {
  const f = fakeEnv({ list: { items: [], more: false, timedOut: true, foldersSearched: 4, foldersTotal: 30 } })
  const s = outlook.createSession(f.env, { account: { key: 'S' } })
  await s.listThreads({ query: 'x' })
  assert.equal(f.calls[0].args.allFolders, false)
  const page = await s.listThreads({ query: 'x', allFolders: true })
  assert.equal(f.calls[1].args.allFolders, true)
  assert.equal(f.calls[1].args.deadlineMs, outlook._internal.FULL_STORE_MS)
  assert.ok(f.calls[1].opts.timeoutMs > outlook._internal.FULL_STORE_MS)
  assert.equal(page.timedOut, true)
  assert.match(page.partial, /4 of 30 folders/)
  // Without a query there is nothing to search everywhere for.
  await s.listThreads({ allFolders: true })
  assert.equal(f.calls[2].args.allFolders, false)
})

test('a moved message comes back with its new id', async () => {
  const f = fakeEnv({ get: { entryId: 'BEEF02', messageId: '<m@x>', subject: 'Hi', from: 'a@example.com', text: 'body', moved: true, folderId: 'Archive', attachmentList: [{ id: 1, filename: 'a.pdf', size: 5 }] } })
  const s = outlook.createSession(f.env, { account: { key: 'S' } })
  const t = await s.getThread(encodeId({ entryId: 'ABCD01', messageId: '<m@x>' }))
  assert.equal(f.calls[0].args.entryId, 'ABCD01')
  assert.equal(f.calls[0].args.messageId, '<m@x>')
  assert.ok(f.calls[0].args.lookupMs > 0)
  assert.equal(t.moved, true)
  assert.deepEqual(decodeId(t.id), { entryId: 'BEEF02', messageId: '<m@x>' })
  assert.equal(t.messages[0].attachments[0].filename, 'a.pdf')
})

test('helper errors become codes the page understands', async () => {
  const s = outlook.createSession(fakeEnv({ list: err('timeout', 'No answer after 45 s.'), get: err('not-running', 'Outlook is not running.') }).env, { account: { key: 'S' } })
  await assert.rejects(s.listThreads({}), (e) => e.code === 'timeout' && /did not answer in time/.test(e.message))
  await assert.rejects(s.getThread(encodeId({ entryId: 'AA' })), (e) => e.code === 'not-running')
})

test('read-only accounts refuse write methods', () => {
  const ro = { name: 'Team Reports', readOnly: true }
  for (const m of ['send', 'archive', 'markRead', 'modifyThread', 'createFolder']) assert.throws(() => assertWritable(ro, m), (e) => e.code === 'read-only')
  for (const m of ['listThreads', 'getThread', 'listFolders']) assert.doesNotThrow(() => assertWritable(ro, m))
  assert.doesNotThrow(() => assertWritable({ readOnly: false }, 'send'))
})

test('store keys Outlook accounts by store id, without credentials, with settings', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-store-'))
  const store = createStore(dir, { ...fakeCipher, isAvailable: () => false })
  // No credentials, so no encryption needed.
  const a = await store.upsertAccount({ kind: 'outlook', key: 'STORE-1', name: 'Team Reports', address: '', readOnly: true }, null)
  const b = await store.upsertAccount({ kind: 'outlook', key: 'STORE-2', name: 'Team Reports', address: '' }, null)
  assert.notEqual(a.id, b.id, 'same name, different store')
  const again = await store.upsertAccount({ kind: 'outlook', key: 'STORE-1', name: 'Team Reports (renamed)' }, null)
  assert.equal(again.id, a.id)
  assert.equal(again.readOnly, true, 'adding again keeps the setting')
  assert.equal(await store.getCredentials(a.id), null)
  const u = await store.updateAccount(a.id, { readOnly: false, skipFolders: [' \\Inbox\\Noise\\ ', 'Inbox\\Noise', 7] })
  assert.equal(u.readOnly, false)
  assert.deepEqual(u.settings.skipFolders, ['Inbox\\Noise'])
  assert.equal((await store.listAccounts()).length, 2)
})

test('searchAccounts merge: newest first, deduped across accounts, errors kept apart', () => {
  const r = mergeSearch([
    { accountId: 'a', page: { threads: [{ id: '1', date: '2026-11-01T00:00:00Z', dedupeKey: '<x@y>' }, { id: '2', date: '2026-11-05T00:00:00Z' }] } },
    { accountId: 'b', page: { threads: [{ id: '3', date: '2026-11-03T00:00:00Z', dedupeKey: '<X@y>' }], partial: 'Stopped after 60 s' } },
    { accountId: 'c', error: '[not-running] Outlook is not running.' },
  ])
  assert.deepEqual(
    r.threads.map((t) => [t.id, t.accountId, t.alsoIn]),
    [
      ['2', 'a', []],
      ['1', 'a', ['b']],
    ],
  )
  assert.deepEqual(r.errors, [{ accountId: 'c', error: '[not-running] Outlook is not running.' }])
  assert.deepEqual(r.partial, [{ accountId: 'b', message: 'Stopped after 60 s' }])
})

test('hidden helper: args arrive as data, JSON answer, error codes, hard timeout', async () => {
  const node = process.execPath
  const echo = `let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(Buffer.from(process.env.MONORAIL_ARGS,'base64'));process.stdout.write(JSON.stringify({ok:true,result:{script:s,a,hasSecret:!!process.env.MONORAIL_TEST_SECRET}}))})`
  process.env.MONORAIL_TEST_SECRET = 'x'
  const r = await runJsonHelper({ command: node, commandArgs: ['-e', echo], stdin: 'SCRIPT', args: { q: "'; rm -rf / #" }, timeoutMs: 10_000 })
  delete process.env.MONORAIL_TEST_SECRET
  assert.deepEqual(r, { script: 'SCRIPT', a: { q: "'; rm -rf / #" }, hasSecret: false })

  const fail = `process.stdout.write(JSON.stringify({ok:false,code:'not-running',message:'Outlook is not running.'}))`
  await assert.rejects(runJsonHelper({ command: node, commandArgs: ['-e', fail], timeoutMs: 10_000 }), (e) => e.code === 'not-running')
  await assert.rejects(runJsonHelper({ command: node, commandArgs: ['-e', 'process.stdout.write("junk")'], timeoutMs: 10_000 }), (e) => e.code === 'helper')
  const t0 = Date.now()
  await assert.rejects(runJsonHelper({ command: node, commandArgs: ['-e', 'setTimeout(()=>{},60000)'], timeoutMs: 300 }), (e) => e.code === 'timeout')
  assert.ok(Date.now() - t0 < 5000)
  await assert.rejects(runJsonHelper({ command: 'monorail-no-such-program', commandArgs: [], timeoutMs: 1000 }), (e) => e.code === 'unavailable')
})

test('the helper script never reads Namespace.CurrentUser and never starts Outlook', () => {
  const ps = fs.readFileSync(path.join(__dirname, 'connectors', 'outlook.ps1'), 'utf8')
  const code = ps
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n')
  assert.doesNotMatch(code, /CurrentUser/)
  assert.doesNotMatch(code, /New-Object\s+-ComObject/i)
  assert.doesNotMatch(code, /Invoke-Expression|iex\b/i, 'arguments are data, never code')
  assert.match(code, /GetActiveObject/)
  assert.ok([...ps].every((c) => c.charCodeAt(0) < 128), 'ASCII only (read from stdin in the console code page)')
})

test('both connectors are described with their setup style', () => {
  const d = describeConnectors()
  assert.deepEqual(
    d.map((c) => [c.kind, c.setup, c.capabilities.folderTree]),
    [
      ['gmail', 'oauth', false],
      ['outlook', 'discover', true],
    ],
  )
})

test('on Windows, the real helper runs hidden and reports Outlook not running', { skip: process.platform !== 'win32' }, async (t) => {
  const { runPowerShell } = require('./helper.cjs')
  const script = fs.readFileSync(path.join(__dirname, 'connectors', 'outlook.ps1'), 'utf8')
  // The whole script is parsed before it runs, so a syntax error anywhere fails here.
  try {
    const r = await runPowerShell(script, { op: 'discover' }, { timeoutMs: 60_000 })
    t.diagnostic(`Outlook is running here: ${r.stores.length} stores`)
  } catch (e) {
    assert.equal(e.code, 'not-running', e.message)
  }
  await assert.rejects(runPowerShell(script, { op: 'nope', storeId: "x'; exit" }, { timeoutMs: 60_000 }), (e) => ['not-running', 'bad-request'].includes(e.code))
})
