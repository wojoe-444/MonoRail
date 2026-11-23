// The self-hosted mode's HTTP server (docs/guide/setup/run-from-source.md):
// MonoRail's built pages plus every backend, for a browser tab on this PC.
// Started by electron/host.cjs; no Electron dependency, so tests run it under
// Node.
//
// Listens on 127.0.0.1 only. Every request must name this server as its Host
// (127.0.0.1:<port> or localhost:<port>, so a DNS-rebinding page can't reach
// it), and carry the session cookie. The cookie is handed out once per browser
// by GET /__host/open?key=<launch key>, the link the launcher opens; the key is
// random per launch and lives only in the launcher's and the host's memory.
// Backend calls must also come from this server's own origin (bridge/server.cjs).
//
//   GET  /__host/open?key=...  sets the cookie, then sends the browser to /
//   GET  /__host/ping          { ok: true } (the page waits on it after a restart)
//   GET  /__bridge/client.js   window.commandHub over HTTP (hosted: true)
//   POST /__bridge/invoke, GET /__bridge/events  the bridge
//   anything else              a file of dist/ (index.html gets the client script)

const http = require('node:http')
const { createBridgeHandler, tokenMatches, send } = require('../bridge/server.cjs')
const { bridgeClientScript } = require('../bridge/client-script.cjs')
const { serveDist, TYPES } = require('../bridge/static.cjs')

const OPEN_PATH = '/__host/open'
const PING_PATH = '/__host/ping'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60

// The pages run as they do in MonoRail's window (which has no CSP), so only
// headers that change nothing for the app itself: no framing, no sniffing, no
// referrer to the sites it links to.
const HEADERS = {
  'content-security-policy': "frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

/** The cookie's name carries the port: cookies are shared by every port of a host. */
const cookieName = (port) => `monorail_host_${port}`

function cookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        // A cookie that isn't ours, badly encoded: ignore it.
      }
    }
  }
  return out
}

/** A small page with no scripts, for refusals. */
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · MonoRail</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#f8f6f1;color:#2b2925;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border-radius:14px;box-shadow:0 0 0 1px rgba(0,0,0,.08);padding:28px;max-width:460px;margin:16px}
h1{font-size:20px;margin:0 0 8px}p{color:#5f5b53;margin:0 0 12px}code{font-size:14px}</style></head>
<body><main><h1>${title}</h1>${body}</main></body></html>`
}

function sendHtml(res, status, html, extra = {}) {
  res.writeHead(status, { ...HEADERS, 'content-type': TYPES['.html'], 'cache-control': 'no-store', ...extra })
  res.end(html)
}

const SIGN_IN_AGAIN =
  '<p>Open MonoRail with the link its start window shows, or start it again (double-click <code>Start MonoRail.cmd</code>, or run <code>npm start</code>). The link changes every time MonoRail starts.</p>'

/**
 * @param {object} o
 * @param {string} o.key the launch key (random per launch)
 * @param {(moduleId: string, method: string, args: unknown) => Promise<unknown>} o.invoke
 * @param {(fn: (channel: string, payload: unknown) => void) => void} [o.subscribe] push channel source
 * @param {string} o.distDir the built web app
 * @param {string} [o.platform]
 * @returns {http.Server} not yet listening; it learns its port from listen()
 */
function createHostServer({ key, invoke, subscribe, distDir, platform = process.platform }) {
  if (typeof key !== 'string' || key.length < 32) throw new TypeError('key must be a random string of at least 32 characters')
  const clientJs = bridgeClientScript({ platform, hosted: true })

  let server
  const port = () => server.address()?.port
  const ownHosts = () => [`127.0.0.1:${port()}`, `localhost:${port()}`]
  const origins = () => new Set(ownHosts().map((h) => `http://${h}`))

  const bridge = createBridgeHandler({ invoke: (moduleId, method, args) => invoke(moduleId, method, args), allowedOrigins: origins, subscribe })

  server = http.createServer(async (req, res) => {
    try {
      const host = String(req.headers.host ?? '').toLowerCase()
      if (!ownHosts().includes(host)) return send(res, 421, { ok: false, error: { message: 'Wrong host' } })
      const url = new URL(req.url, 'http://host')

      if (url.pathname === OPEN_PATH) {
        if (req.method !== 'GET') return send(res, 405, { ok: false, error: { message: 'Method not allowed' } })
        if (!tokenMatches(url.searchParams.get('key') ?? '', key)) {
          return sendHtml(res, 403, page('That link has expired', SIGN_IN_AGAIN))
        }
        res.writeHead(303, {
          ...HEADERS,
          'set-cookie': `${cookieName(port())}=${encodeURIComponent(key)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict`,
          location: '/',
          'cache-control': 'no-store',
        })
        return res.end()
      }

      if (!tokenMatches(cookies(req)[cookieName(port())], key)) {
        if (url.pathname.startsWith('/__')) return send(res, 401, { ok: false, error: { message: 'Open MonoRail from its start link.' } })
        return sendHtml(res, 401, page('Open MonoRail from its start link', SIGN_IN_AGAIN))
      }

      if (req.method === 'GET' && url.pathname === PING_PATH) return send(res, 200, { ok: true })
      if (req.method === 'GET' && url.pathname === '/__bridge/client.js') {
        res.writeHead(200, { ...HEADERS, 'content-type': TYPES['.js'], 'cache-control': 'no-store' })
        return res.end(clientJs)
      }
      if (await bridge.handle(req, res)) return
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: { message: 'Method not allowed' } })
      return await serveDist(res, {
        distDir,
        urlPath: url.pathname,
        headers: HEADERS,
        headTag: '<script src="/__bridge/client.js"></script>',
        notBuilt: (r) => sendHtml(r, 503, page('MonoRail is not built', '<p>Start MonoRail with <code>npm start</code> (or <code>Start MonoRail.cmd</code>), which builds it first.</p>')),
      })
    } catch (err) {
      if (!res.headersSent) send(res, 500, { ok: false, error: { message: 'Something went wrong' } })
      else res.end()
      console.error('[host] request failed:', err?.message)
    }
  })
  server.on('close', () => bridge.closeStreams())
  return server
}

module.exports = { createHostServer, cookieName, OPEN_PATH, PING_PATH }
