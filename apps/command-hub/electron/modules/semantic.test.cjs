const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const mfLib = require('./semantic-mf.cjs')
const semantic = require('./semantic.cjs')
const connector = require('../connections/connectors/metricflow.cjs')

// A small fictional semantic manifest, shaped like dbt's semantic_manifest.json.
const MANIFEST = {
  semantic_models: [
    {
      name: 'orders',
      description: 'One row per order.',
      node_relation: { alias: 'fct_orders', schema_name: 'analytics' },
      defaults: { agg_time_dimension: 'ordered_at' },
      primary_entity: null,
      entities: [
        { name: 'order', type: 'primary' },
        { name: 'customer', type: 'foreign' },
      ],
      measures: [
        { name: 'order_total', agg: 'sum' },
        { name: 'order_count', agg: 'count' },
      ],
      dimensions: [
        { name: 'ordered_at', type: 'time', type_params: { time_granularity: 'day' } },
        { name: 'channel', type: 'categorical' },
      ],
    },
    {
      name: 'customers',
      node_relation: { alias: 'dim_customers' },
      entities: [{ name: 'customer', type: 'primary' }],
      measures: [],
      dimensions: [{ name: 'region', type: 'categorical' }],
    },
  ],
  metrics: [
    { name: 'revenue', label: 'Revenue', type: 'simple', type_params: { measure: { name: 'order_total' }, input_measures: [{ name: 'order_total' }] }, filter: null },
    { name: 'orders', type: 'simple', type_params: { measure: { name: 'order_count' } }, filter: { where_filters: [{ where_sql_template: "{{ Dimension('order__channel') }} != 'test'" }] } },
    { name: 'aov', type: 'ratio', type_params: { numerator: { name: 'revenue' }, denominator: { name: 'orders' } } },
  ],
  saved_queries: [{ name: 'weekly', query_params: { metrics: ['revenue'], group_by: ["{{ TimeDimension('metric_time', 'WEEK') }}", "{{ Dimension('order__channel') }}"], where: null } }],
}

function makeProject({ manifest = MANIFEST, venv = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-sem-'))
  fs.writeFileSync(path.join(dir, 'dbt_project.yml'), "name: 'lantern_coffee'\nversion: '1.0'\nprofile: lantern # comment\n")
  fs.mkdirSync(path.join(dir, 'target'))
  if (manifest) fs.writeFileSync(path.join(dir, 'target', 'semantic_manifest.json'), JSON.stringify(manifest))
  fs.writeFileSync(path.join(dir, 'target', 'manifest.json'), JSON.stringify({ metadata: { dbt_version: '1.10.4', generated_at: '2026-11-12T05:00:00Z' }, nodes: {} }))
  if (venv) {
    const win = process.platform === 'win32'
    const bin = path.join(dir, '.venv', win ? 'Scripts' : 'bin')
    fs.mkdirSync(bin, { recursive: true })
    fs.writeFileSync(path.join(bin, win ? 'mf.exe' : 'mf'), '')
    const site = win ? path.join(dir, '.venv', 'Lib', 'site-packages') : path.join(dir, '.venv', 'lib', 'python3.12', 'site-packages')
    fs.mkdirSync(site, { recursive: true })
    for (const d of ['metricflow-0.208.1.dist-info', 'dbt_core-1.10.4.dist-info', 'dbt_duckdb-1.10.0.dist-info', 'dbt_semantic_interfaces-0.9.0.dist-info']) fs.mkdirSync(path.join(site, d))
  }
  return dir
}

describe('semantic manifest', () => {
  test('models, metrics, joined dimensions and saved queries', () => {
    const p = mfLib.parseManifest(MANIFEST)
    assert.deepEqual(p.models.map((m) => [m.name, m.model, m.primaryEntity]), [
      ['orders', 'fct_orders', 'order'],
      ['customers', 'dim_customers', 'customer'],
    ])
    const revenue = p.metrics.find((m) => m.name === 'revenue')
    assert.equal(revenue.definition, 'Sum of order_total')
    assert.deepEqual(revenue.semanticModels, ['orders'])
    assert.ok(revenue.dimensions.includes('metric_time'))
    assert.ok(revenue.dimensions.includes('order__channel'))
    assert.ok(revenue.dimensions.includes('customer__region'), 'one join away through the customer entity')
    const aov = p.metrics.find((m) => m.name === 'aov')
    assert.equal(aov.definition, 'revenue ÷ orders')
    assert.deepEqual(aov.inputMetrics, ['revenue', 'orders'])
    assert.deepEqual(aov.measures.sort(), ['order_count', 'order_total'])
    assert.match(p.metrics.find((m) => m.name === 'orders').filter, /order__channel/)
    assert.deepEqual(p.savedQueries[0].groupBy, ['metric_time__week', 'order__channel'])
    assert.equal(p.dimensions[0].name, 'metric_time')
  })

  test('not a manifest throws', () => {
    assert.throws(() => mfLib.parseManifest({ nodes: {} }))
  })

  test('dbt_project.yml keys without a YAML library', () => {
    assert.deepEqual(mfLib.parseProjectYml("name: 'x_y'\nprofile: \"p\" # c\ntarget-path: out\nmodels:\n  name: nested\n"), { name: 'x_y', profile: 'p', 'target-path': 'out' })
  })
})

describe('semantic project loading', () => {
  test('reads files only and hands the page no paths', async () => {
    const dir = makeProject()
    const page = await semantic._internal.getProject({ settings: async () => ({ project: dir, run: 'off' }) })
    assert.equal(page.block, undefined)
    assert.equal(page.project.name, 'lantern_coffee')
    assert.equal(page.project.dbtVersion, '1.10.4')
    assert.equal(page.metricflow.found, true)
    assert.equal(page.metricflow.canRun, false)
    assert.equal(page.metricflow.version, '0.208.1')
    assert.equal(page._internal, undefined)
    assert.ok(!JSON.stringify(page).includes(dir), 'the full project path never reaches the page')
  })

  test('blocks: not set up, no project, no manifest, bad manifest', async () => {
    assert.equal((await semantic._internal.getProject({ settings: async () => undefined })).block, 'not-set-up')
    assert.equal((await semantic._internal.getProject({ settings: async () => ({ project: path.join(os.tmpdir(), 'nope-mr'), run: 'on' }) })).block, 'no-project')
    const noManifest = makeProject({ manifest: null })
    assert.equal((await semantic._internal.getProject({ settings: async () => ({ project: noManifest }) })).block, 'no-manifest')
    const bad = makeProject({ manifest: null })
    fs.writeFileSync(path.join(bad, 'target', 'semantic_manifest.json'), '{oops')
    assert.equal((await semantic._internal.getProject({ settings: async () => ({ project: bad }) })).block, 'bad-manifest')
  })

  test('queries refuse while running is off', async () => {
    const dir = makeProject()
    await assert.rejects(semantic._internal.forQuery({ settings: async () => ({ project: dir, run: 'off' }) }), /Running queries is off/)
    await assert.rejects(semantic._internal.forQuery({ settings: async () => undefined }), /Set up MetricFlow/)
  })

  test('versions from dist-info folder names', () => {
    assert.deepEqual(mfLib.summarizeVersions({ metricflow: '0.208.1', dbt_core: '1.10.4', dbt_duckdb: '1.10.0', dbt_semantic_interfaces: '0.9' }), { metricflow: '0.208.1', dbt: 'dbt-core 1.10.4, dbt-duckdb 1.10.0' })
  })
})

describe('semantic queries', () => {
  const manifest = mfLib.parseManifest(MANIFEST)

  test('arguments are built from checked names only', () => {
    const args = mfLib.queryArgs({ metrics: ['revenue', 'orders'], groupBy: ['metric_time__week', 'customer__region'], where: ["{{ Dimension('order__channel') }} = 'App'"], start: '2026-01-01', orderBy: ['-revenue'], limit: 50 }, manifest)
    assert.deepEqual(args, ['query', '--metrics', 'revenue,orders', '--group-by', 'metric_time__week,customer__region', '--where', "{{ Dimension('order__channel') }} = 'App'", '--start-time', '2026-01-01', '--order', '-revenue', '--limit', '50'])
    assert.throws(() => mfLib.queryArgs({ metrics: ['nope'] }, manifest), /Unknown metric/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue; rm -rf'] }, manifest), /Unknown metric/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue'], groupBy: ['customer__shoe_size'] }, manifest), /Unknown dimension/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue'], where: ['a\nb'] }, manifest), /one line/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue'], start: 'yesterday' }, manifest), /Dates/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue'], orderBy: ['orders'] }, manifest), /sort/)
    assert.throws(() => mfLib.queryArgs({ metrics: ['revenue'], limit: 0 }, manifest), /row limit/)
    const two = mfLib.queryArgs({ metrics: ['revenue'], where: ['a = 1', 'b = 2'] }, manifest)
    assert.deepEqual(two.filter((_, i) => two[i - 1] === '--where'), ['a = 1', 'b = 2'])
  })

  test('CSV results: quotes, numbers, nulls, midnight timestamps', () => {
    const r = mfLib.csvResult('METRIC_TIME__WEEK,order__channel,revenue\r\n2026-08-03 00:00:00,"In ""store""",13118.5\n2026-08-03 00:00:00,App,\n')
    assert.deepEqual(r.columns, ['metric_time__week', 'order__channel', 'revenue'])
    assert.deepEqual(r.rows, [
      ['2026-08-03', 'In "store"', 13118.5],
      ['2026-08-03', 'App', null],
    ])
  })

  test('runQuery reads mf CSV from a temp folder and deletes it', async () => {
    const dir = makeProject()
    const mf = await mfLib.findMf(dir)
    let seen
    const r = await mfLib.runQuery(
      { projectDir: dir, mf, manifest, req: { metrics: ['revenue'], groupBy: ['order__channel'] } },
      {
        runMf: async (file, args, opts) => {
          seen = { file, args, opts }
          fs.writeFileSync(args[args.indexOf('--csv') + 1], 'order__channel,revenue\nApp,10\nWeb,5\n')
          return { code: 0, stdout: '', stderr: '' }
        },
      },
    )
    assert.equal(seen.file, mf.file)
    assert.equal(seen.opts.cwd, dir)
    assert.deepEqual(r.rows, [
      ['App', 10],
      ['Web', 5],
    ])
    assert.ok(!fs.existsSync(path.dirname(seen.args[seen.args.indexOf('--csv') + 1])), 'temp folder removed')
  })

  test('a failing mf run reports its last lines', async () => {
    const dir = makeProject()
    const mf = await mfLib.findMf(dir)
    await assert.rejects(
      mfLib.runQuery({ projectDir: dir, mf, manifest, req: { metrics: ['revenue'] } }, { runMf: async () => ({ code: 1, stdout: '', stderr: '\u001b[31mDatabase Error\u001b[0m\n  could not connect' }) }),
      /MetricFlow failed:\nDatabase Error\n {2}could not connect/,
    )
  })

  test('explain keeps only the SQL', () => {
    assert.equal(mfLib.extractSql('🔎 SQL (remove --explain to see data or add --show-dataflow-plan to see the generated dataflow plan):\nSELECT 1\nFROM t\n'), 'SELECT 1\nFROM t')
  })

  test('a script shim on PATH is refused', async () => {
    await assert.rejects(mfLib.runQuery({ projectDir: '/x', mf: { file: 'mf.cmd', shim: true }, manifest, req: { metrics: ['revenue'] } }), /not mf.exe/)
    await assert.rejects(mfLib.runQuery({ projectDir: '/x', mf: undefined, manifest, req: { metrics: ['revenue'] } }), /not found/)
  })

  test('no shell anywhere in the MetricFlow code', () => {
    for (const f of ['semantic-mf.cjs', 'semantic.cjs', '../connections/connectors/metricflow.cjs']) {
      const src = fs.readFileSync(path.join(__dirname, f), 'utf8')
      assert.ok(!/shell:\s*true/.test(src), f)
      assert.ok(!/execSync|[^.\w]exec\(/.test(src), f)
    }
  })
})

describe('MetricFlow connector', () => {
  test('validate wants a full folder path', () => {
    assert.throws(() => connector._internal.validate({ values: { project: '' } }), /dbt project folder/)
    assert.throws(() => connector._internal.validate({ values: { project: 'relative/dir' } }), /full path/)
  })

  test('status reads files only and never opens profiles.yml', async () => {
    const dir = makeProject()
    fs.writeFileSync(path.join(dir, 'profiles.yml'), 'secret: hunter2')
    const opened = []
    const realRead = fs.promises.readFile
    const s = await connector.status({ values: { project: dir, run: 'on' } }, { readFile: (f, ...a) => (opened.push(f), realRead(f, ...a)) })
    assert.equal(s.state, 'ok')
    assert.match(s.summary, /lantern_coffee with 3 metrics/)
    assert.ok(s.details.some((d) => d.label === 'profiles.yml' && /project folder/.test(d.value)))
    assert.ok(!opened.some((f) => f.endsWith('profiles.yml')))
    assert.deepEqual(s.actions, ['validate'])
    const off = await connector.status({ values: { project: dir, run: 'off' } })
    assert.deepEqual(off.actions, [])
  })

  test('missing manifest and missing folder', async () => {
    const dir = makeProject({ manifest: null })
    assert.equal((await connector.status({ values: { project: dir } })).state, 'error')
    assert.equal((await connector.status({ values: { project: path.join(os.tmpdir(), 'nope-mr2') } })).state, 'error')
  })

  test('validate action refuses while running is off', async () => {
    const a = connector.actions.find((x) => x.id === 'validate')
    await assert.rejects(a.run({ values: { project: '/x', run: 'off' } }, {}), /off/)
  })
})

describe('MetricFlow MCP tools', () => {
  test('list is a read tool, query needs consent and the run setting', async () => {
    const { readTools, writeTools } = require('../mcp/tools.cjs')
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-sem-root-'))
    const list = readTools({ rootDir: root }).find((t) => t.name === 'list_semantic_metrics')
    const query = writeTools({ rootDir: root }).find((t) => t.name === 'query_semantic_metrics')
    assert.ok(list && query)
    assert.equal(query.consent, true)
    await assert.rejects(list.handler({}), /not set up/)

    const dir = makeProject()
    fs.mkdirSync(path.join(root, 'modules', 'connections'), { recursive: true })
    fs.writeFileSync(path.join(root, 'modules', 'connections', 'connections.json'), JSON.stringify({ connections: { metricflow: { values: { project: dir, run: 'off' } } } }))
    const r = await list.handler({ search: 'rev' })
    assert.deepEqual(r.metrics.map((m) => m.name), ['revenue'])
    assert.equal(r.canRunQueries, false)
    await assert.rejects(query.handler({ metrics: ['revenue'] }, { did: () => {} }), /off/)
  })
})
