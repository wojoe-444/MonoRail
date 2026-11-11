// Registry of module and app backends (the main-process half of both contracts).
//
// A backend is { id, methods: { [name]: async (ctx, args) => result } }.
// Module backends live in electron/modules, app backends in electron/apps.
// ctx gives each one its own private data folder under AppData:
//   ctx.dataDir  -> %APPDATA%\MonoRail\modules\<id>   (modules)
//                   %APPDATA%\MonoRail\apps\<id>      (apps)
//                   created on demand
//   ctx.rootDir  -> %APPDATA%\MonoRail (only Home reads across folders, for summaries)
//   ctx.log(...) -> console logging prefixed with the backend id
// Every file a backend keeps in its folder, and every cache, is declared in
// electron/cache/declared.cjs (see docs/caching.md).
// The renderer addresses a module as "<id>", an app as "app:<id>" and an
// installed extension's backend as "ext:<id>" (electron/extensions; those run
// in their own sandboxed process, not here).
// Results must be structured-cloneable (plain JSON is safest).

const fs = require('node:fs')
const path = require('node:path')
const { app, ipcMain } = require('electron')

const moduleBackends = [
  require('./agent-catalog.cjs'),
  require('./agent-chat.cjs'),
  require('./agents.cjs'),
  require('./backups.cjs'),
  require('./claude-stats.cjs'),
  require('./connections.cjs'),
  require('./flashcards.cjs'),
  require('./home.cjs'),
  require('./mcp.cjs'),
  require('./settings.cjs'),
  require('./storage.cjs'),
]
const appBackends = require('../apps/index.cjs')
const { setupExtensions, invokeExtension } = require('../extensions/index.cjs')
const { auditAll } = require('../cache/index.cjs')

/**
 * Start every backend and return invoke(moduleId, method, args), the router the
 * IPC handler below uses. The browser dev bridge (electron/dev-bridge.cjs)
 * calls it over HTTP instead. Call once, after app 'ready'.
 */
function startModuleBackends() {
  const extensionsBackend = setupExtensions()
  const byId = new Map([
    [extensionsBackend.id, { backend: extensionsBackend, dataDir: ['modules', extensionsBackend.id] }],
    ...moduleBackends.map((b) => [b.id, { backend: b, dataDir: ['modules', b.id] }]),
    ...appBackends.map((b) => [`app:${b.id}`, { backend: b, dataDir: ['apps', b.id] }]),
  ])

  // Backends may export start(ctx) for work that runs without the page open
  // (e.g. GitHub+'s backup scheduler). Called once, after the app is ready.
  for (const [key, entry] of byId) {
    if (typeof entry.backend.start !== 'function') continue
    try {
      entry.backend.start(makeCtx(key, entry))
    } catch (err) {
      console.error(`[${key}] start failed`, err)
    }
  }

  // A1: report files nobody declared (a warning, never a delete).
  void auditAll(app.getPath('userData')).catch(() => {})

  return async function invoke(moduleId, method, args) {
    if (typeof moduleId === 'string' && moduleId.startsWith('ext:')) return invokeExtension(moduleId.slice(4), method, args)
    const entry = byId.get(moduleId)
    if (!entry) throw new Error(`Unknown module: ${moduleId}`)
    const fn = Object.hasOwn(entry.backend.methods, method) ? entry.backend.methods[method] : undefined
    if (typeof fn !== 'function') throw new Error(`Unknown method ${moduleId}.${method}`)

    return fn(makeCtx(moduleId, entry), args)
  }
}

function registerModuleBackends() {
  const invoke = startModuleBackends()
  ipcMain.handle('module:invoke', async (_event, payload) => {
    const { moduleId, method, args } = payload ?? {}
    return invoke(moduleId, method, args)
  })
}

function makeCtx(key, entry) {
  const dataDir = path.join(app.getPath('userData'), ...entry.dataDir)
  fs.mkdirSync(dataDir, { recursive: true })
  return {
    dataDir,
    rootDir: app.getPath('userData'),
    isPackaged: app.isPackaged,
    log: (...a) => console.log(`[${key}]`, ...a),
  }
}

module.exports = { registerModuleBackends, startModuleBackends }
