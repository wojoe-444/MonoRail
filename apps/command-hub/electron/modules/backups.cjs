// Backups module backend: the global backup folder in Settings > Backups.
// The logic lives in electron/backups (no Electron there, so it is tested
// under Node); this file adds the folder picker and Explorer, and starts the
// global schedule. Settings and run state: <profile>\modules\backups (the
// active profile's folder, electron/profiles; %APPDATA%\MonoRail for the default).

const { BrowserWindow, dialog, shell } = require('electron')

const { createGlobalBackups } = require('../backups/service.cjs')
const inApp = require('../scheduled/in-app.cjs')
const { readGlobal } = require('../backups/global.cjs')
const { appLayout } = require('../profiles/index.cjs')

let service
const get = () => (service ??= createGlobalBackups(appLayout().profileDir, (...a) => console.log('[backups]', ...a)))

/** For the settings backend: back up everything before an update installs (service.cjs runBeforeUpdate). */
const backupBeforeUpdate = (version) => get().runBeforeUpdate(version)

/** What the update UI says about backing up first: 'on' | 'off' | 'no-folder'. */
async function beforeUpdateMode() {
  const g = await readGlobal(appLayout().profileDir)
  if (!g.enabled || !g.folder) return 'no-folder'
  return g.beforeUpdate ? 'on' : 'off'
}

module.exports = {
  id: 'backups',
  backupBeforeUpdate,
  beforeUpdateMode,
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['pickFolder', 'openFolder'],
  start() {
    get().start()
    inApp.registerProvider({
      id: 'backups',
      title: 'Global backups',
      async list() {
        const { settings: g, pages } = await get().status()
        return pages
          .filter((p) => p.id !== 'github-plus')
          .map((p) => {
            const on = g.enabled && p.included
            return {
              id: p.id,
              title: `Back up ${p.title}`,
              description: p.what,
              group: 'Backups',
              schedule: inApp.timesPer(g),
              state: p.running ? 'Running' : on ? 'Ready' : 'Disabled',
              lastRun: p.lastResult?.at,
              nextRun: p.nextDueAt,
              result: p.lastResult ? (p.lastResult.ok ? 'ok' : 'failed') : null,
              note: p.lastResult?.ok === false ? p.lastResult.error : !g.enabled ? 'The global backup folder is off.' : !p.included ? 'Not included in the global backup.' : '',
              where: { label: 'Backups', path: '/settings/backups' },
            }
          })
      },
      run: (id) => get().run(id),
    })
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
      const g = await readGlobal(appLayout().profileDir)
      if (!g.folder) throw new Error('No backup folder is set')
      await require('node:fs/promises').mkdir(g.folder, { recursive: true })
      const err = await shell.openPath(g.folder)
      if (err) throw new Error(err)
      return true
    },
  },
}
