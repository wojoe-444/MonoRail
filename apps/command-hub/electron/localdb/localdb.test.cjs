const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { openDatabase, fqnOf, DB_FILE, SCHEMA_VERSION } = require('./index.cjs')
const om = require('../modules/openmetadata.cjs')
const { createStore } = require('../modules/ingestion-store.cjs')
const { DATA_FILES } = require('../cache/declared.cjs')
const { SCOPES } = require('../profiles/index.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-localdb-'))
const NO_BIGQUERY = { isSetUp: async () => false }

describe('local database', () => {
  test('is declared: profile scope and its files', () => {
    assert.equal(SCOPES.databases, 'profile')
    assert.ok(DATA_FILES.databases.includes(DB_FILE))
  })

  test("entities get OpenMetadata's id, full name and versions; only real changes make a version", () => {
    const db = openDatabase(tmp())
    const a = db.put('glossary', { name: 'Business', description: 'Words we use' }, { now: 1000 })
    assert.match(a.id, /^[0-9a-f-]{36}$/)
    assert.equal(a.fullyQualifiedName, 'Business')
    assert.equal(a.version, 0.1)
    assert.equal(db.put('glossary', { ...a, updatedAt: 5 }).version, 0.1, 'bookkeeping fields are not a change')
    const b = db.put('glossary', { name: 'Business', description: 'Words the team uses' }, { now: 2000 })
    assert.equal(b.id, a.id, 'matched by full name')
    assert.equal(b.version, 0.2)
    assert.deepEqual(db.versions(a.id).map((v) => [v.version, v.description]), [[0.2, 'Words the team uses'], [0.1, 'Words we use']])
    // Same content in another key order is not a change.
    assert.equal(db.put('glossary', { description: 'Words the team uses', name: 'Business' }).version, 0.2)
  })

  test('lists page by full name, count and hide deleted ones, and recent has entityType', () => {
    const db = openDatabase(tmp())
    for (let i = 0; i < 5; i++) db.put('tag', { name: `t${i}`, fullyQualifiedName: fqnOf('PII', `t${i}`), deleted: i === 4 })
    const first = db.list('tag', { limit: 2 })
    assert.equal(first.paging.total, 4)
    assert.deepEqual(first.data.map((e) => e.name), ['t0', 't1'])
    const second = db.list('tag', { limit: 2, after: first.paging.after })
    assert.deepEqual(second.data.map((e) => e.name), ['t2', 't3'])
    assert.equal(second.paging.after, undefined)
    assert.equal(db.list('tag', { deleted: true }).paging.total, 5)
    assert.deepEqual(db.counts(), { tag: 4 })
    assert.equal(db.recent(1)[0].entityType, 'tag')
    assert.equal(fqnOf('svc', 'a.b'), 'svc."a.b"')
  })

  test('a damaged file or a newer schema is refused and left as it is', () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, DB_FILE), 'this is not sqlite '.repeat(200))
    assert.throws(() => openDatabase(dir), /damaged/)
    assert.match(fs.readFileSync(path.join(dir, DB_FILE), 'utf8'), /^this is not sqlite/)

    const dir2 = tmp()
    openDatabase(dir2).close()
    const { DatabaseSync } = require('node:sqlite')
    const raw = new DatabaseSync(path.join(dir2, DB_FILE))
    raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    raw.close()
    assert.throws(() => openDatabase(dir2), /newer version/)
  })

  test('records keep the newest ones', () => {
    const db = openDatabase(tmp())
    for (let i = 0; i < 5; i++) db.putRecord('pipelineStatus', 'p', `r${i}`, i, { i })
    db.pruneRecords('pipelineStatus', 'p', 3)
    assert.deepEqual(db.records('pipelineStatus', 'p').map((r) => r.i), [4, 3, 2])
  })
})

describe('OpenMetadata page on the local database', () => {
  test('is the default until a server is connected, and edits make a version', async () => {
    const db = openDatabase(tmp())
    const t = db.put('table', { name: 'notes', fullyQualifiedName: 'local_sqlite.main.main.notes', columns: [] })
    db.putRecord('tableProfile', t.id, '1', 1, { timestamp: 1, rowCount: 3 })
    const fetch = async () => assert.fail('no request may be made')
    const svc = om._internal.createService({ fetch, isSetUp: async () => false, local: () => db, bigquery: NO_BIGQUERY })
    const status = await svc.status()
    assert.equal(status.source, 'local')
    assert.equal(status.serverSetUp, false)
    assert.equal(status.block, undefined)
    const counts = await svc.counts()
    assert.equal(counts.table, 1)
    assert.equal(counts.glossary, 0)
    assert.equal((await svc.list({ type: 'table' })).data[0].name, 'notes')
    const got = await svc.get({ type: 'table', fqn: 'local_sqlite.main.main.notes' })
    assert.equal(got.profile.rowCount, 3, 'latest profile attached')
    const edited = await svc.setDescription({ type: 'table', id: t.id, description: 'Field notes' })
    assert.equal(edited.version, 0.2)
    assert.equal((await svc.versions({ type: 'table', id: t.id })).length, 2)
    await assert.rejects(svc.setDescription({ type: 'database', id: t.id, description: 'x' }), /not in the local database/)
    await assert.rejects(svc.list({ type: 'nope' }), /no entity type/)
  })

  test('with a server connected, the server is the default and local is still there on request', async () => {
    const db = openDatabase(tmp())
    let requests = 0
    const fetch = async () => {
      requests++
      return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ data: [], paging: { total: 0 } }) }
    }
    const svc = om._internal.createService({ fetch, isSetUp: async () => true, credentials: async () => ({ url: 'http://localhost:8585', auth: 'token', token: 't' }), local: () => db, bigquery: NO_BIGQUERY })
    await svc.list({ type: 'table' })
    assert.equal(requests, 1)
    assert.equal((await svc.status({ source: 'local' })).source, 'local')
    await svc.list({ type: 'table', source: 'local' })
    assert.equal(requests, 1)
  })
})

describe('ingestion data in the local database', () => {
  test('older JSON files are copied in once and left as they are', async () => {
    const dir = tmp()
    const pipelines = { version: 1, pipelines: [{ id: '6f1d3c2a-0000-4000-8000-000000000001', name: 'notes_metadata', pipelineType: 'metadata', service: { type: 'databaseService', name: 'local_sqlite' }, extension: { monorail: { runner: 'this-pc', serviceKind: 'sqlite' } } }] }
    const runs = { version: 1, runs: { '6f1d3c2a-0000-4000-8000-000000000001': [{ runId: 'r1', pipelineState: 'success', startDate: 5 }] }, scheduled: { '6f1d3c2a-0000-4000-8000-000000000001': '2026-11-18T10:00:00.000Z' } }
    const catalog = { version: 1, services: { local_sqlite: { serviceType: 'SQLite', databases: [{ name: 'main', schemas: [{ name: 'main', tables: [{ name: 'notes', tableType: 'Regular', columns: [{ name: 'id', dataType: 'INTEGER' }] }] }] }] } } }
    fs.writeFileSync(path.join(dir, 'pipelines.json'), JSON.stringify(pipelines))
    fs.writeFileSync(path.join(dir, 'runs.json'), JSON.stringify(runs))
    fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify(catalog))
    const before = fs.readFileSync(path.join(dir, 'pipelines.json'), 'utf8')
    const db = openDatabase(tmp())
    const store = createStore({ db, legacyDir: dir })
    const [p] = await store.pipelines()
    assert.equal(p.fullyQualifiedName, 'local_sqlite.notes_metadata')
    const r = await store.runsFile()
    assert.equal(r.runs[p.id][0].runId, 'r1')
    assert.equal(r.scheduled[p.id], '2026-11-18T10:00:00.000Z')
    const c = await store.catalog()
    assert.equal(c.services.local_sqlite.databases[0].schemas[0].tables[0].columns[0].dataType, 'INTEGER')
    assert.equal(db.get('table', 'local_sqlite.main.main.notes').columns[0].fullyQualifiedName, 'local_sqlite.main.main.notes.id')
    assert.equal(fs.readFileSync(path.join(dir, 'pipelines.json'), 'utf8'), before)
    // Deleting it in the database does not bring it back from the old file.
    await store.updatePipelines((list) => list.splice(0, 1))
    assert.deepEqual(await createStore({ db, legacyDir: dir }).pipelines(), [])
  })
})
