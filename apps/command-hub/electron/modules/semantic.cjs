// Semantic backend (read by Explore and the OpenMetadata page's Semantic
// models, Metrics, Query builder and Malloy tabs): a dbt project's semantic
// layer, read from its files and queried with the user's own MetricFlow.
//
// Opt-in twice. Nothing runs until the user adds the MetricFlow connection
// (hasConnection only reads the saved list); until then the page says "not
// set up". Browsing reads files only (semantic-mf.cjs). query and explain run
// the user's `mf` only when the connection's "Run queries with MetricFlow" is
// on. There is no start(): nothing runs while the page is closed. Nothing is
// written to the data folder: results go to the page and are not kept, and the
// parsed manifest is held in memory, keyed by its file's time. malloyModels
// lists the project folder's *.malloy files (read-only; MonoRail runs no Malloy).

const mfLib = require('./semantic-mf.cjs')

function connectionsApi() {
  return require('../connections/index.cjs')
}

/** The connection's settings, or undefined when it is not added. */
async function settings(deps = {}) {
  if (deps.settings) return deps.settings()
  const api = connectionsApi()
  if (!(await api.hasConnection('metricflow'))) return undefined
  return api.getCredentials('metricflow')
}

async function getProject(deps = {}) {
  const s = await settings(deps)
  if (!s) return { block: 'not-set-up', metrics: [], models: [], dimensions: [], savedQueries: [], metricflow: { canRun: false, found: false }, readAt: new Date().toISOString() }
  const { _internal, ...page } = await mfLib.loadProject(s, deps)
  return page
}

/** Everything a query needs, after the checks. */
async function forQuery(deps = {}) {
  const s = await settings(deps)
  if (!s) throw new Error('Set up MetricFlow on the Connections page first.')
  if (s.run !== 'on') throw new Error('Running queries is off. Turn on “Run queries with MetricFlow” in the MetricFlow connection.')
  const loaded = await mfLib.loadProject(s, deps)
  if (loaded.block === 'no-project') throw new Error('The dbt project folder was not found. Pick it again on Connections.')
  if (loaded.block) throw new Error('The project has no readable semantic manifest. Run dbt parse, then reload.')
  return { projectDir: loaded._internal.project.dir, mf: loaded._internal.mf, manifest: loaded }
}

// --- Malloy models (read-only) ---------------------------------------------
// MonoRail runs no Malloy. The OpenMetadata page's Malloy tab only shows the
// *.malloy files kept in the MetricFlow connection's project folder, parsed in
// the page. Same opt-in as getProject: nothing is read until the connection is
// added. Links and junctions are never followed, every file is re-checked by
// real path to stay inside the folder, and the page gets paths relative to the
// folder only.

const nodeFs = require('node:fs/promises')
const nodePath = require('node:path')

const MALLOY_MAX_FILES = 200
const MALLOY_MAX_BYTES = 512 * 1024
const MALLOY_MAX_DIRS = 4000
const MALLOY_MAX_DEPTH = 12
const MALLOY_SKIP = new Set(['node_modules', 'target', 'dbt_packages', 'logs', '__pycache__'])

function inside(root, p) {
  const rel = nodePath.relative(root, p)
  return rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel))
}

async function malloyModels(deps = {}) {
  const fsp = deps.fs ?? nodeFs
  const readAt = new Date().toISOString()
  const s = await settings(deps)
  if (!s) return { block: 'not-set-up', files: [], readAt }
  const dir = String(s.project ?? '').trim()
  let root
  try {
    if (!dir || !nodePath.isAbsolute(dir)) throw new Error('no folder')
    root = await fsp.realpath(dir)
    if (!(await fsp.stat(root)).isDirectory()) throw new Error('not a folder')
  } catch {
    return { block: 'no-project', files: [], readAt }
  }

  const found = []
  let truncated = false
  let dirs = 0
  const queue = [{ abs: root, depth: 0 }]
  while (queue.length && !truncated) {
    const { abs, depth } = queue.shift()
    if (++dirs > MALLOY_MAX_DIRS) {
      truncated = true
      break
    }
    let entries
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true })
    } catch {
      continue
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (e.name.startsWith('.') || e.isSymbolicLink()) continue
      const child = nodePath.join(abs, e.name)
      if (e.isDirectory()) {
        if (!MALLOY_SKIP.has(e.name) && depth < MALLOY_MAX_DEPTH) queue.push({ abs: child, depth: depth + 1 })
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.malloy')) {
        if (found.length >= MALLOY_MAX_FILES) {
          truncated = true
          break
        }
        found.push(child)
      }
    }
  }

  const files = []
  for (const abs of found) {
    try {
      // A junction can look like a plain folder: check where the file really is.
      const real = await fsp.realpath(abs)
      if (!inside(root, real)) continue
      const st = await fsp.lstat(abs)
      if (!st.isFile()) continue
      const rel = nodePath.relative(root, abs).split(nodePath.sep).join('/')
      if (st.size > MALLOY_MAX_BYTES) {
        files.push({ path: rel, size: st.size, tooLarge: true })
        continue
      }
      files.push({ path: rel, size: st.size, modifiedAt: st.mtime.toISOString(), text: await fsp.readFile(real, 'utf8') })
    } catch {
      // Gone or unreadable since the listing: leave it out.
    }
  }
  return { folderName: nodePath.basename(root), files, truncated: truncated || undefined, readAt }
}

// A query starts Python and talks to the warehouse: a couple at a time is plenty.
const MAX_RUNNING = 2
let running = 0

async function limited(fn) {
  if (running >= MAX_RUNNING) throw new Error('Two MetricFlow queries are already running. Wait for one to finish.')
  running++
  try {
    return await fn()
  } finally {
    running--
  }
}

module.exports = {
  id: 'semantic',
  methods: {
    getProject: () => getProject(),
    query: async (_ctx, req) => limited(async () => mfLib.runQuery({ ...(await forQuery()), req })),
    explain: async (_ctx, req) => limited(async () => mfLib.explainQuery({ ...(await forQuery()), req })),
    malloyModels: () => malloyModels(),
  },
  _internal: { getProject, forQuery, malloyModels },
}
