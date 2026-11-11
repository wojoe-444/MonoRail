// Where MonoRail keeps its private data, and the one-time move from old names.
//
// The app was first "Command Hub", then briefly "MonoHub", and is now
// "MonoRail". Electron first named its data folder after package.json "name"
// (%APPDATA%\command-hub); the MonoHub release moved it to %APPDATA%\MonoHub.
// That folder holds everything: Claude Stats cache, Jira local repo and
// encrypted token, GitHub+ recents, settings and backup schedules, localStorage.
// On first start we move whichever old folder holds data to %APPDATA%\MonoRail.
// Moving the whole folder matters: on Windows, safeStorage's key lives in the
// folder's "Local State" file (itself protected by DPAPI for the Windows user),
// so the Jira token decrypts only if Local State moves with connection.json.
// If the move can't happen (a file is locked, say), we keep using the old
// folder rather than start empty.
//
// Must run before app 'ready', since Chromium opens files in userData then.

const fs = require('node:fs')
const path = require('node:path')

const APP_NAME = 'MonoRail'
// Newest first: if several exist, the most recent one with data wins.
const LEGACY_NAMES = ['MonoHub', 'command-hub', 'Command Hub']

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Pick the data folder under appDataDir, moving a legacy folder into place if
 * needed. Pure filesystem logic so it can be tested without Electron.
 * Returns { dir, migratedFrom?, error? }.
 */
function resolveUserDataDir(appDataDir, { rename = fs.renameSync, attempts = 5, delayMs = 400 } = {}) {
  const target = path.join(appDataDir, APP_NAME)
  if (fs.existsSync(target)) return { dir: target }

  const isDir = (p) => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  }
  const candidates = LEGACY_NAMES.map((n) => path.join(appDataDir, n)).filter(isDir)
  // Prefer a folder that actually holds module or app data over an empty one.
  const legacy =
    candidates.find((p) => isDir(path.join(p, 'modules')) || isDir(path.join(p, 'apps'))) ?? candidates[0]
  if (!legacy) return { dir: target }

  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      rename(legacy, target)
      return { dir: target, migratedFrom: legacy }
    } catch (err) {
      lastError = err
      // The previous version may still be shutting down after an update.
      if (i < attempts - 1) sleep(delayMs)
    }
  }
  return { dir: legacy, error: lastError }
}

/** Point Electron at the right folder. Call at the top of main.cjs. */
function setupUserData(app) {
  app.setName(APP_NAME)
  const result = resolveUserDataDir(app.getPath('appData'))
  app.setPath('userData', result.dir)
  if (result.migratedFrom) console.log(`[userData] moved ${result.migratedFrom} -> ${result.dir}`)
  if (result.error) console.warn(`[userData] could not move legacy data, using ${result.dir}:`, result.error.message)
  return result
}

module.exports = { APP_NAME, LEGACY_NAMES, resolveUserDataDir, setupUserData }
