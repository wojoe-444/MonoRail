const test = require('node:test')
const assert = require('node:assert/strict')
const { runInNewContext } = require('node:vm')
const { bridgeClientScript } = require('./client-script.cjs')
const { createBridgeServer, tokenMatches } = require('./server.cjs')
const { decode } = require('./codec.cjs')

const ORIGIN = 'http://localhost:5199'
const TOKEN = 'a'.repeat(64)

async function start(opts = {}) {
  let push
  const calls = []
  const server = createBridgeServer({
    invoke: async (moduleId, method, args) => {
      calls.push([moduleId, method, args])
      if (method === 'boom') throw new Error('kaput')
      return { at: new Date('2026-01-02T03:04:05Z'), args }
    },
    authorize: (req) => tokenMatches(req.headers['x-token'], TOKEN),
    allowedOrigins: new Set([ORIGIN]),
    subscribe: (fn) => (push = fn),
    ...opts,
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  return { server, base, calls, push: (...a) => push(...a) }
}

const post = (base, body, headers = {}) =>
  fetch(`${base}/__bridge/invoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-token': TOKEN, ...headers },
    body: JSON.stringify(body),
  })

test('invokes a backend and keeps Dates through the codec', async (t) => {
  const { server, base, calls } = await start()
  t.after(() => server.close())
  const res = await post(base, { moduleId: 'home', method: 'getSummaries', args: { x: 1 } })
  const body = decode(await res.text())
  assert.equal(body.ok, true)
  assert.ok(body.result.at instanceof Date)
  assert.deepEqual(calls, [['home', 'getSummaries', { x: 1 }]])
})

test('browser and phone clients send built-ins and installed extensions on the same wire', async (t) => {
  const { server, base, calls } = await start()
  t.after(() => server.close())

  for (const remote of [false, true]) {
    const window = {}
    runInNewContext(bridgeClientScript({ platform: 'test', remote }), {
      window,
      fetch: (route, opts) => {
        assert.equal(opts.credentials, 'same-origin')
        return fetch(base + route, { ...opts, headers: { ...opts.headers, 'x-token': TOKEN, origin: ORIGIN } })
      },
    })
    const bridge = window.commandHub
    assert.equal(bridge.platform, 'test')
    assert.equal(remote ? bridge.remote : bridge.devBridge, true)
    const reply = await bridge.invoke('notes', 'get', { id: 'sample' })
    assert.equal(reply.at.toISOString(), '2026-01-02T03:04:05.000Z')
    await bridge.invoke('profiles', 'getProfiles')
    await bridge.invokeExtension('example', 'customMethod', { value: 1 })
  }
  const expected = [
    ['notes', 'get', { id: 'sample' }],
    ['profiles', 'getProfiles', undefined],
    ['ext:example', 'customMethod', { value: 1 }],
  ]
  assert.deepEqual(calls, [...expected, ...expected])
})

test('refuses a wrong token, a foreign origin and a non-JSON body', async (t) => {
  const { server, base, calls } = await start()
  t.after(() => server.close())
  assert.equal((await post(base, { moduleId: 'home', method: 'x' }, { 'x-token': 'nope' })).status, 403)
  assert.equal((await post(base, { moduleId: 'home', method: 'x' }, { origin: 'https://evil.example' })).status, 403)
  assert.equal((await post(base, { moduleId: 'home', method: 'x' }, { 'content-type': 'text/plain' })).status, 415)
  assert.equal((await fetch(`${base}/__bridge/events`)).status, 403)
  assert.deepEqual(calls, [])
})

test('backend errors come back as { ok: false }', async (t) => {
  const { server, base } = await start()
  t.after(() => server.close())
  const body = decode(await (await post(base, { moduleId: 'home', method: 'boom' })).text())
  assert.deepEqual(body, { ok: false, error: { message: 'kaput', name: 'Error' } })
})

test('canInvoke can refuse a call before it runs', async (t) => {
  const { server, base, calls } = await start({ canInvoke: (m, method) => (method === 'pick' ? 'Do this on your PC.' : undefined) })
  t.after(() => server.close())
  const body = decode(await (await post(base, { moduleId: 'backups', method: 'pick' })).text())
  assert.equal(body.ok, false)
  assert.equal(body.error.message, 'Do this on your PC.')
  assert.deepEqual(calls, [])
})

test('streams pushed events to subscribers', async (t) => {
  const { server, base, push } = await start()
  t.after(() => server.close())
  const ac = new AbortController()
  t.after(() => ac.abort())
  const res = await fetch(`${base}/__bridge/events`, { headers: { 'x-token': TOKEN }, signal: ac.signal })
  assert.equal(res.status, 200)
  const reader = res.body.getReader()
  const text = new TextDecoder()
  let seen = ''
  while (!seen.includes(': connected')) seen += text.decode((await reader.read()).value)
  push('extension:changed', { n: 1 })
  while (!seen.includes('data: ')) seen += text.decode((await reader.read()).value)
  const line = seen.split('\n').find((l) => l.startsWith('data: '))
  assert.deepEqual(decode(line.slice(6)), { channel: 'extension:changed', payload: { n: 1 } })
})

test('tokenMatches compares in constant time and rejects missing values', () => {
  assert.equal(tokenMatches(TOKEN, TOKEN), true)
  assert.equal(tokenMatches('b'.repeat(64), TOKEN), false)
  assert.equal(tokenMatches(undefined, TOKEN), false)
  assert.equal(tokenMatches(TOKEN, undefined), false)
  assert.equal(tokenMatches('short', TOKEN), false)
})
