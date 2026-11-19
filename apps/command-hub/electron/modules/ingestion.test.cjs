const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const cron = require('./ingestion-cron.cjs')
const local = require('./ingestion-local.cjs')
const { createStore, legacyLineage } = require('./ingestion-store.cjs')
const { openDatabase } = require('../localdb/index.cjs')
const omLib = require('./openmetadata.cjs')
const { createIngestion, SOURCE_TYPES } = require('./ingestion.cjs')
const { DATA_FILES } = require('../cache/declared.cjs')
const { SCOPES } = require('../profiles/index.cjs')
const { CONNECTORS } = require('../connections/index.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-ingestion-'))
const newDb = () => openDatabase(tmp())

describe('cron', () => {
  test('next run times', () => {
    const at = new Date(2026, 10, 18, 13, 7) // Wed 18 Nov 2026 13:07 local
    assert.deepEqual(cron.next('0 */6 * * *', at), new Date(2026, 10, 18, 18, 0))
    assert.deepEqual(cron.next('@daily', at), new Date(2026, 10, 19, 0, 0))
    assert.deepEqual(cron.next('30 2 * * 1', at), new Date(2026, 10, 23, 2, 30)) // next Monday
    assert.deepEqual(cron.next('0 9 1 * *', at), new Date(2026, 11, 1, 9, 0))
    assert.deepEqual(cron.next('*/15 * * * *', at), new Date(2026, 10, 18, 13, 15))
    assert.deepEqual(cron.next('0 0 * * 7', at), new Date(2026, 10, 22, 0, 0)) // 7 is Sunday
    // Both day fields restricted: either matches (the 1st, or any Friday).
    assert.deepEqual(cron.next('0 0 1 * 5', at), new Date(2026, 10, 20, 0, 0))
  })

  test('rejects bad expressions with a readable message', () => {
    for (const bad of ['', '* * *', '61 * * * *', '* 24 * * *', '1-0 * * * *', 'a b c d e', '*/0 * * * *']) assert.throws(() => cron.parse(bad), /cron|schedule|range|field/i, bad)
  })

  test('describes the common shapes', () => {
    assert.equal(cron.describe('0 */6 * * *'), 'Every 6 hours')
    assert.equal(cron.describe('0 * * * *'), 'Every hour')
    assert.equal(cron.describe('0 2 * * *'), 'Daily at 02:00')
    assert.equal(cron.describe('30 7 * * 1'), 'Weekly on Monday at 07:30')
    assert.equal(cron.describe('0 0 1 * *'), 'Monthly on day 1 at 00:00')
    assert.equal(cron.describe('5,10 1 * * *'), '5,10 1 * * *')
  })
})

describe('filters', () => {
  test("OpenMetadata's include/exclude rule", () => {
    assert.equal(local.passes('orders', { includes: ['ord'] }), true) // anchored at the start only
    assert.equal(local.passes('my_orders', { includes: ['ord'] }), false)
    assert.equal(local.passes('Orders_tmp', { excludes: ['.*_TMP'] }), false) // case-insensitive
    assert.equal(local.passes('anything', undefined), true)
    assert.throws(() => local.checkPattern({ includes: ['('] }, 'table filter'), /not a valid regular expression/)
  })
})

describe('store', () => {
  test('a damaged older file is skipped and left as it is', async () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'pipelines.json'), '{ broken')
    const store = createStore({ db: newDb(), legacyDir: dir })
    assert.deepEqual(await store.pipelines(), [])
    assert.equal(fs.readFileSync(path.join(dir, 'pipelines.json'), 'utf8'), '{ broken')
  })

  test('keeps the newest runs and caps the log', async () => {
    const store = createStore({ db: newDb() })
    for (let i = 0; i < 35; i++) await store.saveRun('p', { runId: String(i), startDate: i, log: Array.from({ length: 300 }, (_, n) => `line ${n}`) })
    const { runs } = await store.runsFile()
    assert.equal(runs.p.length, 30)
    assert.equal(runs.p[0].runId, '34')
    assert.equal(runs.p[0].log.length, 200)
  })
})

describe('dbt manifest', () => {
  const manifest = {
    metadata: { dbt_version: '1.9.0' },
    nodes: {
      'model.shop.orders': { resource_type: 'model', database: 'analytics', schema: 'marts', name: 'orders', description: 'One row per order', columns: { id: { name: 'id', data_type: 'integer', description: 'Order id' } }, config: { materialized: 'table' }, depends_on: { nodes: ['model.shop.stg_orders'] }, tags: ['core'] },
      'model.shop.stg_orders': { resource_type: 'model', database: 'analytics', schema: 'staging', name: 'stg_orders', columns: {}, config: { materialized: 'view' }, depends_on: { nodes: ['source.shop.raw.orders'] } },
      'model.shop.eph': { resource_type: 'model', database: 'analytics', schema: 'staging', name: 'eph', config: { materialized: 'ephemeral' } },
      'test.shop.not_null': { resource_type: 'test' },
    },
    sources: { 'source.shop.raw.orders': { resource_type: 'source', database: 'raw', schema: 'shop', name: 'orders', identifier: 'orders_v2', columns: {} } },
  }

  test('models, sources, columns and lineage', () => {
    const r = local.parseDbtManifest(manifest)
    assert.deepEqual(r.tables.map((t) => `${t.database}.${t.schema}.${t.name}:${t.tableType}`).sort(), ['analytics.marts.orders:Regular', 'analytics.staging.stg_orders:View', 'raw.shop.orders_v2:External'])
    assert.deepEqual(r.lineage, [
      { from: 'analytics.staging.stg_orders', to: 'analytics.marts.orders' },
      { from: 'raw.shop.orders_v2', to: 'analytics.staging.stg_orders' },
    ])
    const orders = r.tables.find((t) => t.name === 'orders')
    assert.equal(orders.columns[0].dataType, 'INTEGER')
    assert.equal(orders.description, 'One row per order')
    assert.equal(r.tests, 1)
    assert.equal(r.dbtVersion, '1.9.0')
  })

  test('filters and description options', () => {
    const r = local.parseDbtManifest(manifest, { schemaFilterPattern: { excludes: ['staging'] }, dbtUpdateDescriptions: false })
    assert.deepEqual(r.tables.map((t) => t.name).sort(), ['orders', 'orders_v2'])
    assert.equal(r.filtered, 1)
    assert.equal(r.tables.find((t) => t.name === 'orders').description, undefined)
  })
})

describe('dbt lineage in the local database', () => {
  const manifest = {
    nodes: {
      'model.shop.orders': { resource_type: 'model', database: 'analytics', schema: 'marts', name: 'orders', columns: {}, config: { materialized: 'table' }, depends_on: { nodes: ['model.shop.stg_orders'] } },
      'model.shop.stg_orders': { resource_type: 'model', database: 'analytics', schema: 'staging', name: 'stg_orders', columns: {}, config: { materialized: 'view' }, depends_on: { nodes: ['source.shop.raw.orders'] } },
    },
    sources: { 'source.shop.raw.orders': { resource_type: 'source', database: 'raw', schema: 'shop', name: 'orders', columns: {} } },
  }
  const pipeline = { name: 'shop_dbt', pipelineType: 'dbt', service: { name: 'local_dbt' }, sourceConfig: { config: {} }, extension: { monorail: { runner: 'this-pc', serviceKind: 'metricflow' } } }

  async function runDbt(db, m) {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'dbt_project.yml'), 'name: shop\n')
    fs.mkdirSync(path.join(dir, 'target'))
    fs.writeFileSync(path.join(dir, 'target', 'manifest.json'), JSON.stringify(m))
    const store = createStore({ db })
    await local.runLocal(pipeline, { creds: { project: dir }, log: () => {}, catalog: (change) => store.updateCatalog(change) })
    return store
  }

  test('a dbt run writes edges between table entities, not the old service field', async () => {
    const db = newDb()
    const store = await runDbt(db, manifest)
    const t = (fqn) => db.get('table', fqn)
    const orders = t('local_dbt.analytics.marts.orders')
    const stg = t('local_dbt.analytics.staging.stg_orders')
    const raw = t('local_dbt.raw.shop.orders')
    assert.equal(db.countLineage(), 2)
    const l = db.lineageOf(stg.id)
    assert.deepEqual(l.upstreamEdges, [{ fromEntity: raw.id, toEntity: stg.id, lineageDetails: { source: 'DbtLineage' } }])
    assert.deepEqual(l.downstreamEdges.map((e) => e.toEntity), [orders.id])
    assert.equal(db.get('databaseService', 'local_dbt').extension.monorail.lineage, undefined, 'the old field is no longer written')
    // Explore and the runners still read { from, to } keys.
    const { services } = await store.catalog()
    assert.deepEqual(services.local_dbt.lineage.sort((a, b) => a.to.localeCompare(b.to)), [
      { from: 'analytics.staging.stg_orders', to: 'analytics.marts.orders' },
      { from: 'raw.shop.orders', to: 'analytics.staging.stg_orders' },
    ])
    // A later run without a dependency drops that edge; unchanged edges keep their time.
    const fewer = structuredClone(manifest)
    fewer.nodes['model.shop.orders'].depends_on.nodes = []
    await runDbt(db, fewer)
    assert.equal(db.countLineage(), 1)
    assert.equal(db.lineageOf(orders.id).upstreamEdges.length, 0)
  })

  test('lineage older versions kept in the service field is still read, and moves to the table on the next write', async () => {
    const db = newDb()
    const store = await runDbt(db, { ...manifest, nodes: Object.fromEntries(Object.entries(manifest.nodes).map(([k, n]) => [k, { ...n, depends_on: { nodes: [] } }])) })
    assert.equal(db.countLineage(), 0)
    // What an older MonoRail left behind.
    const svc = db.get('databaseService', 'local_dbt')
    db.put('databaseService', { ...svc, extension: { monorail: { catalog: true, lineage: [{ from: 'raw.shop.orders', to: 'analytics.staging.stg_orders' }] } } })
    const stg = db.get('table', 'local_dbt.analytics.staging.stg_orders')
    const raw = db.get('table', 'local_dbt.raw.shop.orders')
    assert.deepEqual((await store.catalog()).services.local_dbt.lineage, [{ from: 'raw.shop.orders', to: 'analytics.staging.stg_orders' }])
    const legacy = legacyLineage(db)
    assert.deepEqual(legacy.map((e) => [e.fromId, e.toId]), [[raw.id, stg.id]])
    // The OpenMetadata page's This PC source shows it too.
    const om = omLib._internal.createService({ isSetUp: async () => false, local: () => db, bigquery: { isSetUp: async () => false } })
    assert.deepEqual((await om.getLineage({ type: 'table', id: stg.id })).upstreamEdges.map((e) => e.fromEntity), [raw.id])
    // Any catalog write moves it into the lineage table and stops writing the field.
    await store.updateCatalog(() => {})
    assert.equal(db.countLineage(), 1)
    assert.equal(db.get('databaseService', 'local_dbt').extension.monorail.lineage, undefined)
    assert.deepEqual((await om.getLineage({ type: 'table', id: stg.id })).upstreamEdges.map((e) => e.fromEntity), [raw.id])
  })
})

describe('merging into the catalog', () => {
  test('counts new, changed and deleted tables, keeps profiles', () => {
    const old = local.tablesOf({ databases: local.nest([{ database: 'main', schema: 'main', name: 'a', columns: [], profile: { rowCount: 3 } }, { database: 'main', schema: 'main', name: 'gone', columns: [] }]) })
    const fresh = [{ database: 'main', schema: 'main', name: 'a', columns: [{ name: 'x' }] }, { database: 'main', schema: 'main', name: 'b', columns: [] }]
    const m = local.mergeTables(old, fresh, { markDeleted: true, keep: (t) => ({ profile: t.profile }) })
    assert.deepEqual([m.added, m.updated, m.deleted], [1, 1, 1])
    assert.equal(m.tables.find((t) => t.name === 'a').profile.rowCount, 3)
    assert.equal(m.tables.find((t) => t.name === 'gone').deleted, true)
    assert.equal(local.mergeTables(old, fresh, { markDeleted: false }).tables.some((t) => t.name === 'gone'), false)
  })
})

// ---------------------------------------------------------------- the service

function fakeConnections({ added = {}, check } = {}) {
  const connectors = CONNECTORS.map((c) => ({ kind: c.kind, title: c.title, service: c.service, parent: c.parent }))
  return {
    connections: () => ({
      list: async () => ({ connectors, connections: Object.entries(added).map(([kind, values]) => ({ kind, values })) }),
      check: async (kind) => (check ? check(kind) : { state: 'ok', summary: 'ok', details: [{ label: 'Database', value: 'x', ok: true }] }),
    }),
    getCredentials: async (kind) => {
      if (!added[kind]) throw new Error(`Set up ${kind} first`)
      return added[kind]
    },
    hasConnection: async (kind) => !!added[kind],
  }
}

const sqliteAvailable = (() => {
  try {
    require('node:sqlite')
    return true
  } catch {
    return false
  }
})()

function makeDb(dir) {
  const { DatabaseSync } = require('node:sqlite')
  const file = path.join(dir, 'field-notes.sqlite3')
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT);
    INSERT INTO notes (title, body) VALUES ('a', NULL), ('b', 'x'), ('b', 'y');
    CREATE TABLE scratch_tmp (v INTEGER);
    CREATE VIEW titles AS SELECT title FROM notes;`)
  db.close()
  return file
}

async function waitIdle(svc) {
  for (const e of svc._running.values()) await e.finished
}

describe('ingestion service', () => {
  test('adds no pipelines on its own and refuses services that are not set up', async () => {
    const svc = createIngestion({ dataDir: tmp(), deps: { db: newDb(), connections: fakeConnections() } })
    const o = await svc.overview()
    assert.deepEqual(o.pipelines, [])
    assert.equal(o.serverSetUp, false)
    assert.deepEqual(o.services.map((s) => [s.kind, s.added]).sort(), [['bigquery-metadata', false], ['metricflow', false], ['sqlite', false]])
    await assert.rejects(svc.savePipeline({ pipeline: { serviceKind: 'sqlite', pipelineType: 'metadata', name: 'x' } }), /Connections page first/)
    assert.equal((await svc.serverOverview()).block, 'not-set-up')
    await assert.rejects(svc.serverAction({ id: '00000000-0000-0000-0000-000000000000', action: 'run' }), /Set up OpenMetadata/)
  })

  test('BigQuery metadata is a service whose ingestion is the connection: no pipelines, its copy, Sync now', async () => {
    const calls = []
    const bigquery = {
      status: async () => ({ setUp: true, source: 'orbit-analytics.METADATA', entities: 42, synced: true, syncEvery: '1h', last: { at: '2026-11-18T10:00:00.000Z', ok: true, mode: 'incremental' }, nextAt: '2026-11-18T11:00:00.000Z' }),
      sync: async (a) => (calls.push(a), { ok: true }),
    }
    const added = { 'bigquery-metadata': { project: 'orbit-analytics', dataset: 'METADATA' } }
    const svc = createIngestion({ dataDir: tmp(), deps: { db: newDb(), bigquery, connections: fakeConnections({ added }) } })
    const s = (await svc.overview()).services.find((x) => x.kind === 'bigquery-metadata')
    assert.equal(s.name, 'bigquery_metadata')
    assert.equal(s.displayName, 'orbit-analytics.METADATA')
    assert.equal(s.category, 'metadataService')
    assert.equal(s.ingestion, 'connect')
    assert.deepEqual(s.localTypes, [])
    assert.equal(s.copy.entities, 42)
    assert.equal(s.copy.synced, true)
    await svc.syncConnected({ kind: 'bigquery-metadata', full: true })
    assert.deepEqual(calls, [{ full: true }])
    await assert.rejects(svc.savePipeline({ pipeline: { serviceKind: 'bigquery-metadata', pipelineType: 'metadata', name: 'x' } }))
    const withSqlite = createIngestion({ dataDir: tmp(), deps: { db: newDb(), bigquery, connections: fakeConnections({ added: { sqlite: { file: 'C:\\x.sqlite3' } } }) } })
    await assert.rejects(withSqlite.syncConnected({ kind: 'sqlite' }), /ingestion pipelines/)
    await assert.rejects(withSqlite.syncConnected({ kind: 'bigquery-metadata' }), /Connections page first/)
  })

  test('validates what is saved', async () => {
    const svc = createIngestion({ dataDir: tmp(), deps: { db: newDb(), connections: fakeConnections({ added: { sqlite: { file: 'C:\\x.sqlite3' } } }) } })
    const base = { serviceKind: 'sqlite', pipelineType: 'metadata', name: 'notes_metadata' }
    await assert.rejects(svc.savePipeline({ pipeline: { ...base, pipelineType: 'usage' } }), /cannot run usage/)
    await assert.rejects(svc.savePipeline({ pipeline: { ...base, name: 'has space' } }), /letters, digits/)
    await assert.rejects(svc.savePipeline({ pipeline: { ...base, airflowConfig: { scheduleInterval: '99 * * * *' } } }), /range/)
    await assert.rejects(svc.savePipeline({ pipeline: { ...base, sourceConfig: { config: { tableFilterPattern: { includes: ['('] } } } } }), /regular expression/)
    const p = await svc.savePipeline({ pipeline: { ...base, airflowConfig: { scheduleInterval: '0 */6 * * *' } } })
    assert.equal(p.deployed, false)
    assert.equal(p.sourceConfig.config.type, 'DatabaseMetadata')
    assert.deepEqual(p.service, { type: 'databaseService', name: 'local_sqlite', fullyQualifiedName: 'local_sqlite', displayName: 'x.sqlite3' })
    await assert.rejects(svc.savePipeline({ pipeline: { ...base } }), /already exists/)
  })

  test('runs SQLite metadata and profiler pipelines into the local catalog', { skip: !sqliteAvailable && 'node:sqlite missing' }, async () => {
    const dir = tmp()
    const file = makeDb(dir)
    const svc = createIngestion({ dataDir: dir, deps: { db: newDb(), connections: fakeConnections({ added: { sqlite: { file } } }) } })
    const meta = await svc.savePipeline({ pipeline: { serviceKind: 'sqlite', pipelineType: 'metadata', name: 'notes_metadata', sourceConfig: { config: { tableFilterPattern: { excludes: ['.*_tmp'] } } } } })
    await svc.run({ id: meta.id })
    await assert.rejects(svc.run({ id: meta.id }), /already running/)
    await waitIdle(svc)
    const [r] = await svc.runs({ id: meta.id })
    assert.equal(r.pipelineState, 'success', JSON.stringify(r))
    assert.deepEqual(r.status.map((s) => [s.name, s.records, s.filtered]), [['SQLite source', 2, 1], ['Local catalog sink', 2, 0]])
    const cat = (await svc.explore()).catalog.local_sqlite
    // The catalog is OpenMetadata entities in the local database.
    const svcDb = svc._db()
    assert.equal(svcDb.get('table', 'local_sqlite.main.main.notes').service.name, 'local_sqlite')
    assert.equal(svcDb.get('ingestionPipeline', 'local_sqlite.notes_metadata').pipelineType, 'metadata')
    const tables = cat.databases[0].schemas[0].tables
    assert.deepEqual(tables.map((t) => `${t.name}:${t.tableType}`), ['notes:Regular', 'titles:View'])
    assert.deepEqual(tables[0].columns.map((c) => [c.name, c.dataType, c.constraint]), [['id', 'INTEGER', 'PRIMARY_KEY'], ['title', 'TEXT', 'NOT_NULL'], ['body', 'TEXT', undefined]])

    const prof = await svc.savePipeline({ pipeline: { serviceKind: 'sqlite', pipelineType: 'profiler', name: 'notes_profiler' } })
    await svc.run({ id: prof.id })
    await waitIdle(svc)
    const [pr] = await svc.runs({ id: prof.id })
    assert.equal(pr.pipelineState, 'success', JSON.stringify(pr))
    const notes = (await svc.explore()).catalog.local_sqlite.databases[0].schemas[0].tables.find((t) => t.name === 'notes')
    assert.equal(notes.profile.rowCount, 3)
    assert.deepEqual(notes.profile.columns.find((c) => c.name === 'body'), { name: 'body', valuesCount: 2, nullCount: 1, distinctCount: 2 })
    assert.deepEqual(notes.profile.columns.find((c) => c.name === 'title').distinctCount, 2)
  })

  test('a failed run is recorded with its error', async () => {
    const dir = tmp()
    const svc = createIngestion({ dataDir: dir, deps: { db: newDb(), connections: fakeConnections({ added: { metricflow: { project: path.join(dir, 'nope') } } }) } })
    const p = await svc.savePipeline({ pipeline: { serviceKind: 'metricflow', pipelineType: 'dbt', name: 'shop_dbt' } })
    await svc.run({ id: p.id })
    await waitIdle(svc)
    const [list] = await svc.listPipelines()
    assert.equal(list.lastRun.pipelineState, 'failed')
    assert.match(list.lastRun.error, /dbt_project\.yml/)
  })

  test('a scheduled run reserves the pipeline while loading credentials and releases it on failure', async () => {
    const dir = tmp()
    let clock = new Date(2026, 10, 18, 10, 0)
    const connections = fakeConnections({ added: { metricflow: { project: path.join(dir, 'missing') } } })
    const started = Promise.withResolvers()
    const credentials = Promise.withResolvers()
    let credentialReads = 0
    connections.getCredentials = () => {
      if (++credentialReads > 1) return Promise.resolve({ project: path.join(dir, 'missing') })
      started.resolve()
      return credentials.promise
    }
    const svc = createIngestion({ dataDir: dir, deps: { db: newDb(), now: () => clock, connections } })
    const p = await svc.savePipeline({
      pipeline: { serviceKind: 'metricflow', pipelineType: 'dbt', name: 'shop_dbt', airflowConfig: { scheduleInterval: '0 * * * *' }, deploy: true },
    })
    clock = new Date(2026, 10, 18, 11, 30)
    const scheduled = svc.tick()
    await started.promise
    try {
      await assert.rejects(svc.run({ id: p.id }), /already running/)
    } finally {
      credentials.reject(new Error('Credentials unavailable'))
      await scheduled
    }
    assert.equal(svc._running.has(p.id), false)
    connections.getCredentials = async () => ({ project: path.join(dir, 'missing') })
    const { runId } = await svc.run({ id: p.id })
    await waitIdle(svc)
    assert.deepEqual((await svc.runs({ id: p.id })).map((r) => r.runId), [runId])
  })

  test('the scheduler runs only deployed, enabled pipelines that are due, once for missed runs', async () => {
    const dir = tmp()
    let clock = new Date(2026, 10, 18, 10, 0)
    const svc = createIngestion({ dataDir: dir, deps: { db: newDb(), now: () => clock, connections: fakeConnections({ added: { metricflow: { project: path.join(dir, 'nope') } } }) } })
    const p = await svc.savePipeline({ pipeline: { serviceKind: 'metricflow', pipelineType: 'dbt', name: 'shop_dbt', airflowConfig: { scheduleInterval: '0 * * * *' } } })
    clock = new Date(2026, 10, 18, 13, 0)
    await svc.tick()
    assert.equal((await svc.runs({ id: p.id })).length, 0, 'not deployed: nothing runs')
    clock = new Date(2026, 10, 18, 13, 5)
    await svc.setFlags({ id: p.id, deployed: true })
    await svc.tick()
    assert.equal((await svc.runs({ id: p.id })).length, 0, 'not due yet')
    clock = new Date(2026, 10, 18, 17, 30) // 14:00..17:00 missed
    await svc.tick()
    await waitIdle(svc)
    await svc.tick()
    await waitIdle(svc)
    assert.equal((await svc.runs({ id: p.id })).length, 1, 'one run for all missed times')
    await svc.setFlags({ id: p.id, enabled: false })
    clock = new Date(2026, 10, 18, 20, 0)
    await svc.tick()
    assert.equal((await svc.runs({ id: p.id })).length, 1, 'paused')
    const rows = await svc.inAppRows()
    assert.equal(rows[0].state, 'Disabled')
  })

  test('server pipelines go through OpenMetadata endpoints by id, never a path from the page', async () => {
    const calls = []
    const omClient = {
      get: async (p) => {
        calls.push(['GET', p])
        if (p.startsWith('/services/databaseServices')) return { data: [{ id: 's1', name: 'warehouse', fullyQualifiedName: 'warehouse', serviceType: 'Snowflake' }] }
        if (p.startsWith('/services/ingestionPipelines?')) return { data: [{ id: '11111111-1111-1111-1111-111111111111', name: 'wh_meta', pipelineType: 'metadata', airflowConfig: { scheduleInterval: '0 2 * * *' }, deployed: true, service: { id: 's1', type: 'databaseService', name: 'warehouse' }, pipelineStatuses: { runId: 'r', pipelineState: 'success', startDate: 1, status: [{ name: 'Sink', records: 9 }] } }], paging: {} }
        if (p.startsWith('/services/ingestionPipelines/logs/')) return { ingestion_task: 'a\nb', total: '1' }
        const e = new Error('nope')
        e.status = 404
        throw e
      },
      post: async (p, body) => {
        calls.push(['POST', p, body])
        return p === '/services/ingestionPipelines' ? { id: '22222222-2222-2222-2222-222222222222', ...body } : {}
      },
      withFields: async (_k, opts, fn) => fn(opts[0]),
    }
    const svc = createIngestion({ dataDir: tmp(), deps: { db: newDb(), omClient, connections: fakeConnections({ added: { openmetadata: { url: 'x' } } }) } })
    const o = await svc.serverOverview()
    assert.equal(o.services[0].name, 'warehouse')
    assert.equal(o.pipelines[0].schedule, 'Daily at 02:00')
    assert.equal(o.pipelines[0].lastRun.records, 9)
    await svc.serverAction({ id: '11111111-1111-1111-1111-111111111111', action: 'run' })
    await svc.serverAction({ id: '11111111-1111-1111-1111-111111111111', action: 'toggle' })
    await assert.rejects(svc.serverAction({ id: '../users', action: 'run' }), /pipeline id/)
    await assert.rejects(svc.serverAction({ id: '11111111-1111-1111-1111-111111111111', action: 'delete' }), /Unknown/)
    assert.deepEqual((await svc.serverLogs({ id: '11111111-1111-1111-1111-111111111111' })).lines, ['a', 'b'])
    const created = await svc.serverCreate({ service: { id: '33333333-3333-3333-3333-333333333333', category: 'databaseService' }, pipeline: { name: 'wh_usage', pipelineType: 'usage', sourceConfig: { config: { queryLogDuration: 3 } }, airflowConfig: { scheduleInterval: '0 3 * * *' } }, deploy: true })
    assert.equal(created.pipeline.name, 'wh_usage')
    const post = calls.find((c) => c[0] === 'POST' && c[1] === '/services/ingestionPipelines')
    assert.deepEqual(post[2].sourceConfig.config, { type: 'DatabaseUsage', queryLogDuration: 3 })
    assert.deepEqual(post[2].service, { id: '33333333-3333-3333-3333-333333333333', type: 'databaseService' })
    assert.ok(calls.some((c) => c[1] === '/services/ingestionPipelines/trigger/11111111-1111-1111-1111-111111111111'))
    assert.ok(calls.some((c) => c[1] === '/services/ingestionPipelines/toggleIngestion/11111111-1111-1111-1111-111111111111'))
    assert.ok(calls.some((c) => c[1] === '/services/ingestionPipelines/deploy/22222222-2222-2222-2222-222222222222'))
    await assert.rejects(svc.serverCreate({ service: { id: '33333333-3333-3333-3333-333333333333', category: 'databaseService' }, pipeline: { name: 'x', pipelineType: 'dbt' } }), /cannot create dbt/)
  })
})

describe('declarations', () => {
  test('data folder, files and service connectors are declared', () => {
    assert.equal(SCOPES['modules/ingestion'], 'profile')
    assert.deepEqual(DATA_FILES['modules/ingestion'], ['pipelines.json', 'runs.json', 'catalog.json'])
    const services = CONNECTORS.filter((c) => c.service).map((c) => c.kind).sort()
    assert.deepEqual(services, ['bigquery-metadata', 'metricflow', 'openmetadata', 'sqlite'])
    for (const c of CONNECTORS.filter((x) => x.service)) assert.ok(omLib.TYPES[c.service.category], `${c.kind}: ${c.service.category} is an OpenMetadata service type`)
    for (const cat of Object.keys(SOURCE_TYPES)) assert.ok(omLib.TYPES[cat], cat)
  })
})
