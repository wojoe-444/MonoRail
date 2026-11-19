const test = require('node:test')
const assert = require('node:assert/strict')

const api = require('./bigquery-api.cjs')
const { createService } = require('./bigquery.cjs')._internal

function fakeFetch(routes, calls = []) {
  return async (url, init) => {
    calls.push({ url, init })
    for (const [match, reply] of routes) {
      if (url.includes(match)) {
        const r = typeof reply === 'function' ? reply(url, init) : reply
        return { status: r.status ?? 200, ok: (r.status ?? 200) < 400, text: async () => JSON.stringify(r.body ?? {}) }
      }
    }
    return { status: 404, ok: false, text: async () => JSON.stringify({ error: { message: 'Not found' } }) }
  }
}

test('rows are turned into plain values by the schema', () => {
  const schema = {
    fields: [
      { name: 'id', type: 'INTEGER' },
      { name: 'price', type: 'FLOAT' },
      { name: 'ok', type: 'BOOLEAN' },
      { name: 'at', type: 'TIMESTAMP' },
      { name: 'tags', type: 'STRING', mode: 'REPEATED' },
      { name: 'who', type: 'RECORD', fields: [{ name: 'name', type: 'STRING' }, { name: 'age', type: 'INTEGER' }] },
      { name: 'missing', type: 'STRING' },
    ],
  }
  const rows = [{ f: [{ v: '9007199254740993' }, { v: '1.5' }, { v: 'true' }, { v: '1.7e9' }, { v: [{ v: 'a' }, { v: 'b' }] }, { v: { f: [{ v: 'Ada' }, { v: '36' }] } }, { v: null }] }]
  assert.deepEqual(api.toRows(schema, rows), [['9007199254740993', 1.5, true, '2023-11-14 22:13:20.000 UTC', ['a', 'b'], { name: 'Ada', age: '36' }, null]])
})

test('names are checked before they reach a URL', async () => {
  const calls = []
  const client = api.createClient({ getToken: async () => 't', fetchImpl: fakeFetch([], calls) })
  await assert.rejects(client.listDatasets({ projectId: '../evil' }), /project id/)
  await assert.rejects(client.listTables({ projectId: 'demo-project', datasetId: 'a/b' }), /dataset id/)
  await assert.rejects(client.getTable({ projectId: 'demo-project', datasetId: 'shop', tableId: 'x.y' }), /table id/)
  await assert.rejects(client.getJob({ projectId: 'demo-project', jobId: 'job?x=1' }), /job id/)
  await assert.rejects(client.getJob({ projectId: 'demo-project', jobId: 'j1', location: 'us/../x' }), /location/)
  assert.equal(calls.length, 0)
})

test('domain-scoped projects and table names with dashes are allowed', async () => {
  const calls = []
  const client = api.createClient({ getToken: async () => 't', fetchImpl: fakeFetch([['/tables/', { body: { tableReference: { tableId: 'daily-2026' } } }]], calls) })
  await client.getTable({ projectId: 'example.com:demo-project', datasetId: 'shop', tableId: 'daily-2026' })
  assert.match(calls[0].url, /^https:\/\/bigquery\.googleapis\.com\/bigquery\/v2\/projects\/example\.com%3Ademo-project\/datasets\/shop\/tables\/daily-2026$/)
  assert.equal(calls[0].init.headers.authorization, 'Bearer t')
})

test('a query sends standard SQL and maps the response', async () => {
  const calls = []
  const client = api.createClient({
    getToken: async () => 't',
    fetchImpl: fakeFetch(
      [
        [
          '/queries',
          {
            body: {
              jobComplete: true,
              jobReference: { projectId: 'demo-project', jobId: 'job_1', location: 'US' },
              schema: { fields: [{ name: 'n', type: 'INTEGER' }] },
              rows: [{ f: [{ v: '3' }] }],
              totalRows: '1',
              totalBytesProcessed: '2048',
              cacheHit: true,
            },
          },
        ],
      ],
      calls,
    ),
  })
  const r = await client.runQuery({ projectId: 'demo-project', query: 'SELECT 3 AS n', location: 'US', maximumBytesBilled: 1e9 })
  const sent = JSON.parse(calls[0].init.body)
  assert.equal(sent.useLegacySql, false)
  assert.equal(sent.dryRun, false)
  assert.equal(sent.maximumBytesBilled, '1000000000')
  assert.deepEqual(r.rows, [['3']])
  assert.equal(r.totalBytesProcessed, 2048)
  assert.equal(r.cacheHit, true)
  assert.equal(r.job.jobId, 'job_1')
  await assert.rejects(client.runQuery({ projectId: 'demo-project', query: '  ' }), /Write a query/)
})

test('a 401 fetches a fresh token once', async () => {
  let tokens = 0
  let n = 0
  const client = api.createClient({
    getToken: async ({ refresh }) => {
      tokens++
      return refresh ? 'new' : 'old'
    },
    fetchImpl: async (_url, init) => {
      n++
      const ok = init.headers.authorization === 'Bearer new'
      return { status: ok ? 200 : 401, ok, text: async () => JSON.stringify(ok ? { projects: [{ id: 'p', projectReference: { projectId: 'demo-project' } }] } : { error: { message: 'expired' } }) }
    },
  })
  const r = await client.listProjects()
  assert.equal(n, 2)
  assert.equal(tokens, 2)
  assert.deepEqual(r.projects.map((p) => p.id), ['demo-project'])
})

test('API errors keep BigQuery message only', async () => {
  const client = api.createClient({ getToken: async () => 'secret-token', fetchImpl: fakeFetch([['/queries', { status: 400, body: { error: { message: 'Syntax error: Unexpected end of script at [1:7]', errors: [{ reason: 'invalidQuery' }] } } }]]) })
  await assert.rejects(client.runQuery({ projectId: 'demo-project', query: 'SELECT' }), (e) => {
    assert.match(e.message, /Syntax error/)
    assert.doesNotMatch(e.message, /secret-token/)
    assert.equal(e.reason, 'invalidQuery')
    return true
  })
})

test('nothing runs until the Google Cloud connection is added', async () => {
  let asked = 0
  let fetched = 0
  const svc = createService({
    hasConnection: async () => false,
    getCredentials: async () => {
      asked++
      return { accessToken: 't' }
    },
    fetch: async () => {
      fetched++
      return { status: 200, ok: true, text: async () => '{}' }
    },
  })
  assert.deepEqual(await svc.status(), { state: 'not-set-up' })
  await assert.rejects(svc.methods.listProjects(), /Connections/)
  await assert.rejects(svc.methods.runQuery(undefined, { projectId: 'demo-project', query: 'SELECT 1' }), /Connections/)
  assert.equal(asked, 0)
  assert.equal(fetched, 0)
})

test('the token is kept in memory and reused', async () => {
  let asked = 0
  const svc = createService({
    hasConnection: async () => true,
    getCredentials: async () => {
      asked++
      return { accessToken: 't', project: 'demo-project' }
    },
    fetch: fakeFetch([['/projects', { body: { projects: [] } }]]),
  })
  assert.deepEqual(await svc.status(), { state: 'ok', defaultProject: 'demo-project' })
  await svc.methods.listProjects()
  await svc.methods.listProjects()
  assert.equal(asked, 1)
})

test('job summaries carry the plan and leave out unknown fields', () => {
  const j = api.jobSummary({
    jobReference: { projectId: 'demo-project', jobId: 'j', location: 'EU' },
    configuration: { jobType: 'QUERY', query: { query: 'SELECT 1', destinationTable: { projectId: 'demo-project', datasetId: '_anon', tableId: 't' } } },
    statistics: { creationTime: '1700000000000', startTime: '1700000000100', endTime: '1700000001100', query: { totalBytesProcessed: '10', totalSlotMs: '55', queryPlan: [{ id: '0', name: 'S00: Input', recordsRead: '5' }] } },
    status: { state: 'DONE' },
  })
  assert.equal(j.destinationTable, 'demo-project._anon.t')
  assert.equal(j.totalSlotMs, 55)
  assert.equal(j.stages[0].recordsRead, 5)
  assert.equal(j.endTime, '2023-11-14T22:13:21.100Z')
})
