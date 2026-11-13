// Repos that other MonoRail apps create, listed in GitHub+ without the user
// having to open them first.
//
// So far: Tasks' private projects repo (<Tasks data>\local-repo, see
// electron/apps/jira-plus/local.cjs) and Notes' repo (modules\notes\repo, see
// electron/modules/notes-store.cjs). It appears in GitHub+'s recent
// repositories as soon as it exists, without being written to recents.json
// (opening it then records it there like any repo). It cannot be removed from
// the list: it goes away when the repo does.
//
// Nothing here moves, copies or creates a folder. The Tasks folder is found
// the same way Tasks finds it (resolveJiraDataDir, legacy module folder
// included), from GitHub+'s own data folder: both are <userData>\apps\<id>.
// No Electron, so tests run under plain Node.

const fs = require('node:fs')
const path = require('node:path')

const git = require('./git.cjs')
const { resolveJiraDataDir } = require('../jira-plus/data-dir.cjs')

const SOURCES = [
  {
    app: 'jira-plus',
    label: 'Tasks',
    name: 'Tasks projects',
    dir: (ghpDataDir) => path.join(resolveJiraDataDir(path.resolve(ghpDataDir, '..', 'jira-plus')), 'local-repo'),
  },
  {
    // Notes' repo (electron/modules/notes-store.cjs): <userData>\modules\notes\repo.
    app: 'notes',
    label: 'Notes',
    name: 'Notes',
    dir: (ghpDataDir) => path.resolve(ghpDataDir, '..', '..', 'modules', 'notes', 'repo'),
  },
]

// Folder -> the path git reports for it (forward slashes on Windows), which is
// how GitHub+ names every repo it opened. One git process per folder per run.
const toplevels = new Map()

function sameFolder(a, b) {
  const norm = (p) => {
    const r = fs.realpathSync.native(p)
    return process.platform === 'win32' ? r.toLowerCase() : r
  }
  try {
    return norm(a) === norm(b)
  } catch {
    return false
  }
}

async function toplevel(dir) {
  if (!toplevels.has(dir)) {
    // The folder must be the repo's root, not a folder inside some other repo.
    const p = git.openRepo(dir).then((info) => {
      if (!sameFolder(info.path, dir)) throw new Error('Not a repository root')
      return info.path
    })
    toplevels.set(dir, p)
    p.catch(() => toplevels.delete(dir))
  }
  return toplevels.get(dir)
}

/**
 * Repos MonoRail's own apps created that exist right now:
 * [{ path, app, label, name }]. A folder that is missing or not (yet) a repo
 * is left out.
 */
async function linkedRepos(ghpDataDir) {
  if (!ghpDataDir) return []
  const found = await Promise.all(
    SOURCES.map(async (s) => {
      const dir = s.dir(ghpDataDir)
      if (!fs.existsSync(path.join(dir, '.git'))) return null
      try {
        return { path: await toplevel(dir), app: s.app, label: s.label, name: s.name }
      } catch {
        return null
      }
    }),
  )
  return found.filter(Boolean)
}

/** Recents first (most recent first), then linked repos the user has not opened recently. */
function mergeRecents(recents, linked) {
  return [...recents, ...linked.map((l) => l.path).filter((p) => !recents.includes(p))]
}

module.exports = { linkedRepos, mergeRecents, _resetForTests: () => toplevels.clear() }
