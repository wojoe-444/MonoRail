// Allowed folders for Agent Chat.
//
// A chat may only live in an allowed repo: a git repo directly under the
// configured Repos folder (default ~/Repos), or a repo the user added in the
// page's Folders dialog. Every check resolves real paths again (fs.realpath is
// native, so it follows symlinks and Windows junctions, and removes "..") and
// never trusts a path from the renderer: the page only ever names a session by
// id, and the backend looks up its folder from the session log.
//
// The settings live in the module's data folder (folders.json), never in the repo.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SETTINGS_FILE = 'folders.json'
const win = process.platform === 'win32'

function norm(p) {
  return win ? p.toLowerCase() : p
}

function samePath(a, b) {
  return norm(a) === norm(b)
}

/** True if `child` is `parent` or inside it. Both must already be real paths. */
function isInside(parent, child) {
  const p = norm(parent)
  const c = norm(child)
  if (p === c) return true
  const withSep = p.endsWith(path.sep) ? p : p + path.sep
  return c.startsWith(withSep)
}

async function real(p) {
  if (typeof p !== 'string' || !p || !path.isAbsolute(p)) return undefined
  try {
    return await fs.promises.realpath(p)
  } catch {
    return undefined
  }
}

async function isGitRepo(dir) {
  try {
    await fs.promises.stat(path.join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

async function readSettings(dataDir) {
  try {
    const raw = JSON.parse(await fs.promises.readFile(path.join(dataDir, SETTINGS_FILE), 'utf8'))
    return {
      reposRoot: typeof raw.reposRoot === 'string' ? raw.reposRoot : undefined,
      repos: Array.isArray(raw.repos) ? raw.repos.filter((r) => typeof r === 'string') : [],
    }
  } catch {
    return { reposRoot: undefined, repos: [] }
  }
}

async function writeSettings(dataDir, settings) {
  await fs.promises.mkdir(dataDir, { recursive: true })
  const file = path.join(dataDir, SETTINGS_FILE)
  await fs.promises.writeFile(`${file}.tmp`, JSON.stringify(settings, null, 2))
  await fs.promises.rename(`${file}.tmp`, file)
}

function defaultRoot(home = os.homedir()) {
  return path.join(home, 'Repos')
}

/**
 * Every allowed repo, as real paths. Resolved fresh on each call, so a repo
 * that was moved, deleted or turned into a junction elsewhere drops out.
 */
async function allowedRepos(dataDir, { home } = {}) {
  const settings = await readSettings(dataDir)
  const rootSetting = settings.reposRoot ?? defaultRoot(home)
  const out = []
  const seen = new Set()
  const add = (p, source) => {
    if (seen.has(norm(p))) return
    seen.add(norm(p))
    out.push({ path: p, name: path.basename(p), source })
  }

  const root = await real(rootSetting)
  if (root) {
    let entries = []
    try {
      entries = await fs.promises.readdir(root, { withFileTypes: true })
    } catch {
      // Unreadable root: no repos from it.
    }
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue
      const dir = await real(path.join(root, e.name))
      // "Directly under" is checked after resolving, so a junction under Repos
      // that points somewhere else is not allowed.
      if (!dir || !samePath(path.dirname(dir), root)) continue
      if (await isGitRepo(dir)) add(dir, 'root')
    }
  }
  for (const p of settings.repos) {
    const dir = await real(p)
    if (dir && (await isGitRepo(dir))) add(dir, 'added')
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return { reposRoot: rootSetting, reposRootFound: !!root, rootIsDefault: settings.reposRoot === undefined, added: settings.repos, repos: out }
}

/** The allowed repo that contains `dir` (after resolving it), or undefined. */
async function repoFor(repos, dir) {
  const r = await real(dir)
  if (!r) return undefined
  // The deepest match wins (an added repo nested inside another).
  let best
  for (const repo of repos) if (isInside(repo.path, r) && (!best || repo.path.length > best.path.length)) best = repo
  return best
}

async function setReposRoot(dataDir, dir) {
  const r = await real(dir)
  if (!r) throw new Error('That folder does not exist.')
  const settings = await readSettings(dataDir)
  await writeSettings(dataDir, { ...settings, reposRoot: r })
}

async function addRepo(dataDir, dir) {
  const r = await real(dir)
  if (!r) throw new Error('That folder does not exist.')
  if (!(await isGitRepo(r))) throw new Error('That folder is not a git repository.')
  const settings = await readSettings(dataDir)
  if (!settings.repos.some((p) => samePath(p, r))) settings.repos.push(r)
  await writeSettings(dataDir, settings)
}

async function removeRepo(dataDir, dir) {
  // Stored paths are real paths (addRepo resolves them). Resolve this one too,
  // or a path spelled another way (a Windows 8.3 short name, a link) never matches.
  const r = await real(dir)
  const settings = await readSettings(dataDir)
  await writeSettings(dataDir, { ...settings, repos: settings.repos.filter((p) => !samePath(p, dir) && !(r && samePath(p, r))) })
}

module.exports = { allowedRepos, isGitRepo, repoFor, setReposRoot, addRepo, removeRepo, isInside, real }
