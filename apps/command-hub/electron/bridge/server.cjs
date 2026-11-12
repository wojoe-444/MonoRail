// The HTTP bridge: serves the module/app backends' invoke(moduleId, method, args)
// and the push channels over HTTP, for a page that has no Electron preload.
//
// Used by the browser dev bridge (electron/dev-bridge.cjs) and, through
// createBridgeHandler, by the optional Remote access server (electron/remote).
// Requiring this file starts nothing: a server exists only when a caller
// creates one and listens.
//
//   POST /__bridge/invoke  { moduleId, method, args } -> { ok, result } | { ok: false, error }
//   GET  /__bridge/events  server-sent events: { channel, payload }
//
// Every request must pass authorize(req). Invokes must also come from one of
// allowedOrigins, so another site open in the same browser can't call the
// backends. canInvoke(moduleId, method) may refuse a call with a message.

const crypto = require('node:crypto')
const http = require('node:http')
const { encode } = require('./codec.cjs')

const DEFAULT_MAX_BODY = 50 * 1024 * 1024
const PING_MS = 25_000

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : encode(body))
}

function readBody(req, maxBody) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBody) {
        reject(new Error('Request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Constant-time comparison of a request's token with the expected one. */
function tokenMatches(given, expected) {
  if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * The bridge routes as a request handler, for a server that also serves other
 * routes (Remote access serves the app's files beside them). It does not check
 * who is asking: the caller authorizes first.
 *
 * @param {object} opts
 * @param {(moduleId: string, method: string, args: unknown, req: http.IncomingMessage) => Promise<unknown>} opts.invoke
 * @param {Set<string> | ((req: http.IncomingMessage) => Set<string>)} opts.allowedOrigins
 * @param {(listener: (channel: string, payload: unknown) => void) => void} [opts.subscribe] push channel source
 * @param {(moduleId: string, method: string) => string | undefined} [opts.canInvoke] a refusal message, or undefined to allow
 * @param {number} [opts.maxBody]
 * @returns {{ handle(req, res): Promise<boolean>, closeStreams(): void }} handle answers true when it took the request
 */
function createBridgeHandler({ invoke, allowedOrigins, subscribe, canInvoke, maxBody = DEFAULT_MAX_BODY }) {
  if (typeof invoke !== 'function') throw new TypeError('invoke is required')
  const origins = typeof allowedOrigins === 'function' ? allowedOrigins : () => allowedOrigins
  if (typeof allowedOrigins !== 'function' && (!(allowedOrigins instanceof Set) || allowedOrigins.size === 0)) {
    throw new TypeError('allowedOrigins must be a non-empty Set')
  }

  const clients = new Set()
  const unsubscribe = subscribe?.((channel, payload) => {
    const line = `data: ${encode({ channel, payload })}\n\n`
    for (const res of clients) res.write(line)
  })

  async function handle(req, res) {
    const url = new URL(req.url, 'http://bridge')

    if (req.method === 'GET' && url.pathname === '/__bridge/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      res.write(': connected\n\n')
      clients.add(res)
      const ping = setInterval(() => res.write(': ping\n\n'), PING_MS)
      req.on('close', () => {
        clearInterval(ping)
        clients.delete(res)
      })
      return true
    }

    if (req.method === 'POST' && url.pathname === '/__bridge/invoke') {
      if (!origins(req).has(req.headers.origin)) {
        send(res, 403, { ok: false, error: { message: 'Origin not allowed' } })
        return true
      }
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
        send(res, 415, { ok: false, error: { message: 'Expected JSON' } })
        return true
      }
      try {
        const { moduleId, method, args } = JSON.parse(await readBody(req, maxBody))
        if (typeof moduleId !== 'string' || typeof method !== 'string') throw new Error('moduleId and method are required')
        const refusal = canInvoke?.(moduleId, method)
        if (refusal) {
          send(res, 200, { ok: false, error: { message: refusal, name: 'BridgeRefused' } })
          return true
        }
        const result = await invoke(moduleId, method, args, req)
        send(res, 200, { ok: true, result: result ?? null })
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        send(res, 200, { ok: false, error: { message: e.message, name: e.name } })
      }
      return true
    }
    return false
  }

  function closeStreams() {
    for (const res of clients) res.end()
    clients.clear()
    if (typeof unsubscribe === 'function') unsubscribe()
  }

  return { handle, closeStreams }
}

/**
 * A server with only the bridge routes; every request must pass authorize(req).
 * @param {object} opts the options of createBridgeHandler, plus
 * @param {(req: http.IncomingMessage) => boolean} opts.authorize
 * @returns {http.Server} not yet listening
 */
function createBridgeServer({ authorize, ...opts }) {
  if (typeof authorize !== 'function') throw new TypeError('authorize is required')
  const bridge = createBridgeHandler(opts)
  const server = http.createServer(async (req, res) => {
    let allowed = false
    try {
      allowed = authorize(req) === true
    } catch {
      allowed = false
    }
    if (!allowed) return send(res, 403, { ok: false, error: { message: 'Forbidden' } })
    if (await bridge.handle(req, res)) return
    send(res, 404, { ok: false, error: { message: 'Not found' } })
  })
  server.on('close', () => bridge.closeStreams())
  return server
}

module.exports = { createBridgeServer, createBridgeHandler, tokenMatches, send }
