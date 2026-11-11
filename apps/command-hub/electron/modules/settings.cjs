// Settings module backend: app info and in-app updates.
//
// Updates come from GitHub Releases of the public wojoe-444/MonoRail repo
// (see "publish" in electron-builder.json). CI publishes a release, with the
// NSIS installer and latest.yml, on every push to main. electron-updater reads
// latest.yml, downloads the new installer, and runs it silently on restart.
//
// The module contract is request/response, so the page polls getStatus while a
// download is running instead of subscribing to events.

const { app } = require('electron')

/** Updates need the installed (NSIS) build: dev runs and the portable .exe can't self-update. */
function updateSupport() {
  if (!app.isPackaged) return { supported: false, reason: 'Updates work in the installed app, not in development.' }
  if (process.env.PORTABLE_EXECUTABLE_DIR)
    return { supported: false, reason: 'This is the portable .exe, which cannot update itself. Install MonoRail with the setup .exe to get updates.' }
  if (process.platform !== 'win32') return { supported: false, reason: 'Updates are only set up for Windows.' }
  return { supported: true }
}

const status = {
  state: 'idle', // idle | checking | available | not-available | downloading | downloaded | error
  latestVersion: undefined,
  releaseDate: undefined,
  releaseNotes: undefined,
  progress: undefined, // { percent, transferred, total, bytesPerSecond }
  error: undefined,
  lastChecked: undefined,
}

let updater
let restartWhenDownloaded = false
function getUpdater() {
  if (updater) return updater
  // Required lazily so dev runs and the portable build never touch it.
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () => set({ state: 'checking', error: undefined }))
  autoUpdater.on('update-available', (info) => set({ state: 'available', ...fromInfo(info) }))
  autoUpdater.on('update-not-available', (info) => set({ state: 'not-available', ...fromInfo(info) }))
  autoUpdater.on('download-progress', (p) =>
    set({
      state: 'downloading',
      progress: { percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond },
    }),
  )
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'downloaded', progress: undefined, ...fromInfo(info) })
    // "Download and restart": install as soon as the download lands.
    if (restartWhenDownloaded) setTimeout(() => autoUpdater.quitAndInstall(true, true), 1500)
  })
  autoUpdater.on('error', (err) => set({ state: 'error', progress: undefined, error: message(err) }))
  updater = autoUpdater
  return updater
}

function set(patch) {
  Object.assign(status, patch)
}

function fromInfo(info) {
  if (!info) return {}
  const notes = Array.isArray(info.releaseNotes)
    ? info.releaseNotes.map((n) => n.note).filter(Boolean).join('\n\n')
    : info.releaseNotes
  return { latestVersion: info.version, releaseDate: info.releaseDate, releaseNotes: notes || undefined }
}

function message(err) {
  const text = err instanceof Error ? err.message : String(err)
  // electron-updater errors can include whole HTTP responses; keep the first line.
  return text.split('\n')[0].slice(0, 300)
}

function snapshot() {
  const support = updateSupport()
  return {
    currentVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    dataDir: app.getPath('userData'),
    updatesSupported: support.supported,
    unsupportedReason: support.reason,
    ...status,
  }
}

module.exports = {
  id: 'settings',
  methods: {
    async getStatus() {
      return snapshot()
    },

    async checkForUpdates() {
      if (!updateSupport().supported) return snapshot()
      if (status.state === 'downloading' || status.state === 'downloaded') return snapshot()
      try {
        set({ state: 'checking', error: undefined })
        await getUpdater().checkForUpdates()
      } catch (err) {
        set({ state: 'error', error: message(err) })
      }
      set({ lastChecked: new Date().toISOString() })
      return snapshot()
    },

    async downloadUpdate() {
      if (!updateSupport().supported || status.state !== 'available') return snapshot()
      restartWhenDownloaded = true
      set({ state: 'downloading', progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 } })
      // Don't hold the IPC call for the whole download; the page polls getStatus.
      getUpdater()
        .downloadUpdate()
        .catch((err) => set({ state: 'error', progress: undefined, error: message(err) }))
      return snapshot()
    },

    async installAndRestart() {
      if (status.state !== 'downloaded') return snapshot()
      // Let the IPC reply go out before the app quits.
      setTimeout(() => getUpdater().quitAndInstall(true, true), 250)
      return snapshot()
    },
  },
}
