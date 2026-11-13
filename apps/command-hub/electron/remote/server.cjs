// The Remote access HTTP server (docs/remote-access.md). Listens on 127.0.0.1
// only; Tailscale serve forwards the PC's tailnet HTTPS address to it. Every
// request must carry an allowed Tailscale login (the header Tailscale serve
// adds) and, except for the pairing page, a paired device's key cookie.
//
// No Electron dependency: the service hands in invoke, the desktop-only check
// and the push channel source, so tests run it under Node.

const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const http = require('node:http')
const path = require('node:path')
const { createBridgeHandler, send } = require('../bridge/server.cjs')
const { bridgeClientScript } = require('../bridge/client-script.cjs')
const { remoteRefusal, isQuiet } = require('./policy.cjs')

const COOKIE = 'monorail_device'
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60 // the most browsers keep a cookie
const PAIR_PATH = '/__remote/pair'
const MAX_FORM = 4 * 1024
const TOUCH_EVERY_MS = 60_000

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' data: blob: about:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

function cookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** A small self-contained page (no scripts) for pairing and refusals. */
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · MonoRail</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#f8f6f1;color:#2b2925;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border-radius:14px;box-shadow:0 0 0 1px rgba(0,0,0,.08);padding:28px;max-width:420px;margin:16px}
h1{font-size:20px;margin:0 0 8px}p{color:#5f5b53;margin:0 0 16px}label{display:block;font-size:14px;font-weight:600;margin-bottom:6px}
input{width:100%;box-sizing:border-box;font:inherit;padding:10px 12px;border:1px solid #d9d4c8;border-radius:10px;margin-bottom:16px}
button{font:inherit;font-weight:600;background:#5e4a1f;color:#fff;border:0;border-radius:10px;padding:12px 16px;width:100%}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`
}

function sendHtml(res, status, html, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra })
  res.end(html)
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (c) => {
      body += c
      if (body.length > MAX_FORM) {
        reject(new Error('Too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(new URLSearchParams(body)))
    req.on('error', reject)
  })
}

/**
 * @param {object} o
 * @param {ReturnType<import('./store.cjs').createRemoteStore>} o.store
 * @param {() => { settings: object, dnsName?: string }} o.state current settings and the tailnet name
 * @param {{ take(code: string): boolean }} o.pairing one-time pairing codes
 * @param {(moduleId: string, method: string, args: unknown) => Promise<unknown>} o.invoke
 * @param {(moduleId: string, method: string) => boolean} o.isDesktopOnly
 * @param {(fn: (channel: string, payload: unknown) => void) => void} [o.subscribe]
 * @param {string} o.distDir the built web app
 * @param {string} [o.platform]
 * @param {(entry: object) => void} [o.onPaired]
 */
function createRemoteServer({ store, state, pairing, invoke, isDesktopOnly, subscribe, distDir, platform = process.platform, onPaired }) {
  const clientJs = bridgeClientScript({ platform, remote: true })
  const touched = new Map()

  const allowedHost = (req) => {
    const { settings, dnsName } = state()
    const host = String(req.headers.host ?? '').toLowerCase()
    const loopback = [`127.0.0.1:${settings.port}`, `localhost:${settings.port}`]
    return (dnsName && (host === dnsName || host === `${dnsName}:443`)) || loopback.includes(host)
  }
  const origins = () => {
    const { dnsName } = state()
    return new Set(dnsName ? [`https://${dnsName}`] : ['https://invalid.invalid'])
  }

  async function remoteInvoke(moduleId, method, args, req) {
    const device = req.remoteDevice
    const started = Date.now()
    const { settings } = state()
    const log = (outcome, extra = {}) =>
      void store.appendAudit({ device: device.name, deviceId: device.id, module: moduleId, method, outcome, ms: Date.now() - started, ...extra }).catch(() => {})
    const refusal = moduleId.startsWith('ext:') ? 'Extension pages are not available on the phone yet.' : remoteRefusal(moduleId, method, isDesktopOnly)
    if (refusal) {
      log('refused', { reason: refusal })
      const err = new Error(refusal)
      err.name = 'BridgeRefused'
      throw err
    }
    let callArgs = args
    // The phone's limits ride on the turn request; the page can't remove them.
    if (moduleId === 'agent-chat' && method === 'startTurn') {
      callArgs = { ...(args && typeof args === 'object' ? args : {}), remoteLimits: { askOnly: !settings.agentFromPhone } }
    }
    try {
      const result = await invoke(moduleId, method, callArgs)
      if (!isQuiet(method)) log('ok')
      return result
    } catch (err) {
      log('error')
      throw err
    }
  }

  const bridge = createBridgeHandler({ invoke: remoteInvoke, allowedOrigins: origins, subscribe })

  async function serveFile(req, res, urlPath) {
    let rel
    try {
      rel = decodeURIComponent(urlPath)
    } catch {
      return send(res, 400, { ok: false, error: { message: 'Bad path' } })
    }
    if (rel === '/' || rel === '') rel = '/index.html'
    const root = path.resolve(distDir)
    const file = path.resolve(root, `.${rel}`)
    if (file !== root && !file.startsWith(root + path.sep)) return send(res, 404, { ok: false, error: { message: 'Not found' } })
    let data
    try {
      data = await fs.readFile(file)
    } catch {
      if (rel === '/index.html') return sendHtml(res, 503, page('MonoRail is not built', '<p>This copy of MonoRail has no built pages to show. Run <code>npm run build</code> on the PC.</p>'))
      return send(res, 404, { ok: false, error: { message: 'Not found' } })
    }
    const ext = path.extname(file).toLowerCase()
    if (rel === '/index.html') {
      const html = data.toString('utf8').replace(/<head>/i, '<head><script src="/__bridge/client.js"></script>')
      res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': TYPES['.html'], 'cache-control': 'no-store' })
      return res.end(html)
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': rel.startsWith('/assets/') ? 'private, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(data)
  }

  async function handlePair(req, res, url) {
    if (req.method === 'GET') {
      const code = url.searchParams.get('code') ?? ''
      return sendHtml(
        res,
        200,
        page(
          'Pair this device',
          `<p>This lets this device use MonoRail on your PC. You can sign it out any time in Settings &gt; Remote access on the PC.</p>
<form method="post" action="${PAIR_PATH}"><input type="hidden" name="code" value="${escapeHtml(code)}">
<label for="name">Name this device</label><input id="name" name="name" maxlength="40" value="Phone" autocomplete="off">
<button type="submit">Pair this device</button></form>`,
        ),
      )
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: { message: 'Method not allowed' } })
    if (!origins().has(req.headers.origin)) return sendHtml(res, 403, page('Not allowed', '<p>Open the pairing link on the device you want to pair.</p>'))
    let form
    try {
      form = await readForm(req)
    } catch {
      return send(res, 413, { ok: false, error: { message: 'Too large' } })
    }
    if (!pairing.take(form.get('code') ?? '')) {
      return sendHtml(res, 400, page('That code has expired', '<p>Pairing codes work once, for two minutes. Press "Pair a phone" on your PC again and scan the new code.</p>'))
    }
    const { device, key } = await store.addDevice({ name: form.get('name'), agent: req.headers['user-agent'] })
    void store.appendAudit({ device: device.name, deviceId: device.id, module: 'remote', method: 'pair', outcome: 'ok', ms: 0 }).catch(() => {})
    onPaired?.(device)
    res.writeHead(303, {
      ...SECURITY_HEADERS,
      'set-cookie': `${COOKIE}=${encodeURIComponent(key)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
      location: '/',
      'cache-control': 'no-store',
    })
    res.end()
  }

  const server = http.createServer(async (req, res) => {
    try {
      const { settings } = state()
      if (!allowedHost(req)) return send(res, 421, { ok: false, error: { message: 'Wrong host' } })
      const login = String(req.headers['tailscale-user-login'] ?? '').trim().toLowerCase()
      if (!login || !settings.allowedLogins.includes(login)) {
        return sendHtml(res, 403, page('Not allowed', '<p>This Tailscale account may not open MonoRail. Add it under Settings &gt; Remote access on the PC.</p>'))
      }
      const url = new URL(req.url, 'http://remote')
      if (url.pathname === PAIR_PATH) return await handlePair(req, res, url)

      const device = await store.deviceForKey(cookies(req)[COOKIE])
      if (!device) {
        if (url.pathname.startsWith('/__bridge/')) return send(res, 401, { ok: false, error: { message: 'This device is not paired.' } })
        return sendHtml(res, 401, page('This device is not paired', '<p>On your PC, open Settings &gt; Remote access, press "Pair a phone" and scan the code with this device.</p>'))
      }
      req.remoteDevice = device
      if (Date.now() - (touched.get(device.id) ?? 0) > TOUCH_EVERY_MS) {
        touched.set(device.id, Date.now())
        void store.touchDevice(device.id).catch(() => {})
      }

      if (req.method === 'GET' && url.pathname === '/__bridge/client.js') {
        res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': TYPES['.js'], 'cache-control': 'no-store' })
        return res.end(clientJs)
      }
      if (await bridge.handle(req, res)) return
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false, error: { message: 'Method not allowed' } })
      return await serveFile(req, res, url.pathname)
    } catch (err) {
      if (!res.headersSent) send(res, 500, { ok: false, error: { message: 'Something went wrong' } })
      else res.end()
      console.error('[remote] request failed:', err?.message)
    }
  })
  server.on('close', () => bridge.closeStreams())
  return server
}

/** One-time pairing codes, two minutes each, one at a time. */
function createPairing({ ttlMs = 120_000, now = Date.now } = {}) {
  let current
  return {
    start() {
      current = { code: crypto.randomBytes(18).toString('base64url'), expiresAt: now() + ttlMs }
      return { ...current }
    },
    cancel() {
      current = undefined
    },
    active() {
      return current && current.expiresAt > now() ? { expiresAt: current.expiresAt } : undefined
    },
    /** True once for the current code before it expires. */
    take(code) {
      if (!current || typeof code !== 'string' || code.length !== current.code.length) return false
      const ok = current.expiresAt > now() && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(current.code))
      if (ok) current = undefined
      return ok
    },
  }
}

module.exports = { createRemoteServer, createPairing, COOKIE, PAIR_PATH }
