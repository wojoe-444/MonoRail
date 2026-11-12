// Settings module backend: app info and in-app updates.
//
// Updates come from GitHub Releases of the public wojoe-444/MonoRail repo
// (see "publish" in electron-builder.json). CI publishes a release, with the
// NSIS installer and latest.yml, on every push to main. electron-updater reads
// latest.yml, downloads the new installer, and runs it silently on restart.
//
// The module contract is request/response, so the page polls getStatus while a
// download is running instead of subscribing to events.
//
// Background check: start() checks once shortly after startup and then every
// few hours, the same check as the Settings button. The update pop-up
// (src/modules/settings/UpdateToast.tsx) reads getStatus and offers the
// update; its "Ignore for six hours" snooze is kept in the renderer.
//
// Back up before updating: when the global backup folder is on (Settings >
// Backups) and its "Back up before updating" switch is too (the default),
// everything is backed up into <folder>/before-update/ after the download and
// before the installer runs (state 'backing-up'). If that backup fails the
// update waits ('backup-failed') until the user tries again or chooses to
// update without it. With no folder set nothing is backed up and the update
// is never held up.

const { app, net } = require('electron')
const { changesSince } = require('../release-notes.cjs')

// The repo of the "publish" block in electron-builder.json.
const RELEASES_API = 'https://api.github.com/repos/wojoe-444/MonoRail/releases'

/** Updates need the installed (NSIS) build: dev runs and the portable .exe can't self-update. */
function updateSupport() {
  if (!app.isPackaged) return { supported: false, reason: 'Updates work in the installed app, not in development.' }
  if (process.env.PORTABLE_EXECUTABLE_DIR)
    return { supported: false, reason: 'This is the portable .exe, which cannot update itself. Install MonoRail with the setup .exe to get updates.' }
  if (process.platform !== 'win32') return { supported: false, reason: 'Updates are only set up for Windows.' }
  return { supported: true }
}

const status = {
  state: 'idle', // idle | checking | available | not-available | downloading | downloaded | backing-up | backup-failed | error
  latestVersion: undefined,
  releaseDate: undefined,
  releaseNotes: undefined,
  // What changed between the installed and the latest version, newest first:
  // [{ version, date, items: [{ title, text, pr }] }] (see release-notes.cjs).
  changes: undefined,
  progress: undefined, // { percent, transferred, total, bytesPerSecond }
  error: undefined,
  lastChecked: undefined,
  // The last "back up before updating" result (service.cjs runBeforeUpdate), this run only.
  backup: undefined,
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
  autoUpdater.on('update-available', (info) => {
    set({ state: 'available', ...fromInfo(info), ...(info?.version !== changesFor ? { changes: undefined } : {}) })
    loadChanges(info?.version).catch(() => {})
  })
  autoUpdater.on('update-not-available', (info) => set({ state: 'not-available', ...fromInfo(info) }))
  autoUpdater.on('download-progress', (p) =>
    set({
      state: 'downloading',
      progress: { percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond },
    }),
  )
  autoUpdater.on('update-downloaded', (info) => {
    set({ state: 'downloaded', progress: undefined, ...fromInfo(info) })
    // "Download and restart": back up, then install as soon as the download lands.
    if (restartWhenDownloaded) backupThenInstall().catch(() => {})
  })
  autoUpdater.on('error', (err) => set({ state: 'error', progress: undefined, error: message(err) }))
  updater = autoUpdater
  return updater
}

const backups = () => require('./backups.cjs')

let installing = false
/** Back up (when set up), then quit and run the installer. Holds the update if the backup fails. */
async function backupThenInstall({ skipBackup = false } = {}) {
  if (installing) return
  installing = true
  try {
    if (!skipBackup) {
      set({ state: 'backing-up', backup: undefined })
      let result
      try {
        result = await backups().backupBeforeUpdate(status.latestVersion)
      } catch (err) {
        result = { ok: false, at: new Date().toISOString(), error: message(err), items: [] }
      }
      set({ backup: result })
      if (!result.ok) {
        set({ state: 'backup-failed' })
        installing = false
        return
      }
    }
    set({ state: 'downloaded' })
    // Let the IPC reply and the pop-up's "Restarting" go out before the app quits.
    setTimeout(() => getUpdater().quitAndInstall(true, true), 1500)
  } catch (err) {
    installing = false
    set({ state: 'error', error: message(err) })
  }
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

// The release list is public; one request per new version found, kept in memory.
let changesFor
async function loadChanges(latest) {
  if (!latest || changesFor === latest) return
  changesFor = latest
  const current = app.getVersion()
  const releases = []
  for (let page = 1; page <= 3; page++) {
    const res = await net.fetch(`${RELEASES_API}?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MonoRail-updater' },
    })
    if (!res.ok) {
      changesFor = undefined
      return
    }
    const batch = await res.json()
    if (!Array.isArray(batch)) break
    releases.push(...batch)
    const reachedCurrent = changesSince(batch, '0', current).length > 0
    if (batch.length < 100 || reachedCurrent) break
  }
  if (status.latestVersion === latest) set({ changes: changesSince(releases, current, latest) })
}

function message(err) {
  const text = err instanceof Error ? err.message : String(err)
  // electron-updater errors can include whole HTTP responses; keep the first line.
  return text.split('\n')[0].slice(0, 300)
}

async function snapshot() {
  const support = updateSupport()
  let backupBeforeUpdate = 'no-folder'
  try {
    backupBeforeUpdate = await backups().beforeUpdateMode()
  } catch {
    /* treated as no folder */
  }
  return {
    backupBeforeUpdate,
    currentVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    dataDir: app.getPath('userData'),
    updatesSupported: support.supported,
    unsupportedReason: support.reason,
    ...status,
  }
}

/** First background check after startup, then one every few hours. */
const FIRST_CHECK_MS = 30 * 1000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

let checking
async function checkForUpdates() {
  if (!updateSupport().supported) return snapshot()
  if (['downloading', 'downloaded', 'backing-up', 'backup-failed'].includes(status.state)) return snapshot()
  if (checking) return checking
  checking = (async () => {
    try {
      set({ state: 'checking', error: undefined })
      await getUpdater().checkForUpdates()
    } catch (err) {
      set({ state: 'error', error: message(err) })
    }
    set({ lastChecked: new Date().toISOString() })
    return snapshot()
  })().finally(() => {
    checking = undefined
  })
  return checking
}

module.exports = {
  id: 'settings',
  start() {
    if (!updateSupport().supported) return
    const run = () => checkForUpdates().catch(() => {})
    setTimeout(run, FIRST_CHECK_MS).unref?.()
    setInterval(run, CHECK_EVERY_MS).unref?.()
  },
  methods: {
    async getStatus() {
      return snapshot()
    },

    async checkForUpdates() {
      return checkForUpdates()
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

    /** Install a downloaded update, backing up first when set up. Also "Try again" after a failed backup. */
    async installAndRestart() {
      if (status.state !== 'downloaded' && status.state !== 'backup-failed') return snapshot()
      backupThenInstall().catch(() => {})
      return snapshot()
    },

    /** After a failed backup, the user's explicit choice to update anyway. */
    async installWithoutBackup() {
      if (status.state !== 'backup-failed') return snapshot()
      backupThenInstall({ skipBackup: true }).catch(() => {})
      return snapshot()
    },
  },
}
