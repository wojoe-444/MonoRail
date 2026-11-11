// Registry of module and app backends (the main-process half of both contracts).
//
// A backend is { id, methods: { [name]: async (ctx, args) => result } }.
// Module backends live in electron/modules, app backends in electron/apps.
// ctx gives each one its own private data folder under AppData:
//   ctx.dataDir  -> %APPDATA%\Command Hub\modules\<id>   (modules)
//                   %APPDATA%\Command Hub\apps\<id>      (apps)
//                   created on demand
//   ctx.log(...) -> console logging prefixed with the backend id
// The renderer addresses a module as "<id>" and an app as "app:<id>".
// Results must be structured-cloneable (plain JSON is safest).

const fs = require('node:fs')
const path = require('node:path')
const { app, ipcMain } = require('electron')

const moduleBackends = [require('./claude-stats.cjs'), require('./jira.cjs'), require('./settings.cjs')]
const appBackends = require('../apps/index.cjs')

function registerModuleBackends() {
  const byId = new Map([
    ...moduleBackends.map((b) => [b.id, { backend: b, dataDir: ['modules', b.id] }]),
    ...appBackends.map((b) => [`app:${b.id}`, { backend: b, dataDir: ['apps', b.id] }]),
  ])

  ipcMain.handle('module:invoke', async (_event, payload) => {
    const { moduleId, method, args } = payload ?? {}
    const entry = byId.get(moduleId)
    if (!entry) throw new Error(`Unknown module: ${moduleId}`)
    const fn = Object.hasOwn(entry.backend.methods, method) ? entry.backend.methods[method] : undefined
    if (typeof fn !== 'function') throw new Error(`Unknown method ${moduleId}.${method}`)

    const dataDir = path.join(app.getPath('userData'), ...entry.dataDir)
    fs.mkdirSync(dataDir, { recursive: true })
    const ctx = {
      dataDir,
      isPackaged: app.isPackaged,
      log: (...a) => console.log(`[${moduleId}]`, ...a),
    }
    return fn(ctx, args)
  })
}

module.exports = { registerModuleBackends }
