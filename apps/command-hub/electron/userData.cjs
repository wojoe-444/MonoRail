// Where MonoHub keeps its private data, and the one-time move from the old name.
//
// The app used to be called "Command Hub", so installed copies kept their data
// (Claude Stats cache, Jira local repo and encrypted token, GitHub+ recents and
// backup schedules, window storage) in %APPDATA%\Command Hub. Dev runs used
// %APPDATA%\command-hub. On first start after the rename we move that folder to
// %APPDATA%\MonoHub. A rename on the same drive keeps every file as it is, and
// safeStorage secrets are bound to the Windows user, not the folder, so the
// Jira token still decrypts. If the move can't happen (a file is locked, say),
// we keep using the old folder rather than start empty.
//
// Must run before app 'ready', since Chromium opens files in userData then.

const fs = require('node:fs')
const path = require('node:path')

const APP_NAME = 'MonoHub'
const LEGACY_NAMES = ['Command Hub', 'command-hub']

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

  const legacy = LEGACY_NAMES.map((n) => path.join(appDataDir, n)).find((p) => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  })
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
