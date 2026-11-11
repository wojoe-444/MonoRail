// Where MonoRail keeps its private data.
//
// The app was first "Command Hub", then briefly "MonoHub", and is now
// "MonoRail", so a user's data can sit in any of these %APPDATA% folders:
// command-hub (Electron's default, from package.json "name"), Command Hub,
// MonoHub or MonoRail. Each holds everything: Claude Stats cache, Jira local
// repo and encrypted token (safeStorage's key is in the folder's "Local
// State"), GitHub+ recents, settings and backup schedules, localStorage.
//
// We never move, rename or copy these folders: an earlier version renamed the
// old folder on startup and that caused trouble. Instead we use the existing
// folder that holds data, newest name first, and only create MonoRail on a
// machine that has none of them.
//
// Must run before app 'ready', since Chromium opens files in userData then.

const fs = require('node:fs')
const path = require('node:path')

const APP_NAME = 'MonoRail'
// Newest first: if several hold data, the most recent name wins.
const DATA_FOLDER_NAMES = [APP_NAME, 'MonoHub', 'command-hub', 'Command Hub']

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function holdsData(dir) {
  return isDir(path.join(dir, 'modules')) || isDir(path.join(dir, 'apps')) || fs.existsSync(path.join(dir, 'Local State'))
}

/**
 * Pick the data folder under appDataDir without touching the filesystem.
 * Pure so it can be tested without Electron.
 */
function resolveUserDataDir(appDataDir) {
  const existing = DATA_FOLDER_NAMES.map((n) => path.join(appDataDir, n)).filter(isDir)
  return existing.find(holdsData) ?? existing[0] ?? path.join(appDataDir, APP_NAME)
}

/** Point Electron at the right folder. Call at the top of main.cjs. */
function setupUserData(app) {
  app.setName(APP_NAME)
  const dir = resolveUserDataDir(app.getPath('appData'))
  app.setPath('userData', dir)
  return dir
}

module.exports = { APP_NAME, DATA_FOLDER_NAMES, resolveUserDataDir, setupUserData }
