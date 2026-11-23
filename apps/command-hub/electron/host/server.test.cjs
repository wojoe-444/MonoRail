// The self-hosted mode's HTTP server (electron/host/server.cjs), under plain
// Node: the launch link, the cookie, the host and origin checks, the bridge and
// the built pages.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHostServer, cookieName, OPEN_PATH, PING_PATH } = require('./server.cjs')
const { isHosted, HOST_RESTART_CODE } = require('./mode.cjs')
const { decode } = require('../bridge/codec.cjs')

const KEY = 'k'.repeat(64)

async function start(t, opts = {}) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-host-'))
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>')
  fs.mkdirSync(path.join(dist, 'assets'))
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)')
  fs.writeFileSync(path.join(path.dirname(dist), `${path.basename(dist)}-secret.txt`), 'outside')
  let push
  const calls = []
  const server = createHostServer({
    key: KEY,
    distDir: dist,
    platform: 'win32',
    invoke: async (moduleId, method, args) => {
      calls.push([moduleId, method, args])
      return { at: new Date('2026-01-02T03:04:05Z') }
    },
    subscribe: (fn) => (push = fn),
    ...opts,
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}`
  t.after(() => {
    server.close()
    fs.rmSync(dist, { recursive: true, force: true })
    fs.rmSync(path.join(path.dirname(dist), `${path.basename(dist)}-secret.txt`), { force: true })
  })
  const cookie = `${cookieName(port)}=${KEY}`
  return { base, port, cookie, calls, push: (...a) => push(...a), dist }
}

const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual' })

test('the launch link sets the cookie once the key matches; a wrong key does not', async (t) => {
  const { base, port } = await start(t)
  const bad = await get(`${base}${OPEN_PATH}?key=${'x'.repeat(64)}`)
  assert.equal(bad.status, 403)
  assert.equal(bad.headers.get('set-cookie'), null)

  const ok = await get(`${base}${OPEN_PATH}?key=${KEY}`)
  assert.equal(ok.status, 303)
  assert.equal(ok.headers.get('location'), '/')
  const set = ok.headers.get('set-cookie')
  assert.match(set, new RegExp(`^${cookieName(port)}=`))
  assert.match(set, /HttpOnly/)
  assert.match(set, /SameSite=Strict/)
})

test('without the cookie nothing is served: pages, bridge or ping', async (t) => {
  const { base, calls } = await start(t)
  assert.equal((await get(`${base}/`)).status, 401)
  assert.equal((await get(`${base}/assets/app.js`)).status, 401)
  assert.equal((await get(`${base}${PING_PATH}`)).status, 401)
  assert.equal((await get(`${base}/__bridge/client.js`)).status, 401)
  assert.equal((await get(`${base}/__bridge/events`)).status, 401)
  const res = await fetch(`${base}/__bridge/invoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ moduleId: 'home', method: 'getSummaries' }),
  })
  assert.equal(res.status, 401)
  assert.equal(calls.length, 0)
  // A cookie for another port's copy does not count.
  assert.equal((await get(`${base}/`, { cookie: `${cookieName(1)}=${KEY}` })).status, 401)
})

test('a foreign Host header is refused (DNS rebinding), even with the cookie', async (t) => {
  const { port, cookie } = await start(t)
  const http = require('node:http')
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', headers: { host: `evil.example:${port}`, cookie } }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', reject)
    req.end()
  })
  assert.equal(status, 421)
})

test('with the cookie: index.html gets the hosted bridge client, assets are served, nothing escapes dist', async (t) => {
  const { base, cookie, dist } = await start(t)
  const index = await get(`${base}/`, { cookie })
  assert.equal(index.status, 200)
  assert.equal(index.headers.get('x-frame-options'), 'DENY')
  assert.match(await index.text(), /<head><script src="\/__bridge\/client.js"><\/script>/)

  const js = await get(`${base}/__bridge/client.js`, { cookie })
  const body = await js.text()
  assert.match(body, /"hosted":true/)
  assert.doesNotMatch(body, /"remote":true/)

  const asset = await get(`${base}/assets/app.js`, { cookie })
  assert.equal(asset.status, 200)
  assert.match(asset.headers.get('cache-control'), /immutable/)

  const escape = await get(`${base}/..%2F${path.basename(dist)}-secret.txt`, { cookie })
  assert.equal(escape.status, 404)
  assert.equal((await get(`${base}${PING_PATH}`, { cookie })).status, 200)
})

test('the bridge runs backends only for this server’s own origin', async (t) => {
  const { base, port, cookie, calls } = await start(t)
  const invoke = (origin) =>
    fetch(`${base}/__bridge/invoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, cookie },
      body: JSON.stringify({ moduleId: 'home', method: 'getSummaries', args: { a: 1 } }),
    })
  assert.equal((await invoke('https://evil.example')).status, 403)
  assert.equal(calls.length, 0)

  for (const origin of [base, `http://localhost:${port}`]) {
    const body = decode(await (await invoke(origin)).text())
    assert.equal(body.ok, true)
    assert.ok(body.result.at instanceof Date)
  }
  assert.deepEqual(calls[0], ['home', 'getSummaries', { a: 1 }])
})

test('no built pages: a clear page instead of a crash', async (t) => {
  const { base, cookie, dist } = await start(t)
  fs.rmSync(path.join(dist, 'index.html'))
  const res = await get(`${base}/`, { cookie })
  assert.equal(res.status, 503)
  assert.match(await res.text(), /npm start/)
})

test('a short key is refused; the mode flag follows MONORAIL_HOSTED', () => {
  assert.throws(() => createHostServer({ key: 'short', invoke: async () => {}, distDir: '.' }), /key/)
  const before = process.env.MONORAIL_HOSTED
  try {
    delete process.env.MONORAIL_HOSTED
    assert.equal(isHosted(), false)
    process.env.MONORAIL_HOSTED = '1'
    assert.equal(isHosted(), true)
  } finally {
    if (before === undefined) delete process.env.MONORAIL_HOSTED
    else process.env.MONORAIL_HOSTED = before
  }
  assert.equal(HOST_RESTART_CODE, 75)
})
