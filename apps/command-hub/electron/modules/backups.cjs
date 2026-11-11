// Backups module backend: the global backup folder in Settings > Backups.
// The logic lives in electron/backups (no Electron there, so it is tested
// under Node); this file adds the folder picker and Explorer, and starts the
// global schedule. Settings and run state: %APPDATA%\MonoRail\modules\backups.

const { BrowserWindow, app, dialog, shell } = require('electron')

const { createGlobalBackups } = require('../backups/service.cjs')
const { readGlobal } = require('../backups/global.cjs')

let service
const get = () => (service ??= createGlobalBackups(app.getPath('userData'), (...a) => console.log('[backups]', ...a)))

module.exports = {
  id: 'backups',
  start() {
    get().start()
  },
  methods: {
    getStatus: () => get().status(),
    save: (_ctx, { settings } = {}) => get().save(settings),
    runAll: () => get().runAll(),
    async pickFolder() {
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Choose the global backup folder', properties: ['openDirectory', 'createDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : r.filePaths[0]
    },
    /** Open the saved global folder in Explorer (never a path from the page). */
    async openFolder() {
      const g = await readGlobal(app.getPath('userData'))
      if (!g.folder) throw new Error('No backup folder is set')
      await require('node:fs/promises').mkdir(g.folder, { recursive: true })
      const err = await shell.openPath(g.folder)
      if (err) throw new Error(err)
      return true
    },
  },
}
