const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const om = require('./openmetadata.cjs')
const connector = require('../connections/connectors/openmetadata.cjs')

const { createService } = om._internal
const SERVER = 'http://localhost:8585'
const TOKEN_CREDS = { url: SERVER, auth: 'token', token: 'bot-jwt' }

/** A fake fetch: records each call, answers from `routes` (first matching prefix of "METHOD /path"). */
function fakeFetch(routes) {
  const calls = []
  const fn = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const rel = url.replace(`${SERVER}/api/v1`, '')
    calls.push({ method, url, rel, init })
    const hit = Object.entries(routes).find(([k]) => `${method} ${rel}`.startsWith(k))
    const [status, body] = hit ? hit[1](rel, init) : [404, { message: 'no route' }]
    return { ok: status < 400, status, statusText: String(status), text: async () => JSON.stringify(body), json: async () => body }
  }
  fn.calls = calls
  return fn
}

// BigQuery metadata not set up: these tests are about the server and the local database.
const NO_BIGQUERY = { isSetUp: async () => false }

const service = (fetch, { setUp = true, creds = TOKEN_CREDS } = {}) =>
  createService({ fetch, isSetUp: async () => setUp, credentials: async () => creds, bigquery: NO_BIGQUERY })

describe('OpenMetadata backend', () => {
  test('the page and the backend name the same entity types', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'modules', 'openmetadata', 'catalog.ts'), 'utf8')
    const page = [...src.matchAll(/\b(?:t|std)\('(\w+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual(page, Object.keys(om.TYPES).sort())
  })

  test('opt-in: nothing is requested before the connection is set up', async () => {
    const fetch = fakeFetch({})
    const svc = service(fetch, { setUp: false })
    assert.deepEqual(await svc.status({ source: 'server' }), { block: 'not-set-up', source: 'server', serverSetUp: false, bigquerySetUp: false })
    for (const m of ['counts', 'list', 'get', 'versions', 'recent', 'getLineage', 'setDescription']) {
      await assert.rejects(svc[m]({ source: 'server', type: 'table', fqn: 'a', id: '00000000-0000-4000-8000-000000000001', description: 'x' }), /Set up OpenMetadata/)
    }
    assert.equal(fetch.calls.length, 0)
  })

  test('status reads the version and the signed-in user with the bot token', async () => {
    const fetch = fakeFetch({
      'GET /system/version': () => [200, { version: '2.0.8' }],
      'GET /users/loggedInUser': () => [200, { name: 'ada.park', displayName: 'Ada Park' }],
    })
    assert.deepEqual(await service(fetch).status(), { source: 'server', url: SERVER, version: '2.0.8', user: 'Ada Park', serverSetUp: true, bigquerySetUp: false })
    assert.equal(fetch.calls[0].init.headers.Authorization, 'Bearer bot-jwt')
  })

  test('requests use a replacement bot token as soon as it is saved', async () => {
    const creds = { ...TOKEN_CREDS }
    const fetch = fakeFetch({
      'GET /tables?': (_rel, init) => init.headers.Authorization === `Bearer ${creds.token}`
        ? [200, { data: [] }]
        : [401, {}],
    })
    const svc = service(fetch, { creds })
    await svc.list({ type: 'table' })
    creds.token = 'replacement-jwt'
    await svc.list({ type: 'table' })
  })

  test('parallel requests share login and renewal, and a saved password change triggers a new login', async () => {
    const creds = { url: SERVER, auth: 'login', email: 'ada@example.com', password: 'first-password' }
    let logins = 0
    let expired = false
    const fetch = fakeFetch({
      'POST /users/login': () => [200, { accessToken: `t${++logins}` }],
      'GET /tables?': (_rel, init) => expired && init.headers.Authorization === 'Bearer t1'
        ? [401, {}]
        : [200, { data: [] }],
    })
    const svc = service(fetch, { creds })
    const list = () => svc.list({ type: 'table' })
    await Promise.all([list(), list()])
    assert.equal(logins, 1)
    expired = true
    await Promise.all([list(), list()])
    assert.equal(logins, 2)
    creds.password = 'replacement-password'
    await list()
    assert.equal(logins, 3)
    assert.equal(fetch.calls.at(-1).init.headers.Authorization, 'Bearer t3')
  })

  test('only known types; the backend builds every path', async () => {
    const svc = service(fakeFetch({}))
    await assert.rejects(svc.list({ type: '../bots' }), /no entity type/)
    await assert.rejects(svc.list({ type: 'constructor' }), /no entity type/)
    await assert.rejects(svc.versions({ type: 'table', id: '../../bots' }), /entity id/)
  })

  test('lists fall back from owners,tags to owners to the defaults, and remember it', async () => {
    const fetch = fakeFetch({
      'GET /roles': (rel) => (rel.includes('fields=') ? [400, { message: 'Invalid field name owners' }] : [200, { data: [{ id: '1', name: 'DataSteward' }], paging: { total: 1 } }]),
    })
    const svc = service(fetch)
    const page = await svc.list({ type: 'role' })
    assert.equal(page.data[0].name, 'DataSteward')
    assert.deepEqual(
      fetch.calls.map((c) => decodeURIComponent(c.rel)),
      ['/roles?limit=50&fields=owners,tags', '/roles?limit=50&fields=owners', '/roles?limit=50'],
    )
    await svc.list({ type: 'role' })
    assert.equal(decodeURIComponent(fetch.calls.at(-1).rel), '/roles?limit=50', 'refused field lists are not asked for again')
  })

  test('get asks for every field by fully qualified name, encoded as one segment', async () => {
    const fetch = fakeFetch({ 'GET /tables/name/': () => [200, { id: 't', name: 'fct_orders' }] })
    await service(fetch).get({ type: 'table', fqn: 'warehouse.acme.marts.fct_orders' })
    assert.equal(fetch.calls[0].rel, '/tables/name/warehouse.acme.marts.fct_orders?fields=*')
  })

  test('counts use paging.total and report a type the server lacks', async () => {
    const fetch = fakeFetch({
      'GET /tables?': () => [200, { data: [{}], paging: { total: 20 } }],
      'GET /dataContracts?': () => [404, { message: 'Not found' }],
    })
    const counts = await service(fetch).counts({ types: ['table', 'dataContract', 'not-a-type'] })
    assert.equal(counts.table, 20)
    assert.match(counts.dataContract.error, /Not found/)
    assert.equal('not-a-type' in counts, false)
  })

  test('versions are parsed from OpenMetadata\'s JSON strings', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const fetch = fakeFetch({ 'GET /tables/': () => [200, { versions: [JSON.stringify({ version: 0.2 }), JSON.stringify({ version: 0.1 })] }] })
    assert.deepEqual(await service(fetch).versions({ type: 'table', id }), [{ version: 0.2 }, { version: 0.1 }])
    assert.equal(fetch.calls[0].rel, `/tables/${id}/versions`)
  })

  test('recent keeps only the entity types the page knows (no columns)', async () => {
    const fetch = fakeFetch({
      'GET /search/query': () => [200, { hits: { hits: [{ _source: { entityType: 'tableColumn', id: 'c' } }, { _source: { entityType: 'table', id: 't' } }] } }],
    })
    assert.deepEqual((await service(fetch).recent()).map((e) => e.id), ['t'])
  })

  test("search asks the server's search for the whole catalog, filtered to the types, as summary rows", async () => {
    const fetch = fakeFetch({
      'GET /search/query': () => [
        200,
        { hits: { total: { value: 1234 }, hits: [{ _source: { entityType: 'table', id: 't', name: 'orders_mart', columns: [{ name: 'id' }] } }, { _source: { entityType: 'tableColumn', id: 'c' } }] } },
      ],
    })
    const res = await service(fetch).search({ q: 'orders mart:x', types: ['table', 'dashboard'], limit: 25 })
    assert.deepEqual(res, { data: [{ entityType: 'table', id: 't', name: 'orders_mart' }], total: 1234 })
    const url = new URL(fetch.calls[0].url)
    assert.equal(url.searchParams.get('q'), '*orders* AND *mart\\:x*')
    assert.equal(url.searchParams.get('size'), '25')
    assert.deepEqual(JSON.parse(url.searchParams.get('query_filter')).query.bool.filter[0].terms.entityType, ['table', 'dashboard'])
    await assert.rejects(service(fetch).search({ q: 'x', types: ['nope'] }), /at least one entity type/)
  })

  test("lineage: GET /lineage/{type}/{id} with depths capped at 3, in the same shape as the local database's", async () => {
    const id = '00000000-0000-4000-8000-000000000002'
    const up = '00000000-0000-4000-8000-000000000001'
    const down = '00000000-0000-4000-8000-000000000003'
    const fetch = fakeFetch({
      'GET /lineage/table/': () => [200, {
        entity: { id, type: 'table', name: 'stg', fullyQualifiedName: 'svc.db.sch.stg', href: 'http://x' },
        nodes: [{ id: up, type: 'table', name: 'raw', fullyQualifiedName: 'svc.db.sch.raw' }, { id: down, type: 'dashboard', name: 'Revenue', fullyQualifiedName: 'bi.Revenue' }],
        upstreamEdges: [{ fromEntity: up, toEntity: id, lineageDetails: { source: 'QueryLineage', sqlQuery: 'INSERT ...' } }],
        downstreamEdges: [{ fromEntity: { id, type: 'table' }, toEntity: { id: down, type: 'dashboard' } }, { fromEntity: id }],
      }],
    })
    const svc = service(fetch)
    const l = await svc.getLineage({ type: 'table', id, upstreamDepth: 2, downstreamDepth: 9 })
    assert.equal(fetch.calls[0].rel, `/lineage/table/${id}?upstreamDepth=2&downstreamDepth=3`)
    assert.deepEqual(l.entity, { id, type: 'table', name: 'stg', fullyQualifiedName: 'svc.db.sch.stg' })
    assert.deepEqual(l.upstreamEdges, [{ fromEntity: up, toEntity: id, lineageDetails: { source: 'QueryLineage', sqlQuery: 'INSERT ...' } }])
    assert.deepEqual(l.downstreamEdges, [{ fromEntity: id, toEntity: down }], 'references become ids; an edge without both ends is dropped')
    assert.deepEqual(l.nodes.map((n) => n.type), ['table', 'dashboard'])
    await svc.getLineage({ type: 'table', id })
    assert.equal(fetch.calls[1].rel, `/lineage/table/${id}?upstreamDepth=1&downstreamDepth=1`, 'depth 1 by default')
    await assert.rejects(svc.getLineage({ type: 'table', id: '../tables' }), /entity id/)
    await assert.rejects(svc.getLineage({ type: 'nope', id }), /no entity type/)
    assert.equal(fetch.calls.length, 2)

    // The local database answers the same keys.
    const { openDatabase } = require('../localdb/index.cjs')
    const db = openDatabase(fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'monorail-om-')))
    const a = db.put('table', { name: 'raw', fullyQualifiedName: 'svc.db.sch.raw' })
    const b = db.put('table', { name: 'stg', fullyQualifiedName: 'svc.db.sch.stg' })
    db.putLineage({ fromEntity: { id: a.id, type: 'table' }, toEntity: { id: b.id, type: 'table' } })
    const local = await createService({ fetch, isSetUp: async () => true, credentials: async () => TOKEN_CREDS, local: () => db, bigquery: NO_BIGQUERY }).getLineage({ source: 'local', type: 'table', id: b.id })
    assert.deepEqual(Object.keys(local).sort(), Object.keys(l).sort())
    assert.deepEqual(local.upstreamEdges, [{ fromEntity: a.id, toEntity: b.id }])
    assert.equal(fetch.calls.length, 2, 'the local source makes no request')
  })

  test('the one write: a JSON Patch on /description only', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const fetch = fakeFetch({ 'PATCH /tables/': () => [200, { id, description: 'New' }] })
    const svc = service(fetch)
    await svc.setDescription({ type: 'table', id, description: 'New' })
    const c = fetch.calls[0]
    assert.equal(c.rel, `/tables/${id}`)
    assert.equal(c.init.headers['Content-Type'], 'application/json-patch+json')
    assert.deepEqual(JSON.parse(c.init.body), [{ op: 'add', path: '/description', value: 'New' }])
    await assert.rejects(svc.setDescription({ type: 'table', id, description: 42 }), /description/)
  })

  test('an email and password sign in once, with the password base64-encoded, and again after a 401', async () => {
    let tokens = 0
    let firstUse = true
    const fetch = fakeFetch({
      'POST /users/login': () => [200, { accessToken: `t${++tokens}` }],
      'GET /tables?': (_rel, init) => {
        if (init.headers.Authorization === 'Bearer t1' && firstUse) {
          firstUse = false
          return [401, { message: 'Token expired' }]
        }
        return [200, { data: [], paging: { total: 0 } }]
      },
    })
    const svc = service(fetch, { creds: { url: SERVER, auth: 'login', email: 'ada@example.com', password: 'pässword' } })
    await svc.list({ type: 'table' })
    const login = fetch.calls.find((c) => c.rel === '/users/login')
    assert.equal(JSON.parse(login.init.body).password, Buffer.from('pässword', 'utf8').toString('base64'))
    assert.equal(tokens, 2, 'signed in again after the 401')
    assert.equal(fetch.calls.at(-1).init.headers.Authorization, 'Bearer t2')
  })
})

describe('OpenMetadata connector', () => {
  const { normalizeUrl } = connector._internal

  test('http only on this PC; a pasted /api/v1 is dropped', () => {
    assert.equal(normalizeUrl('localhost:8585'), 'http://localhost:8585')
    assert.equal(normalizeUrl('http://127.0.0.1:8585/api/v1/'), 'http://127.0.0.1:8585')
    assert.equal(normalizeUrl('https://om.example.com/'), 'https://om.example.com')
    assert.throws(() => normalizeUrl('http://om.example.com'), /https/)
    assert.throws(() => normalizeUrl(''), /Enter/)
  })

  test('validate asks for a token, or an email and password', () => {
    assert.throws(() => connector.validate({ values: { url: SERVER, auth: 'token' }, secretsSet: {} }), /bot token/)
    assert.throws(() => connector.validate({ values: { url: SERVER, auth: 'login' }, secretsSet: { password: true } }), /email/)
    connector.validate({ values: { url: SERVER, auth: 'token' }, secretsSet: { token: true } })
  })

  test('status: connected, rejected, or unreachable', async () => {
    const conn = { values: { url: SERVER, auth: 'token' }, secrets: { token: 'bot-jwt' } }
    const ok = fakeFetch({
      'GET /system/version': () => [200, { version: '2.0.8' }],
      'GET /users/loggedInUser': () => [200, { displayName: 'Ingestion Bot' }],
    })
    const s = await connector.status(conn, { fetch: ok })
    assert.equal(s.state, 'ok')
    assert.match(s.summary, /2\.0\.8 as Ingestion Bot/)
    const rejected = fakeFetch({ 'GET /system/version': () => [200, { version: '2.0.8' }], 'GET /users/loggedInUser': () => [401, {}] })
    assert.equal((await connector.status(conn, { fetch: rejected })).state, 'expired')
    const down = async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    }
    const d = await connector.status(conn, { fetch: down })
    assert.equal(d.state, 'error')
    assert.match(d.summary, /ECONNREFUSED/)
  })
})
