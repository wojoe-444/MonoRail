// SQLX backend (Tools > SQLX): reads and saves the .sqlx files of Dataform
// projects the user picked in the system dialog. projects.json in the data
// folder holds only the picked folders (id, name, path). Files are read in place
// on every call and never cached or copied; the page names a file by project id
// plus a relative path, and every request re-resolves it (real path, links
// followed) inside the project folder.

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const PROJECTS_FILE = 'projects.json'
const MAX_PROJECTS = 30
const MAX_FILES = 5000
const MAX_DEPTH = 12
const MAX_FILE_BYTES = 2 * 1024 * 1024
// Folders a Dataform project never keeps definitions in.
const SKIP_DIRS = new Set(['node_modules', '.git', '.df-cache', 'target', 'dist', 'build', '__pycache__'])

function projectsPath(ctx) {
  return path.join(ctx.dataDir, PROJECTS_FILE)
}

function readProjects(ctx) {
  let raw
  try {
    raw = fs.readFileSync(projectsPath(ctx), 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  const data = JSON.parse(raw)
  if (!Array.isArray(data)) throw new Error('The SQLX project list is damaged. It was left as it is.')
  return data.filter((p) => p && typeof p.id === 'string' && typeof p.path === 'string')
}

function writeProjects(ctx, items) {
  fs.mkdirSync(ctx.dataDir, { recursive: true })
  const file = projectsPath(ctx)
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temp, JSON.stringify(items, null, 2), 'utf8')
    fs.renameSync(temp, file)
  } finally {
    try { fs.unlinkSync(temp) } catch { /* Already renamed. */ }
  }
}

/** 3 (workflow_settings.yaml), 2 (dataform.json) or null. Decides where BigQuery options go in a config. */
function coreVersion(dir) {
  if (fs.existsSync(path.join(dir, 'workflow_settings.yaml'))) return 3
  if (fs.existsSync(path.join(dir, 'dataform.json'))) return 2
  return null
}

function publicProject(p) {
  return { id: p.id, name: p.name, dataform: p.dataform === true, core: coreVersion(p.path) }
}

function findProject(ctx, id) {
  const p = readProjects(ctx).find((x) => x.id === id)
  if (!p) throw new Error('That project is no longer on the list.')
  return p
}

/** True when the folder looks like a Dataform project. */
function isDataformFolder(dir) {
  return ['workflow_settings.yaml', 'dataform.json'].some((f) => fs.existsSync(path.join(dir, f))) || fs.existsSync(path.join(dir, 'definitions'))
}

/** Resolve a page-given relative path to a real .sqlx file inside the project. */
async function resolveFile(project, rel, { mustExist = true } = {}) {
  if (typeof rel !== 'string' || !rel || rel.length > 1024 || rel.includes('\0')) throw new Error('Invalid file name.')
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('Invalid file name.')
  if (!rel.toLowerCase().endsWith('.sqlx')) throw new Error('Only .sqlx files can be opened here.')
  const root = await fsp.realpath(project.path)
  const joined = path.join(root, rel)
  const real = mustExist ? await fsp.realpath(joined) : joined
  const relative = path.relative(root, real)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('That file is outside the project folder.')
  return real
}

async function walk(root) {
  const files = []
  let truncated = false
  async function visit(dir, depth) {
    if (files.length >= MAX_FILES) return void (truncated = true)
    if (depth > MAX_DEPTH) return
    let entries
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (files.length >= MAX_FILES) return void (truncated = true)
      // Links and junctions are never followed while listing.
      if (e.isSymbolicLink()) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue
        await visit(full, depth + 1)
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.sqlx')) {
        let stat
        try { stat = await fsp.stat(full) } catch { continue }
        files.push({ path: path.relative(root, full).split(path.sep).join('/'), size: stat.size, mtimeMs: stat.mtimeMs })
      }
    }
  }
  await visit(root, 0)
  return { files, truncated }
}

module.exports = {
  id: 'sqlx',
  desktopOnly: ['addProject'],

  methods: {
    async listProjects(ctx) {
      return readProjects(ctx).map(publicProject)
    },

    /** Pick a project folder in the system dialog and add it to the list. */
    async addProject(ctx) {
      const { BrowserWindow, dialog } = require('electron')
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Choose a Dataform project folder', properties: ['openDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      if (r.canceled || !r.filePaths[0]) return null
      const dir = await fsp.realpath(r.filePaths[0])
      if (!(await fsp.stat(dir)).isDirectory()) throw new Error('Pick a folder.')
      const items = readProjects(ctx)
      const existing = items.find((p) => path.resolve(p.path).toLowerCase() === dir.toLowerCase())
      if (existing) return publicProject(existing)
      if (items.length >= MAX_PROJECTS) throw new Error(`Up to ${MAX_PROJECTS} projects can be listed. Remove one first.`)
      const project = { id: randomUUID(), name: path.basename(dir) || dir, path: dir, dataform: isDataformFolder(dir), addedAt: new Date().toISOString() }
      writeProjects(ctx, [...items, project])
      return publicProject(project)
    },

    /** Take a project off the list. Its files are not touched. */
    async removeProject(ctx, args) {
      const items = readProjects(ctx)
      const next = items.filter((p) => p.id !== args?.id)
      if (next.length !== items.length) writeProjects(ctx, next)
      return true
    },

    async listFiles(ctx, args) {
      const project = findProject(ctx, args?.projectId)
      let root
      try {
        root = await fsp.realpath(project.path)
      } catch {
        throw new Error(`The folder of ${project.name} can no longer be found.`)
      }
      return walk(root)
    },

    async readFile(ctx, args) {
      const file = await resolveFile(findProject(ctx, args?.projectId), args?.path)
      const stat = await fsp.stat(file)
      if (!stat.isFile()) throw new Error('Not a file.')
      if (stat.size > MAX_FILE_BYTES) throw new Error('This file is larger than 2 MB, too large to open here.')
      return { path: args.path, text: await fsp.readFile(file, 'utf8'), mtimeMs: stat.mtimeMs }
    },

    /**
     * Save a file the page opened. Refused when the file changed on disk since
     * it was read (mtimeMs), so an edit made elsewhere is never overwritten.
     */
    async saveFile(ctx, args) {
      const file = await resolveFile(findProject(ctx, args?.projectId), args?.path)
      if (typeof args?.text !== 'string') throw new Error('Nothing to save.')
      if (Buffer.byteLength(args.text, 'utf8') > MAX_FILE_BYTES) throw new Error('The file would be larger than 2 MB.')
      const stat = await fsp.stat(file)
      if (typeof args.mtimeMs !== 'number' || Math.abs(stat.mtimeMs - args.mtimeMs) > 1) {
        const err = new Error('This file changed on disk after you opened it. Reload it to see the new version (your edits would be lost), or copy them first.')
        err.code = 'changed'
        throw err
      }
      const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`)
      try {
        await fsp.writeFile(temp, args.text, 'utf8')
        await fsp.rename(temp, file)
      } finally {
        await fsp.unlink(temp).catch(() => {})
      }
      const after = await fsp.stat(file)
      return { path: args.path, mtimeMs: after.mtimeMs }
    },
  },
}

module.exports._test = { resolveFile, walk, isDataformFolder }
