const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { openDatabase } = require('./index.cjs')
const mirror = require('./bigquery-mirror.cjs')
const { createBigQuerySource } = require('../modules/openmetadata-bigquery.cjs')
const om = require('../modules/openmetadata.cjs')
const connector = require('../connections/connectors/bigquery-metadata.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-bqmirror-'))
const CONFIG = mirror.configOf({ project: 'chicago-transit', dataset: 'METADATA' })
const T0 = Date.parse('2026-11-01T00:00:00Z')
const MIN = 60_000

const FIELDS = {
  entity: [['id', 'STRING'], ['type', 'STRING'], ['fqn', 'STRING'], ['name', 'STRING'], ['version', 'FLOAT'], ['updated_at', 'TIMESTAMP'], ['deleted', 'BOOLEAN'], ['json', 'JSON']],
  entity_version: [['id', 'STRING'], ['version', 'FLOAT'], ['updated_at', 'TIMESTAMP'], ['json', 'JSON']],
  record: [['kind', 'STRING'], ['owner', 'STRING'], ['key', 'STRING'], ['at', 'TIMESTAMP'], ['json', 'JSON']],
  meta: [['key', 'STRING'], ['value', 'STRING']],
}
const TIME = { entity: 'updated_at', entity_version: 'updated_at', record: 'at' }

const ent = (n, { at = T0, version = 0.1, deleted = false, type = 'table', desc } = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  type,
  fqn: `svc.db.sch.t${n}`,
  name: `t${n}`,
  version,
  updated_at: at,
  deleted,
  json: JSON.stringify({ name: `t${n}`, description: desc ?? `Table ${n}`, owners: [{ type: 'user', name: 'ada' }], columns: [{ name: 'id', dataType: 'STRING' }] }),
})

/**
 * An in-memory BigQuery with the client methods the sync uses. Every query
 * is recorded; queries understand only the sync's own time filter.
 */
function fakeBigQuery({ tables = {}, missing = false, bytesPerQuery = 1000, partitioned = true, numRows } = {}) {
  const data = { meta: [{ key: 'layout', value: mirror.LAYOUT }], entity: [], ...tables }
  const queries = []
  const listed = []
  const schema = (name) => (FIELDS[name] ?? [['x', 'STRING']]).map(([n, type]) => ({ name: n, type, mode: 'NULLABLE' }))
  const cell = (name, col, v) => (v === null || v === undefined ? null : TIME[name] === col ? String(v * 1000) : String(v))
  const client = {
    data,
    queries,
    listed,
    async getDataset() {
      if (missing) throw Object.assign(new Error('Not found: Dataset'), { status: 404 })
      return { location: 'US' }
    },
    async listTables() {
      return { tables: Object.keys(data).map((id) => ({ id })) }
    },
    async getTable({ tableId }) {
      return { fields: schema(tableId), numRows: tableId === 'entity' && numRows !== undefined ? numRows : data[tableId].length, numBytes: 100, partitionField: partitioned ? TIME[tableId] : undefined, streamingRows: 0 }
    },
    async listTableData({ tableId, selectedFields, maxResults = 1000, pageToken }) {
      listed.push(tableId)
      const cols = selectedFields ?? schema(tableId).map((f) => f.name)
      const start = Number(pageToken ?? 0)
      const page = data[tableId].slice(start, start + maxResults)
      return { rows: page.map((r) => ({ f: cols.map((c) => ({ v: cell(tableId, c, r[c]) })) })), pageToken: start + maxResults < data[tableId].length ? String(start + maxResults) : undefined }
    },
    async runQuery({ query, dryRun, projectId }) {
      queries.push({ query, dryRun, projectId })
      if (dryRun) return { totalBytesProcessed: bytesPerQuery, rows: [], fields: [] }
      const table = /\.(\w+)`/.exec(query)[1]
      const since = Number(/TIMESTAMP_MILLIS\((-?\d+)\)/.exec(query)[1])
      const rows = data[table].filter((r) => r[TIME[table]] >= since)
      const out = {
        entity: (r) => ({ id: r.id, type: r.type, fqn: r.fqn, name: r.name, version: r.version, updated_ms: String(r.updated_at), deleted: !!r.deleted, json: r.json }),
        entity_version: (r) => ({ id: r.id, version: r.version, updated_ms: String(r.updated_at), json: r.json }),
        record: (r) => ({ kind: r.kind, owner: r.owner, key: r.key, at_ms: String(r.at), json: r.json }),
      }[table]
      const objs = rows.map(out)
      const names = objs.length ? Object.keys(objs[0]) : []
      return { jobComplete: true, job: { projectId, jobId: 'j1', location: 'US' }, fields: names.map((name) => ({ name })), rows: objs.map((o) => names.map((n) => o[n])), totalBytesProcessed: bytesPerQuery }
    },
    async getQueryResults() {
      throw new Error('not used')
    },
  }
  return client
}

describe('BigQuery metadata copy', () => {
  test('the connection: project required, dataset defaults to METADATA, billing to the data project', () => {
    assert.throws(() => mirror.configOf({}), /project id/)
    const c = mirror.configOf({ project: 'chicago-transit' })
    assert.equal(c.datasetId, 'METADATA')
    assert.equal(c.billingProject, 'chicago-transit')
    assert.equal(c.source, 'chicago-transit.METADATA')
    assert.equal(c.everyMs, 60 * MIN)
    assert.equal(c.maxBytes, 1024 ** 3)
    assert.throws(() => mirror.configOf({ project: 'chicago-transit', dataset: 'bad`name' }), /dataset name/)
    assert.equal(mirror.configOf({ project: 'chicago-transit', billingProject: 'my-billing', syncEvery: 'manual' }).billingProject, 'my-billing')
    assert.equal(mirror.configOf({ project: 'chicago-transit', syncEvery: 'manual' }).everyMs, null)
    assert.throws(() => connector.validate({ values: { project: '' } }), /project id/)
  })

  test('inspecting the dataset tells missing, empty, foreign, mismatched, unmarked, newer and ok apart, with no query', async () => {
    const run = async (opts) => {
      const c = fakeBigQuery(opts)
      if (opts?.drop) for (const t of opts.drop) delete c.data[t]
      const r = await mirror.inspectDataset(c, CONFIG)
      assert.equal(c.queries.length, 0)
      return r.state
    }
    assert.equal(await run({ missing: true }), 'missing')
    assert.equal(await run({ drop: ['meta', 'entity'] }), 'empty')
    assert.equal(await run({ drop: ['meta', 'entity'], tables: { trips: [] } }), 'foreign')
    assert.equal(await run({ tables: { meta: [{ key: 'other', value: 'x' }] } }), 'foreign')
    assert.equal(await run({ tables: { meta: [{ key: 'layout', value: 'monorail.metadata/9' }] } }), 'newer')
    assert.equal(await run({}), 'ok')
    const c = fakeBigQuery()
    const getTable = c.getTable
    c.getTable = async (a) => ({ ...(await getTable(a)), fields: a.tableId === 'entity' ? [{ name: 'id', type: 'INTEGER' }] : (await getTable(a)).fields })
    const r = await mirror.inspectDataset(c, CONFIG)
    assert.equal(r.state, 'mismatch')
    assert.match(r.message, /entity\.id is INTEGER, expected STRING/)
  })

  test('the first sync downloads everything with tabledata.list (no query), keeping BigQuery ids, versions and times', async () => {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    const older = { ...ent(2, { at: T0 - 10 * MIN, desc: 'old' }) }
    const c = fakeBigQuery({
      tables: {
        entity: [ent(1), older, ent(2, { at: T0, version: 0.3 }), { ...ent(3), json: 'not json' }],
        entity_version: [{ id: ent(2).id, version: 0.2, updated_at: T0 - 10 * MIN, json: ent(2).json }],
        record: [{ kind: 'tableProfile', owner: ent(1).id, key: 'p1', at: T0, json: JSON.stringify({ rowCount: 12 }) }],
      },
    })
    const r = await mirror.syncMirror({ client: c, store, config: CONFIG })
    assert.equal(r.mode, 'full')
    assert.equal(r.reason, 'first')
    assert.equal(c.queries.length, 0, 'a full copy runs no query')
    assert.equal(r.skipped, 1)
    const t2 = store.get('table', 'svc.db.sch.t2')
    assert.equal(t2.id, ent(2).id)
    assert.equal(t2.version, 0.3, 'the newest duplicate wins and its version is kept, not bumped')
    assert.equal(t2.updatedAt, T0)
    assert.deepEqual(t2.owners, [{ type: 'user', name: 'ada' }])
    assert.equal(store.versions(ent(2).id).length, 1)
    assert.deepEqual(store.records('tableProfile', ent(1).id), [{ rowCount: 12 }])
    assert.equal(store.getMeta('bq.watermark.entity'), String(T0))
    assert.equal(store.getMeta('bq.source'), 'chicago-transit.METADATA')
  })

  test('later syncs query only what changed (less 10 minutes), and only ever SELECT', async () => {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    const c = fakeBigQuery({ tables: { entity: [ent(1, { at: T0 - 20 * MIN }), ent(2)] } })
    await mirror.syncMirror({ client: c, store, config: CONFIG })
    c.data.entity = [ent(1, { at: T0 - 20 * MIN }), ent(2, { at: T0 + 30 * MIN, version: 0.2, desc: 'Changed in BigQuery' }), ent(4, { at: T0 + 31 * MIN })]
    const r = await mirror.syncMirror({ client: c, store, config: CONFIG })
    assert.equal(r.mode, 'incremental')
    assert.equal(r.entities, 2, 'only the changed and the new row came down (t1 is older than the 10-minute overlap)')
    assert.equal(store.get('table', 'svc.db.sch.t2').description, 'Changed in BigQuery')
    assert.ok(store.get('table', 'svc.db.sch.t4'))
    const sql = c.queries.find((q) => !q.dryRun).query
    assert.match(sql, new RegExp(`TIMESTAMP_MILLIS\\(${T0 - mirror.OVERLAP_MS}\\)`))
    assert.match(sql, /FROM `chicago-transit\.METADATA\.entity`/)
    for (const q of c.queries) assert.match(q.query, /^SELECT /, 'the sync never writes to BigQuery')
    assert.ok(c.queries.filter((q) => q.dryRun).length >= 1, 'every query is dry-run first')
    assert.equal(store.getMeta('bq.watermark.entity'), String(T0 + 31 * MIN))
  })

  test('entities removed from BigQuery leave the copy', async () => {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    const c = fakeBigQuery({ tables: { entity: [ent(1), ent(2), ent(3)] } })
    await mirror.syncMirror({ client: c, store, config: CONFIG })
    c.data.entity = [ent(1), ent(3)]
    const r = await mirror.syncMirror({ client: c, store, config: CONFIG })
    assert.equal(r.removed, 1)
    assert.equal(store.get('table', 'svc.db.sch.t2'), undefined)
    assert.ok(c.listed.includes('entity'))
    // A full refresh drops them too.
    c.data.entity = [ent(1)]
    const f = await mirror.syncMirror({ client: c, store, config: CONFIG, full: true })
    assert.equal(f.mode, 'full')
    assert.equal(f.removed, 1)
    assert.equal(store.countAll(), 1)
  })

  test('a sync that would scan more than the limit runs nothing and says why', async () => {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    const c = fakeBigQuery({ tables: { entity: [ent(1)] }, partitioned: false })
    await mirror.syncMirror({ client: c, store, config: CONFIG })
    c.data.entity = [ent(1, { at: T0 + MIN, version: 0.2, desc: 'new' })]
    const before = c.queries.length
    const big = fakeBigQuery({ tables: { entity: c.data.entity }, bytesPerQuery: 5 * 1024 ** 3, partitioned: false })
    await assert.rejects(mirror.syncMirror({ client: big, store, config: CONFIG }), (e) => e.code === 'over-cap' && /Partitioning/.test(e.message))
    assert.ok(big.queries.every((q) => q.dryRun), 'only dry runs, nothing billed')
    assert.equal(store.get('table', 'svc.db.sch.t1').description, 'Table 1')
    assert.equal(c.queries.length, before)
  })

  test('a different project or dataset empties the copy first', async () => {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    await mirror.syncMirror({ client: fakeBigQuery({ tables: { entity: [ent(1), ent(2)] } }), store, config: CONFIG })
    const other = mirror.configOf({ project: 'chicago-transit', dataset: 'OTHER' })
    const r = await mirror.syncMirror({ client: fakeBigQuery({ tables: { entity: [ent(7)] } }), store, config: other })
    assert.equal(r.mode, 'full')
    assert.equal(store.countAll(), 1)
    assert.ok(store.get('table', 'svc.db.sch.t7'))
  })

  test('the setup SQL creates the layout and marks it; the sync code holds no write statement', () => {
    const sql = mirror.setupSql('chicago-transit', 'METADATA')
    for (const t of ['entity', 'entity_version', 'record', 'meta']) assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS \`chicago-transit\\.METADATA\\.${t}\``))
    assert.match(sql, /PARTITION BY DATE\(updated_at\)/)
    assert.match(sql, new RegExp(`'layout', '${mirror.LAYOUT.replace(/[./]/g, '\\$&')}'`))
    // Only setupSql (text for the user) may contain write statements.
    const src = fs.readFileSync(path.join(__dirname, 'bigquery-mirror.cjs'), 'utf8')
    const body = src.slice(0, src.indexOf('function setupSql')) + src.slice(src.indexOf('const layoutVersion'))
    assert.doesNotMatch(body, /\b(INSERT INTO|UPDATE `|DELETE FROM `|MERGE |DROP |TRUNCATE |CREATE TABLE)\b/)
  })
})

describe('BigQuery as the OpenMetadata page source', () => {
  function setup({ setUp = true, values = { project: 'chicago-transit' }, client = fakeBigQuery({ tables: { entity: [ent(1), ent(2)] } }), now } = {}) {
    const store = openDatabase(tmp(), { file: 'bigquery.sqlite3' })
    const state = { setUp }
    const connections = { hasConnection: async (k) => (k === 'bigquery-metadata' ? state.setUp : false), getCredentials: async () => mirror.configOf(values) }
    const bq = createBigQuerySource({ connections, mirror: () => store, client, now })
    return { store, state, bq, client }
  }

  test('it is the default once set up, reads the copy, and refuses writes', async () => {
    const { bq, state } = setup()
    const local = openDatabase(tmp())
    local.put('table', { name: 'mine', fullyQualifiedName: 'pc.db.sch.mine' })
    const svc = om._internal.createService({ isSetUp: async () => false, local: () => local, bigquery: bq })
    await bq.sync()
    const s = await svc.status()
    assert.equal(s.source, 'bigquery')
    assert.equal(s.bigquerySetUp, true)
    assert.equal(s.bigquery.synced, true)
    assert.equal(s.url, 'BigQuery chicago-transit.METADATA')
    assert.equal((await svc.counts({ types: ['table'] })).table, 2)
    assert.equal((await svc.counts({ source: 'local', types: ['table'] })).table, 1, 'This PC is still there on request')
    const t1 = await svc.get({ type: 'table', fqn: 'svc.db.sch.t1' })
    await assert.rejects(svc.setDescription({ type: 'table', id: t1.id, description: 'x' }), /source of truth/)
    state.setUp = false
    assert.equal((await svc.status({ source: 'bigquery' })).source, 'local', 'a saved choice falls back once BigQuery is removed')
  })

  test('the schedule: due at once for a new dataset, then on the interval; failures retry in 15 minutes', async () => {
    let clock = T0
    const { bq, client } = setup({ now: () => clock })
    assert.equal((await bq.status()).nextAt, new Date(T0).toISOString())
    await bq.tick()
    let s = await bq.status()
    assert.equal(s.last.ok, true)
    assert.equal(s.last.mode, 'full')
    assert.equal(s.nextAt, new Date(T0 + 60 * MIN).toISOString())
    clock += 30 * MIN
    const before = client.listed.length
    await bq.tick()
    assert.equal(client.listed.length, before, 'not due yet: nothing ran')
    clock += 31 * MIN
    client.getDataset = async () => {
      throw Object.assign(new Error('Backend error'), { status: 500 })
    }
    await bq.tick()
    s = await bq.status()
    assert.equal(s.last.ok, false)
    assert.equal(s.nextAt, new Date(clock + 15 * MIN).toISOString())
    const [row] = await bq.inAppRows()
    assert.equal(row.result, 'failed')
    assert.equal(row.where.path, '/openmetadata')
  })

  test('nothing runs while it is not set up, or when refreshing is manual', async () => {
    const off = setup({ setUp: false })
    await off.bq.tick()
    assert.deepEqual(await off.bq.status(), { setUp: false })
    assert.deepEqual(await off.bq.inAppRows(), [])
    assert.equal(off.client.listed.length, 0)
    const manual = setup({ values: { project: 'chicago-transit', syncEvery: 'manual' } })
    await manual.bq.tick()
    assert.equal(manual.client.listed.length, 0)
    assert.equal((await manual.bq.inAppRows())[0].state, 'Disabled')
  })

  test('the connection check needs Google Cloud first, then reads only metadata', async () => {
    const conn = { values: { project: 'chicago-transit' } }
    const none = await connector.status(conn, { hasConnection: async () => false })
    assert.equal(none.state, 'needs-setup')
    assert.match(none.summary, /Google Cloud/)
    const client = fakeBigQuery({ tables: { entity: [ent(1)] } })
    const ok = await connector.status(conn, { hasConnection: async () => true, bigqueryClient: client })
    assert.equal(ok.state, 'ok')
    assert.equal(client.queries.length, 0)
    const missing = await connector.status(conn, { hasConnection: async () => true, bigqueryClient: fakeBigQuery({ missing: true }) })
    assert.equal(missing.state, 'needs-setup')
  })
})
