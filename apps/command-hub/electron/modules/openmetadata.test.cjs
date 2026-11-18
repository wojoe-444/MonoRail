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

const service = (fetch, { setUp = true, creds = TOKEN_CREDS } = {}) =>
  createService({ fetch, isSetUp: async () => setUp, credentials: async () => creds })

describe('OpenMetadata backend', () => {
  test('the page and the backend name the same entity types', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'modules', 'openmetadata', 'catalog.ts'), 'utf8')
    const page = [...src.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual(page, Object.keys(om.TYPES).sort())
  })

  test('opt-in: nothing is requested before the connection is set up', async () => {
    const fetch = fakeFetch({})
    const svc = service(fetch, { setUp: false })
    assert.deepEqual(await svc.status(), { block: 'not-set-up' })
    for (const m of ['counts', 'list', 'get', 'versions', 'recent', 'setDescription']) {
      await assert.rejects(svc[m]({ type: 'table', fqn: 'a', id: '00000000-0000-4000-8000-000000000001', description: 'x' }), /Set up OpenMetadata/)
    }
    assert.equal(fetch.calls.length, 0)
  })

  test('status reads the version and the signed-in user with the bot token', async () => {
    const fetch = fakeFetch({
      'GET /system/version': () => [200, { version: '2.0.8' }],
      'GET /users/loggedInUser': () => [200, { name: 'ada.park', displayName: 'Ada Park' }],
    })
    assert.deepEqual(await service(fetch).status(), { url: SERVER, version: '2.0.8', user: 'Ada Park' })
    assert.equal(fetch.calls[0].init.headers.Authorization, 'Bearer bot-jwt')
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
