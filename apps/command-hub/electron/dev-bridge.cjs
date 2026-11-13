// Browser dev bridge: runs every module and app backend in a window-less
// Electron process and serves them over HTTP, so `npm run dev:browser` can use
// real local data in a normal browser tab (Chrome DevTools included).
//
// Development only. Started by scripts/dev-browser.cjs, never packaged
// (electron-builder.json excludes it). The Vite dev server proxies
// /__bridge/* here and adds the per-run token; the page itself never sees it.
// The HTTP server itself is shared: electron/bridge/server.cjs.
//
//   POST /__bridge/invoke  { moduleId, method, args } -> { ok, result } | { ok: false, error }
//   GET  /__bridge/events  server-sent events: { channel, payload }
//
// Data lives in its own folder (%APPDATA%\MonoRail Dev by default, or
// MONORAIL_DEV_USER_DATA), never the installed app's %APPDATA%\MonoRail, and
// this process opens no window, so it runs side by side with the installed app.

const path = require('node:path')
const { app } = require('electron')

const PORT = Number(process.env.MONORAIL_BRIDGE_PORT || 5198)
const TOKEN = process.env.MONORAIL_BRIDGE_TOKEN
// Origins of the Vite dev server page. Anything else is refused, so another
// site open in the browser can't reach the backends through the proxy.
const ALLOWED_ORIGINS = new Set(
  (process.env.MONORAIL_BRIDGE_ORIGINS || 'http://localhost:5199,http://127.0.0.1:5199').split(','),
)

if (!TOKEN) {
  console.error('[bridge] MONORAIL_BRIDGE_TOKEN is not set; start it with `npm run dev:browser`.')
  process.exit(1)
}

app.setName('MonoRail Dev')
app.setPath('userData', process.env.MONORAIL_DEV_USER_DATA || path.join(app.getPath('appData'), 'MonoRail Dev'))

const { registerExtensionScheme, onBroadcast } = require('./extensions/index.cjs')
registerExtensionScheme()
const { startModuleBackends } = require('./modules/index.cjs')
const { createBridgeServer, tokenMatches } = require('./bridge/server.cjs')

// No windows here: keep running until the launcher stops us.
app.on('window-all-closed', () => {})

app.whenReady().then(() => {
  const server = createBridgeServer({
    invoke: startModuleBackends(),
    authorize: (req) => tokenMatches(req.headers['x-monorail-bridge-token'], TOKEN),
    allowedOrigins: ALLOWED_ORIGINS,
    subscribe: onBroadcast,
  })

  server.on('error', (err) => {
    console.error(`[bridge] could not listen on 127.0.0.1:${PORT}:`, err.message)
    app.exit(1)
  })
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[bridge] backends ready on 127.0.0.1:${PORT}, data in ${app.getPath('userData')}`)
  })
})
