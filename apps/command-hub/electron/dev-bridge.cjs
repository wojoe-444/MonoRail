// Browser dev bridge: runs every module and app backend in a window-less
// Electron process and serves them over HTTP, so `npm run dev:browser` can use
// real local data in a normal browser tab (Chrome DevTools included).
//
// Development only. Started by scripts/dev-browser.cjs, never packaged
// (electron-builder.json excludes it). The Vite dev server proxies
// /__bridge/* here and adds the per-run token; the page itself never sees it.
//
//   POST /__bridge/invoke  { moduleId, method, args } -> { ok, result } | { ok: false, error }
//   GET  /__bridge/events  server-sent events: { channel, payload }
//
// Data lives in its own folder (%APPDATA%\MonoRail Dev by default, or
// MONORAIL_DEV_USER_DATA), never the installed app's %APPDATA%\MonoRail, and
// this process opens no window, so it runs side by side with the installed app.

const http = require('node:http')
const path = require('node:path')
const { app } = require('electron')

const PORT = Number(process.env.MONORAIL_BRIDGE_PORT || 5198)
const TOKEN = process.env.MONORAIL_BRIDGE_TOKEN
// Origins of the Vite dev server page. Anything else is refused, so another
// site open in the browser can't reach the backends through the proxy.
const ALLOWED_ORIGINS = new Set(
  (process.env.MONORAIL_BRIDGE_ORIGINS || 'http://localhost:5199,http://127.0.0.1:5199').split(','),
)
const MAX_BODY = 50 * 1024 * 1024

if (!TOKEN) {
  console.error('[bridge] MONORAIL_BRIDGE_TOKEN is not set; start it with `npm run dev:browser`.')
  process.exit(1)
}

app.setName('MonoRail Dev')
app.setPath('userData', process.env.MONORAIL_DEV_USER_DATA || path.join(app.getPath('appData'), 'MonoRail Dev'))

const { registerExtensionScheme, onBroadcast } = require('./extensions/index.cjs')
registerExtensionScheme()
const { startModuleBackends } = require('./modules/index.cjs')
const { encode } = require('./dev-bridge-codec.cjs')

// No windows here: keep running until the launcher stops us.
app.on('window-all-closed', () => {})

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(typeof body === 'string' ? body : encode(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('Request too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

app.whenReady().then(() => {
  const invoke = startModuleBackends()
  const clients = new Set()
  onBroadcast((channel, payload) => {
    const line = `data: ${encode({ channel, payload })}\n\n`
    for (const res of clients) res.write(line)
  })

  const server = http.createServer(async (req, res) => {
    if (req.headers['x-monorail-bridge-token'] !== TOKEN) return send(res, 403, { ok: false, error: { message: 'Forbidden' } })
    const url = new URL(req.url, 'http://bridge')

    if (req.method === 'GET' && url.pathname === '/__bridge/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
      res.write(': connected\n\n')
      clients.add(res)
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
      req.on('close', () => {
        clearInterval(ping)
        clients.delete(res)
      })
      return
    }

    if (req.method === 'POST' && url.pathname === '/__bridge/invoke') {
      if (!ALLOWED_ORIGINS.has(req.headers.origin)) return send(res, 403, { ok: false, error: { message: 'Origin not allowed' } })
      try {
        const { moduleId, method, args } = JSON.parse(await readBody(req))
        const result = await invoke(moduleId, method, args)
        return send(res, 200, { ok: true, result: result ?? null })
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        return send(res, 200, { ok: false, error: { message: e.message, name: e.name } })
      }
    }

    send(res, 404, { ok: false, error: { message: 'Not found' } })
  })

  server.on('error', (err) => {
    console.error(`[bridge] could not listen on 127.0.0.1:${PORT}:`, err.message)
    app.exit(1)
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[bridge] backends ready on 127.0.0.1:${PORT}, data in ${app.getPath('userData')}`)
  })
})
