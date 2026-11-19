const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const malloyLib = require('./malloy-lib.cjs')
const connector = require('../connections/connectors/malloy.cjs')

// Fictional models. Table schemas come from FakeBigQuery below, never from Google.
const ORDERS = `source: orders is bigquery.table('lantern-demo.shop.orders') extend {
  primary_key: order_id
  join_one: stores is bigquery.table('lantern-demo.shop.stores') on store_id = stores.store_id
  # "Orders that were paid"
  measure: order_count is count()
  measure: revenue is total.sum()
  dimension: is_large is total > 25
  view: by_channel is { group_by: channel; aggregate: order_count, revenue }
}
`
const SCHEMAS = {
  'lantern-demo.shop.orders': [
    { name: 'order_id', type: 'STRING' },
    { name: 'store_id', type: 'STRING' },
    { name: 'channel', type: 'STRING' },
    { name: 'total', type: 'FLOAT64' },
    { name: 'ordered_at', type: 'TIMESTAMP' },
  ],
  'lantern-demo.shop.stores': [
    { name: 'store_id', type: 'STRING' },
    { name: 'city', type: 'STRING' },
  ],
}

/** Malloy's real BigQuery connection with every network call replaced. */
function fakeBigQuery({ scanBytes = 1000, calls = [] } = {}) {
  const { BigQueryConnection } = require('@malloydata/db-bigquery')
  class FakeConnection extends BigQueryConnection {
    async getTableFieldSchema(tablePath) {
      const fields = SCHEMAS[tablePath.replace(/`/g, '')]
      if (!fields) throw new Error(`Not found: Table ${tablePath}`)
      return { schema: { fields: fields.map((f) => ({ ...f, mode: 'NULLABLE' })) }, needsTableSuffixPseudoColumn: false, needsPartitionTimePseudoColumn: false, needsPartitionDatePseudoColumn: false }
    }
    async estimateQueryCost(sql) {
      calls.push(['estimate', sql])
      return { queryCostBytes: scanBytes }
    }
    async runSQL(sql) {
      calls.push(['run', sql])
      return { rows: [{ channel: 'web', order_count: 3, revenue: 41.5 }, { channel: 'store', order_count: 2, revenue: 12 }], totalRows: 2 }
    }
  }
  return { BigQueryConnection: FakeConnection }
}

function makeFolder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-malloy-'))
  fs.writeFileSync(path.join(dir, 'orders.malloy'), ORDERS)
  return dir
}

function service(dir, { run = 'on', maxBytes = 1e9, fake = fakeBigQuery(), credentials = async () => ({ accessToken: 'ya29.fake-token', project: 'lantern-demo' }) } = {}) {
  return malloyLib.createMalloy({ settings: async () => ({ folder: dir, run, maxBytes }), credentials, bigquery: fake })
}

describe('Malloy files', () => {
  test('not set up reads nothing; a missing folder is no-project', async () => {
    const untouchable = new Proxy({}, { get: () => () => assert.fail('touched the disk') })
    const none = await malloyLib.createMalloy({ settings: async () => undefined, fs: untouchable }).listModels()
    assert.equal(none.block, 'not-set-up')
    assert.deepEqual(none.files, [])
    const gone = await malloyLib.createMalloy({ settings: async () => ({ folder: path.join(os.tmpdir(), 'nope-mr-malloy') }) }).listModels()
    assert.equal(gone.block, 'no-project')
    for (const m of ['compile', 'sql', 'run']) {
      const r = await malloyLib.createMalloy({ settings: async () => undefined, fs: untouchable })[m]({ path: 'a.malloy', query: 'run: a' })
      assert.equal(r.block, 'not-set-up')
    }
  })

  test('lists .malloy files with relative paths, skipping dot folders, node_modules, target and big files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-malloy-list-'))
    fs.mkdirSync(path.join(dir, 'malloy', 'marts'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'malloy', 'orders.malloy'), "source: orders is bigquery.table('a.b.orders') extend {\n  measure: order_count is count()\n}\n")
    fs.writeFileSync(path.join(dir, 'malloy', 'marts', 'stores.malloy'), "source: stores is bigquery.table('a.b.stores')\n")
    fs.writeFileSync(path.join(dir, 'malloy', 'notes.txt'), 'not malloy')
    for (const skip of ['node_modules', 'target', '.git']) {
      fs.mkdirSync(path.join(dir, skip, 'pkg'), { recursive: true })
      fs.writeFileSync(path.join(dir, skip, 'pkg', 'hidden.malloy'), 'source: x is bigquery.table("x")')
    }
    fs.writeFileSync(path.join(dir, 'big.malloy'), 'x'.repeat(600 * 1024))
    // A junction (Windows) or symlink to a folder outside is never followed.
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-malloy-out-'))
    fs.writeFileSync(path.join(outside, 'secret.malloy'), 'source: s is bigquery.table("s")')
    try {
      fs.symlinkSync(outside, path.join(dir, 'malloy', 'linked'), 'junction')
    } catch {
      // No permission to link here: the other checks still run.
    }

    const r = await malloyLib.createMalloy({ settings: async () => ({ folder: dir, run: 'off' }) }).listModels()
    assert.equal(r.block, undefined)
    assert.deepEqual(r.files.map((f) => f.path).sort(), ['big.malloy', 'malloy/marts/stores.malloy', 'malloy/orders.malloy'])
    const big = r.files.find((f) => f.path === 'big.malloy')
    assert.equal(big.tooLarge, true)
    assert.equal(big.text, undefined)
    assert.match(r.files.find((f) => f.path === 'malloy/orders.malloy').text, /order_count/)
    const json = JSON.stringify(r)
    const esc = (p) => JSON.stringify(p).slice(1, -1)
    for (const p of [dir, outside, fs.realpathSync(dir)]) {
      assert.ok(!json.includes(esc(p)) && !json.includes(p.split(path.sep).join('/')), 'no absolute paths reach the page')
    }
    assert.ok(r.files.every((f) => !path.isAbsolute(f.path) && !f.path.includes('\\')))
    assert.ok(!json.includes('secret'), 'links are not followed')
  })

  test('a model path must be a relative .malloy file inside the folder', async () => {
    const dir = makeFolder()
    const root = fs.realpathSync.native(dir)
    for (const bad of ['../x.malloy', '/etc/x.malloy', 'C:/x.malloy', 'orders.txt', '', 'a/../../x.malloy']) {
      await assert.rejects(malloyLib.resolveModel(root, bad), /Not a model path|not found/)
    }
    assert.equal(await malloyLib.resolveModel(root, 'orders.malloy'), path.join(root, 'orders.malloy'))
  })
})

describe('Malloy compile, SQL and run', () => {
  test('compile returns sources, fields, joins and line numbers from the real compiler', async () => {
    const dir = makeFolder()
    const r = await service(dir).compile({ path: 'orders.malloy' })
    assert.equal(r.ok, true, JSON.stringify(r.problems))
    const orders = r.sources.find((s) => s.name === 'orders')
    assert.equal(orders.tablePath, 'lantern-demo.shop.orders')
    assert.equal(orders.primaryKey, 'order_id')
    const byName = Object.fromEntries(orders.fields.map((f) => [f.name, f]))
    assert.equal(byName.order_count.kind, 'measure')
    assert.equal(byName.order_count.description, 'Orders that were paid')
    assert.equal(byName.channel.kind, 'dimension')
    assert.equal(byName.channel.type, 'string')
    assert.equal(byName.is_large.kind, 'dimension')
    assert.equal(byName.by_channel.kind, 'view')
    assert.equal(byName.stores.kind, 'join')
    assert.ok(byName.stores.fields.some((f) => f.name === 'city'))
    assert.equal(byName.revenue.line, 6)
    assert.equal(byName.revenue.file, 'orders.malloy')
    assert.ok(!JSON.stringify(r).includes(fs.realpathSync(dir).split(path.sep).join('/')), 'no absolute paths')
  })

  test('compile errors come back as problems with lines', async () => {
    const dir = makeFolder()
    fs.writeFileSync(path.join(dir, 'broken.malloy'), "source: s is bigquery.table('lantern-demo.shop.orders') extend {\n  measure: x is nope.sum()\n}\n")
    const r = await service(dir).compile({ path: 'broken.malloy' })
    assert.equal(r.ok, false)
    assert.ok(r.problems.length > 0)
    assert.equal(r.problems[0].line, 2)
    assert.equal(r.problems[0].file, 'broken.malloy')
  })

  test('imports may not leave the folder', async () => {
    const dir = makeFolder()
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-malloy-imp-'))
    fs.writeFileSync(path.join(outside, 'x.malloy'), "source: x is bigquery.table('lantern-demo.shop.orders')\n")
    fs.writeFileSync(path.join(dir, 'imp.malloy'), `import '${path.join(outside, 'x.malloy').split(path.sep).join('/').replace(/^([A-Za-z]):/, 'file:///$1:')}'\n`)
    const r = await service(dir).compile({ path: 'imp.malloy' })
    assert.equal(r.ok, false)
    assert.match(JSON.stringify(r.problems), /inside the models folder|import/i)
  })

  test('sql compiles a query and dry-runs it without running it', async () => {
    const calls = []
    const r = await service(makeFolder(), { fake: fakeBigQuery({ calls }) }).sql({ path: 'orders.malloy', query: 'run: orders -> by_channel' })
    assert.equal(r.ok, true, JSON.stringify(r.problems))
    assert.match(r.sql, /^SELECT/i)
    assert.equal(r.estimate.bytes, 1000)
    assert.deepEqual(calls.map((c) => c[0]), ['estimate'])
  })

  test('run is refused while "Run queries" is off', async () => {
    const calls = []
    const r = await service(makeFolder(), { run: 'off', fake: fakeBigQuery({ calls }) }).run({ path: 'orders.malloy', query: 'run: orders -> by_channel' })
    assert.equal(r.ok, false)
    assert.equal(r.block, 'run-off')
    assert.equal(calls.length, 0)
  })

  test('run is refused over the scan limit, after the dry run only', async () => {
    const calls = []
    const r = await service(makeFolder(), { maxBytes: 500, fake: fakeBigQuery({ scanBytes: 5000, calls }) }).run({ path: 'orders.malloy', query: 'run: orders -> by_channel' })
    assert.equal(r.ok, false)
    assert.match(r.problems[0].message, /over the .* limit/)
    assert.deepEqual(calls.map((c) => c[0]), ['estimate'])
  })

  test('run returns fields and rows', async () => {
    const calls = []
    const r = await service(makeFolder(), { fake: fakeBigQuery({ calls }) }).run({ path: 'orders.malloy', query: 'run: orders -> by_channel' })
    assert.equal(r.ok, true, JSON.stringify(r.problems))
    assert.deepEqual(r.fields.map((f) => [f.name, f.isMeasure]), [['channel', false], ['order_count', true], ['revenue', true]])
    assert.equal(r.rows.length, 2)
    assert.equal(r.rows[0].channel, 'web')
    assert.deepEqual(calls.map((c) => c[0]), ['estimate', 'run'])
  })

  test('no Google Cloud login: a clear problem, no token in errors', async () => {
    const r = await service(makeFolder(), { credentials: async () => undefined }).compile({ path: 'orders.malloy' })
    assert.equal(r.ok, false)
    assert.equal(r.block, 'no-gcloud')
    const failing = await service(makeFolder(), { credentials: async () => { throw new Error('Bearer ya29.secret-value expired') } }).compile({ path: 'orders.malloy' })
    assert.ok(!JSON.stringify(failing).includes('ya29.secret'), 'tokens are redacted')
  })

  test('only SELECT or WITH statements are sent', () => {
    assert.ok(malloyLib.startsWithSelect('SELECT 1'))
    assert.ok(malloyLib.startsWithSelect('-- note\nWITH a AS (SELECT 1) SELECT * FROM a'))
    assert.ok(!malloyLib.startsWithSelect('DELETE FROM t WHERE true'))
    assert.ok(!malloyLib.startsWithSelect('BEGIN SELECT 1; END'))
  })
})

describe('Malloy connector', () => {
  test('validate needs an absolute folder and a sane project id', () => {
    assert.throws(() => connector._internal.validate({ values: {} }), /folder/)
    assert.throws(() => connector._internal.validate({ values: { folder: 'relative/path' } }), /full path/)
    assert.throws(() => connector._internal.validate({ values: { folder: os.tmpdir(), project: 'Bad Project!' } }), /project/)
    connector._internal.validate({ values: { folder: os.tmpdir(), project: 'lantern-demo' } })
  })

  test('settings: run is off and 1 GB unless chosen', () => {
    const s = connector._internal.settingsOf({ folder: ' C:\\models ' })
    assert.equal(s.folder, 'C:\\models')
    assert.equal(s.run, 'off')
    assert.equal(s.maxBytes, 1024 ** 3)
    assert.equal(connector._internal.settingsOf({ run: 'on', maxScanGb: '0.1' }).maxBytes, Math.round(0.1 * 1024 ** 3))
  })

  test('status needs Google Cloud and reads only the folder', async () => {
    const dir = makeFolder()
    const no = await connector.status({ values: { folder: dir } }, { hasConnection: async () => false })
    assert.equal(no.state, 'needs-setup')
    const ok = await connector.status({ values: { folder: dir } }, { hasConnection: async () => true })
    assert.equal(ok.state, 'ok')
    assert.match(ok.summary, /1 Malloy model file/)
    const missing = await connector.status({ values: { folder: path.join(dir, 'nope') } }, { hasConnection: async () => true })
    assert.equal(missing.state, 'error')
  })
})
