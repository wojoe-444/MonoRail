// Registry of module and app backends (the main-process half of both contracts).
//
// A backend is { id, methods: { [name]: async (ctx, args) => result } }.
// Module backends live in electron/modules, app backends in electron/apps.
// ctx gives each one its own private data folder under AppData, in the active
// profile's folder or the machine folder by the folder's scope
// (electron/profiles, docs/profiles.md):
//   ctx.dataDir    -> <root>\modules\<id>   (modules)
//                     <root>\apps\<id>      (apps)
//                     created on demand. For the default profile <root> is
//                     %APPDATA%\MonoRail, as it always was.
//   ctx.profile    -> { id, name } of the active profile
//   ctx.layout     -> resolves any folder by scope: layout.folder('modules/x')
//   ctx.profileDir -> the active profile's data root
//   ctx.machineDir -> %APPDATA%\MonoRail (machine-wide data)
//   ctx.rootDir    -> same as profileDir (kept for older backends)
//   ctx.log(...) -> console logging prefixed with the backend id
// Every file a backend keeps in its folder, and every cache, is declared in
// electron/cache/declared.cjs (see docs/caching.md).
// The renderer addresses a module as "<id>", an app as "app:<id>" and an
// installed extension's backend as "ext:<id>" (electron/extensions; those run
// in their own sandboxed process, not here).
// Results must be structured-cloneable (plain JSON is safest).

const fs = require('node:fs')
const { app, ipcMain } = require('electron')

const moduleBackends = [
  require('./agent-catalog.cjs'),
  require('./agent-chat.cjs'),
  require('./agents.cjs'),
  require('./backups.cjs'),
  require('./claude-stats.cjs'),
  require('./connections.cjs'),
  require('./developer.cjs'),
  require('./docker.cjs'),
  require('./flashcards.cjs'),
  require('./home.cjs'),
  require('./mcp.cjs'),
  require('./notes.cjs'),
  require('./profiles.cjs'),
  require('./settings.cjs'),
  require('./storage.cjs'),
]
const appBackends = require('../apps/index.cjs')
const { setupExtensions, invokeExtension } = require('../extensions/index.cjs')
const { auditAll } = require('../cache/index.cjs')
const { profiles } = require('../profiles/index.cjs')
const { desktopOnlyIndex } = require('../bridge/desktop-only.cjs')

/**
 * Start every backend and return invoke(moduleId, method, args), the router the
 * IPC handler below uses. The browser dev bridge (electron/dev-bridge.cjs)
 * calls it over HTTP instead. Call once, after app 'ready'.
 * invoke.isDesktopOnly(moduleId, method) says whether a method needs this PC's
 * screen (a backend's `desktopOnly` list, electron/bridge/desktop-only.cjs).
 */
function startModuleBackends() {
  const extensionsBackend = setupExtensions()
  const byId = new Map([
    [extensionsBackend.id, { backend: extensionsBackend, folder: `modules/${extensionsBackend.id}` }],
    ...moduleBackends.map((b) => [b.id, { backend: b, folder: `modules/${b.id}` }]),
    ...appBackends.map((b) => [`app:${b.id}`, { backend: b, folder: `apps/${b.id}` }]),
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
  void auditAll(profiles().layout()).catch(() => {})

  const desktopOnly = desktopOnlyIndex([...byId].map(([key, entry]) => [key, entry.backend]))

  async function invoke(moduleId, method, args) {
    if (typeof moduleId === 'string' && moduleId.startsWith('ext:')) return invokeExtension(moduleId.slice(4), method, args)
    const entry = byId.get(moduleId)
    if (!entry) throw new Error(`Unknown module: ${moduleId}`)
    const fn = Object.hasOwn(entry.backend.methods, method) ? entry.backend.methods[method] : undefined
    if (typeof fn !== 'function') throw new Error(`Unknown method ${moduleId}.${method}`)

    return fn(makeCtx(moduleId, entry), args)
  }
  invoke.isDesktopOnly = desktopOnly.isDesktopOnly
  return invoke
}

function registerModuleBackends() {
  const invoke = startModuleBackends()
  ipcMain.handle('module:invoke', async (_event, payload) => {
    const { moduleId, method, args } = payload ?? {}
    return invoke(moduleId, method, args)
  })
}

function makeCtx(key, entry) {
  const store = profiles()
  const layout = store.layout()
  const { id, name } = store.active()
  const dataDir = layout.folder(entry.folder)
  fs.mkdirSync(dataDir, { recursive: true })
  return {
    dataDir,
    profile: { id, name },
    layout,
    profileDir: layout.profileDir,
    machineDir: layout.machineDir,
    rootDir: layout.profileDir,
    isPackaged: app.isPackaged,
    log: (...a) => console.log(`[${key}]`, ...a),
  }
}

module.exports = { registerModuleBackends, startModuleBackends }
