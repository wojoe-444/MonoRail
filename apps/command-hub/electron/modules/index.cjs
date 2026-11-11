// Registry of module backends (the main-process half of the module contract).
//
// A backend is { id, methods: { [name]: async (ctx, args) => result } }.
// ctx gives each module its own private data folder under AppData:
//   ctx.dataDir  -> %APPDATA%\Command Hub\modules\<id>   (created on demand)
//   ctx.log(...) -> console logging prefixed with the module id
// Results must be structured-cloneable (plain JSON is safest).

const fs = require('node:fs')
const path = require('node:path')
const { app, ipcMain } = require('electron')

const backends = [require('./claude-stats.cjs')]

function registerModuleBackends() {
  const byId = new Map(backends.map((b) => [b.id, b]))

  ipcMain.handle('module:invoke', async (_event, payload) => {
    const { moduleId, method, args } = payload ?? {}
    const backend = byId.get(moduleId)
    if (!backend) throw new Error(`Unknown module: ${moduleId}`)
    const fn = backend.methods[method]
    if (typeof fn !== 'function') throw new Error(`Unknown method ${moduleId}.${method}`)

    const dataDir = path.join(app.getPath('userData'), 'modules', moduleId)
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
