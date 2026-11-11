// Which folder holds Jira+'s data. Kept apart from index.cjs (which needs
// Electron) so the MCP server (electron/mcp) can read the local projects too.
//
// <appDir> is %APPDATA%\MonoRail\apps\jira-plus. Before Jira+ was an app it
// was the "jira" module, whose data lives in ...\modules\jira. If that folder
// holds data and the new one doesn't, keep using the old one in place. It is
// never moved or copied (see "names that must not change" in CLAUDE.md).

const fs = require('node:fs')
const path = require('node:path')

const CONNECTION_FILE = 'connection.json'
const LEGACY_DIR = ['..', '..', 'modules', 'jira']

function holdsData(dir) {
  return ['local-repo', CONNECTION_FILE].some((f) => fs.existsSync(path.join(dir, f)))
}

/** The folder to use for Jira+ data, given its app data folder. Touches nothing. */
function resolveJiraDataDir(appDir) {
  const legacy = path.resolve(appDir, ...LEGACY_DIR)
  return !holdsData(appDir) && holdsData(legacy) ? legacy : appDir
}

module.exports = { resolveJiraDataDir, CONNECTION_FILE }
