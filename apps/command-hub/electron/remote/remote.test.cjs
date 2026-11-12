// Remote access (docs/remote-access.md): store, pairing, Tailscale parsing,
// the phone-safe policy and the real HTTP server, all under plain Node.
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRemoteStore, describeAgent, cleanLogin } = require('./store.cjs')
const { createRemoteServer, createPairing, COOKIE, PAIR_PATH } = require('./server.cjs')
const { parseStatus, parseServe, checkTailscale } = require('./tailscale.cjs')
const { REMOTE_DENY, remoteRefusal, isQuiet } = require('./policy.cjs')
const { readEnabledSync } = require('./service.cjs')
const { decode } = require('../bridge/codec.cjs')


const http = require('node:http')

/** fetch() can't set Host, so requests go through http.request. */
function fetch(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(url, { method, headers }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (text += c))
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          headers: { get: (k) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : (v ?? null) } },
          text: async () => text,
        }),
      )
    })
    r.on('error', reject)
    if (body) r.end(body)
    else r.end()
  })
}

const HOST = 'monorail-pc.tail0000.ts.net'
const ORIGIN = `https://${HOST}`
const LOGIN = 'you@example.com'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'monorail-remote-'))

async function start({ agentFromPhone = false } = {}) {
  const dir = tmp()
  const dist = path.join(dir, 'dist')
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>')
  fs.writeFileSync(path.join(dist, 'assets', 'app.js'), 'console.log(1)')
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'nope')
  const store = createRemoteStore(path.join(dir, 'remote'))
  const settings = await store.writeSettings({ enabled: true, allowedLogins: [LOGIN], agentFromPhone })
  const pairing = createPairing()
  const calls = []
  const server = createRemoteServer({
    store,
    state: () => ({ settings, dnsName: HOST }),
    pairing,
    invoke: async (moduleId, method, args) => {
      calls.push([moduleId, method, args])
      return { ok: true }
    },
    isDesktopOnly: (m, method) => m === 'backups' && method === 'pickFolder',
    distDir: dist,
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const close = () => new Promise((r) => server.close(r))
  return { dir, store, pairing, calls, base, close }
}

const headers = (extra = {}) => ({ host: HOST, 'tailscale-user-login': LOGIN, ...extra })

async function pairDevice(t, name = 'Phone') {
  const { code } = t.pairing.start()
  const res = await fetch(`${t.base}${PAIR_PATH}`, {
    method: 'POST',
    headers: headers({ origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36' }),
    body: new URLSearchParams({ code, name }).toString(),
  })
  return res
}

function keyFrom(res) {
  const m = new RegExp(`${COOKIE}=([^;]+)`).exec(res.headers.get('set-cookie') ?? '')
  return m && decodeURIComponent(m[1])
}

const invoke = (t, key, body, extra = {}) =>
  fetch(`${t.base}/__bridge/invoke`, {
    method: 'POST',
    headers: headers({ origin: ORIGIN, 'content-type': 'application/json', cookie: `${COOKIE}=${encodeURIComponent(key)}`, ...extra }),
    body: JSON.stringify(body),
  })

test('pairing: a code works once, then the device reaches the app with its cookie', async () => {
  const t = await start()
  try {
    const res = await pairDevice(t)
    assert.equal(res.status, 303)
    const cookie = res.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /Secure/)
    assert.match(cookie, /SameSite=Strict/)
    const key = keyFrom(res)
    assert.ok(key && key.length > 30)

    const { devices } = await t.store.listDevices()
    assert.equal(devices.length, 1)
    assert.equal(devices[0].name, 'Phone')
    assert.equal(devices[0].agent, 'Chrome on Android')
    assert.equal(devices[0].keyHash, undefined, 'the page never sees key hashes')
    const raw = fs.readFileSync(path.join(t.store.dir, 'devices.json'), 'utf8')
    assert.ok(!raw.includes(key), 'the key itself is never stored')

    // The same code again is refused.
    const again = await fetch(`${t.base}${PAIR_PATH}`, {
      method: 'POST',
        headers: headers({ origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }),
      body: 'code=whatever&name=x',
    })
    assert.equal(again.status, 400)

    const page = await fetch(`${t.base}/`, { headers: headers({ cookie: `${COOKIE}=${encodeURIComponent(key)}` }) })
    assert.equal(page.status, 200)
    const html = await page.text()
    assert.match(html, /<head><script src="\/__bridge\/client.js"><\/script>/)
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/)

    const js = await fetch(`${t.base}/__bridge/client.js`, { headers: headers({ cookie: `${COOKIE}=${encodeURIComponent(key)}` }) })
    assert.match(await js.text(), /remote: true/)

    const r = await invoke(t, key, { moduleId: 'claude-stats', method: 'getReport', args: {} })
    assert.equal(r.status, 200)
    assert.deepEqual(decode(await r.text()), { ok: true, result: { ok: true } })
  } finally {
    await t.close()
  }
})

test('pairing refuses a post from another origin', async () => {
  const t = await start()
  try {
    const { code } = t.pairing.start()
    const res = await fetch(`${t.base}${PAIR_PATH}`, {
      method: 'POST',
        headers: headers({ origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' }),
      body: `code=${code}`,
    })
    assert.equal(res.status, 403)
    assert.equal((await t.store.listDevices()).devices.length, 0)
  } finally {
    await t.close()
  }
})

test('refused: wrong host, no login, wrong login, no cookie, wrong cookie, wrong origin', async () => {
  const t = await start()
  try {
    const key = keyFrom(await pairDevice(t))
    const c = { cookie: `${COOKIE}=${encodeURIComponent(key)}` }
    assert.equal((await fetch(`${t.base}/`, { headers: { ...headers(c), host: 'evil.example' } })).status, 421)
    assert.equal((await fetch(`${t.base}/`, { headers: { host: HOST, ...c } })).status, 403)
    assert.equal((await fetch(`${t.base}/`, { headers: headers({ ...c, 'tailscale-user-login': 'someone@else.example' }) })).status, 403)
    assert.equal((await fetch(`${t.base}/`, { headers: headers() })).status, 401)
    assert.equal((await fetch(`${t.base}/`, { headers: headers({ cookie: `${COOKIE}=${'x'.repeat(43)}` }) })).status, 401)
    const noCookie = await fetch(`${t.base}/__bridge/invoke`, { method: 'POST', headers: headers({ origin: ORIGIN, 'content-type': 'application/json' }), body: '{}' })
    assert.equal(noCookie.status, 401)
    const badOrigin = await invoke(t, key, { moduleId: 'claude-stats', method: 'getReport' }, { origin: 'https://evil.example' })
    assert.equal(badOrigin.status, 403)
    assert.equal(t.calls.length, 0)
  } finally {
    await t.close()
  }
})

test('desktop-only and denied methods are refused and logged; startTurn gets Ask-only limits', async () => {
  const t = await start()
  try {
    const key = keyFrom(await pairDevice(t))
    const pick = decode(await (await invoke(t, key, { moduleId: 'backups', method: 'pickFolder' })).text())
    assert.equal(pick.ok, false)
    assert.match(pick.error.message, /PC screen/)
    const deny = decode(await (await invoke(t, key, { moduleId: 'connections', method: 'save' })).text())
    assert.equal(deny.ok, false)
    const self = decode(await (await invoke(t, key, { moduleId: 'remote', method: 'revokeDevice' })).text())
    assert.equal(self.ok, false)
    const ext = decode(await (await invoke(t, key, { moduleId: 'ext:hello', method: 'anything' })).text())
    assert.equal(ext.ok, false)
    assert.equal(t.calls.length, 0)

    await invoke(t, key, { moduleId: 'agent-chat', method: 'startTurn', args: { prompt: 'hi', remoteLimits: { askOnly: false } } })
    assert.deepEqual(t.calls[0][2].remoteLimits, { askOnly: true }, 'the page cannot lift the limit')

    // Give the fire-and-forget audit writes a moment.
    await new Promise((r) => setTimeout(r, 50))
    const audit = await t.store.readAudit()
    const refused = audit.filter((a) => a.outcome === 'refused').map((a) => `${a.module}.${a.method}`)
    assert.deepEqual(refused.sort(), ['backups.pickFolder', 'connections.save', 'ext:hello.anything', 'remote.revokeDevice'])
    assert.ok(audit.some((a) => a.module === 'agent-chat' && a.method === 'startTurn' && a.outcome === 'ok'))
    assert.ok(audit.some((a) => a.module === 'remote' && a.method === 'pair'))
    assert.ok(!JSON.stringify(audit).includes('hi"'), 'never arguments')
  } finally {
    await t.close()
  }
})

test('Agent mode from the phone lifts only the Ask-only limit', async () => {
  const t = await start({ agentFromPhone: true })
  try {
    const key = keyFrom(await pairDevice(t))
    await invoke(t, key, { moduleId: 'agent-chat', method: 'startTurn', args: {} })
    assert.deepEqual(t.calls[0][2].remoteLimits, { askOnly: false })
  } finally {
    await t.close()
  }
})

test('revoking a device signs it out at once', async () => {
  const t = await start()
  try {
    const key = keyFrom(await pairDevice(t))
    const c = { cookie: `${COOKIE}=${encodeURIComponent(key)}` }
    assert.equal((await fetch(`${t.base}/`, { headers: headers(c) })).status, 200)
    const [d] = (await t.store.listDevices()).devices
    await t.store.revokeDevice(d.id)
    assert.equal((await fetch(`${t.base}/`, { headers: headers(c) })).status, 401)
  } finally {
    await t.close()
  }
})

test('static files never escape the built app folder', async () => {
  const t = await start()
  try {
    const key = keyFrom(await pairDevice(t))
    const c = { cookie: `${COOKIE}=${encodeURIComponent(key)}` }
    assert.equal((await fetch(`${t.base}/assets/app.js`, { headers: headers(c) })).status, 200)
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/assets/..%2f..%2fsecret.txt']) {
      const res = await fetch(`${t.base}${p}`, { headers: headers(c) })
      assert.notEqual(res.status, 200, p)
      assert.ok(!(await res.text()).includes('nope'), p)
    }
  } finally {
    await t.close()
  }
})

test('pairing codes expire, work once and only the newest counts', () => {
  let now = 1000
  const p = createPairing({ ttlMs: 100, now: () => now })
  const a = p.start()
  const b = p.start()
  assert.equal(p.take(a.code), false)
  assert.equal(p.take(b.code), true)
  assert.equal(p.take(b.code), false)
  const c = p.start()
  now += 101
  assert.equal(p.active(), undefined)
  assert.equal(p.take(c.code), false)
})

test('store: damaged files are never overwritten', async () => {
  const dir = tmp()
  const store = createRemoteStore(dir)
  fs.writeFileSync(path.join(dir, 'settings.json'), '{oops')
  const s = await store.readSettings()
  assert.equal(s.enabled, false)
  assert.equal(s.damaged, true)
  await assert.rejects(() => store.writeSettings({ enabled: true }), /damaged/)
  assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), '{oops')
  fs.writeFileSync(path.join(dir, 'devices.json'), 'nope')
  await assert.rejects(() => store.addDevice({ name: 'x' }), /damaged/)
  await store.revokeAll()
  assert.equal(fs.readFileSync(path.join(dir, 'devices.json'), 'utf8'), 'nope')
})

test('store: off by default, logins cleaned, readEnabledSync reads the machine folder', async () => {
  const userData = tmp()
  const store = createRemoteStore(path.join(userData, 'modules', 'remote'))
  assert.equal((await store.readSettings()).enabled, false)
  assert.equal(readEnabledSync(userData), false)
  const s = await store.writeSettings({ enabled: true, allowedLogins: [' You@Example.com ', 'not a login', 'dev@github'] })
  assert.deepEqual(s.allowedLogins, ['you@example.com', 'dev@github'])
  assert.equal(readEnabledSync(userData), true)
  assert.equal(cleanLogin('a b@c'), undefined)
  assert.equal(describeAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Version/18.0 Mobile Safari/604.1'), 'Safari on iOS')
})

test('tailscale: status and serve parsing, Funnel detection', async () => {
  const status = JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'Monorail-PC.tail0000.ts.net.', UserID: 7 }, User: { 7: { LoginName: 'You@Example.com' } } })
  assert.deepEqual(parseStatus(status), { state: 'running', dnsName: HOST, login: LOGIN, backendState: 'Running' })
  assert.equal(parseStatus('{"BackendState":"Stopped"}').state, 'stopped')
  assert.equal(parseStatus('nope').state, 'error')

  const web = { Web: { [`${HOST}:443`]: { Handlers: { '/': { Proxy: 'http://127.0.0.1:5170' } } } } }
  assert.deepEqual(parseServe(JSON.stringify(web), 5170), { serve: 'ok', funnel: false, host: `${HOST}:443` })
  assert.equal(parseServe(JSON.stringify({ ...web, AllowFunnel: { [`${HOST}:443`]: true } }), 5170).funnel, true)
  assert.equal(parseServe(JSON.stringify(web), 5171).serve, 'other')
  assert.equal(parseServe('', 5170).serve, 'missing')
  const fg = { Foreground: { abc: { ...web, AllowFunnel: { [`${HOST}:443`]: true } } } }
  assert.deepEqual(parseServe(JSON.stringify(fg), 5170).funnel, true)

  const run = async (cmd, args) => (args[0] === 'status' ? { code: 0, stdout: status } : { code: 0, stdout: JSON.stringify(web) })
  const check = await checkTailscale(5170, { run })
  assert.equal(check.serve, 'ok')
  assert.equal(check.login, LOGIN)
  assert.deepEqual(await checkTailscale(5170, { run: async () => ({ notFound: true }) }), { state: 'missing' })
})

test('policy: refusals and quiet reads', () => {
  const desk = (m, x) => m === 'storage' && x === 'openLocation'
  assert.match(remoteRefusal('storage', 'openLocation', desk), /PC screen/)
  assert.match(remoteRefusal('remote', 'getStatus', desk), /stay on the PC/)
  assert.match(remoteRefusal('developer', 'anything', desk), /stay on the PC/)
  assert.equal(remoteRefusal('claude-stats', 'getReport', desk), undefined)
  assert.equal(remoteRefusal('agent-chat', 'startTurn', desk), undefined)
  assert.equal(isQuiet('getReport'), true)
  assert.equal(isQuiet('pollTurn'), true)
  assert.equal(isQuiet('startTurn'), false)
})

test('every REMOTE_DENY entry names a real backend method', () => {
  const electronDir = path.join(__dirname, '..')
  const index = fs.readFileSync(path.join(electronDir, 'modules', 'index.cjs'), 'utf8')
  const start = index.indexOf('const moduleBackends = [')
  const block = index.slice(start, index.indexOf(']', start))
  const backends = new Map()
  for (const m of block.matchAll(/require\('\.\/([\w-]+\.cjs)'\)/g)) {
    const b = require(path.join(electronDir, 'modules', m[1]))
    backends.set(b.id, Object.keys(b.methods))
  }
  for (const b of require(path.join(electronDir, 'apps', 'index.cjs'))) backends.set(`app:${b.id}`, Object.keys(b.methods))
  // The extensions backend lives in electron/extensions: read its method names from the source.
  const extSrc = fs.readFileSync(path.join(electronDir, 'extensions', 'index.cjs'), 'utf8')
  const missing = []
  for (const [id, names] of Object.entries(REMOTE_DENY)) {
    if (id === 'extensions') {
      for (const n of names) if (!new RegExp(`\\b${n}\\b\\s*[:(]`).test(extSrc)) missing.push(`${id}.${n}`)
      continue
    }
    const methods = backends.get(id)
    if (!methods) {
      missing.push(id)
      continue
    }
    for (const n of names) if (n !== '*' && !methods.includes(n)) missing.push(`${id}.${n}`)
  }
  assert.deepEqual(missing, [])
})
