// Malloy on BigQuery, for the OpenMetadata page's Semantic models, Query
// builder and Malloy models tabs. No Electron here, so tests can drive it.
//
// Models are the *.malloy files in the folder picked in Malloy settings (malloy-settings.cjs).
// They compile with the real Malloy compiler (@malloydata/malloy); table
// schemas and queries go to BigQuery with the user's own gcloud login (the
// Google Cloud connection's access token, never stored). Rules:
// - Nothing runs until a models folder is picked (createMalloy gets
//   `settings()` returning undefined until then).
// - Imports and listed files must stay inside the folder (real path), never
//   follow links or junctions, and the page only ever sees relative paths.
// - Running a query is a second switch in the settings ("Run queries"),
//   off by default. Every run is dry-run first and refused over the
//   scan limit in the settings; BigQuery also gets maximumBytesBilled. Only SQL
//   that starts with SELECT or WITH is sent.
// - Results are kept in memory only, capped at ROW_LIMIT rows.

const nodeFs = require('node:fs/promises')
const nodePath = require('node:path')
const { pathToFileURL, fileURLToPath } = require('node:url')

const MAX_FILES = 200
const MAX_BYTES = 512 * 1024
const MAX_DIRS = 4000
const MAX_DEPTH = 12
const SKIP = new Set(['node_modules', 'target', 'dbt_packages', 'logs', '__pycache__'])
const ROW_LIMIT = 1000
const DEFAULT_MAX_BYTES_BILLED = 1024 ** 3
const TOKEN_TTL_MS = 30 * 60 * 1000

function inside(root, p) {
  const rel = nodePath.relative(root, p)
  return rel === '' || (!rel.startsWith('..') && !nodePath.isAbsolute(rel))
}

/** The folder's real path, or undefined when it is missing or not a folder. */
async function openRoot(dir, fsp) {
  try {
    if (!dir || !nodePath.isAbsolute(dir)) return undefined
    const root = await fsp.realpath(dir)
    return (await fsp.stat(root)).isDirectory() ? root : undefined
  } catch {
    return undefined
  }
}

/**
 * Every *.malloy file under root: relative path (forward slashes), size,
 * time and text. Skips dot folders, node_modules and the like, links and
 * junctions; re-checks each file's real path.
 */
async function listFiles(root, fsp = nodeFs) {
  const found = []
  let truncated = false
  let dirs = 0
  const queue = [{ abs: root, depth: 0 }]
  while (queue.length && !truncated) {
    const { abs, depth } = queue.shift()
    if (++dirs > MAX_DIRS) {
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
        if (!SKIP.has(e.name) && depth < MAX_DEPTH) queue.push({ abs: child, depth: depth + 1 })
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.malloy')) {
        if (found.length >= MAX_FILES) {
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
      if (st.size > MAX_BYTES) {
        files.push({ path: rel, size: st.size, tooLarge: true })
        continue
      }
      files.push({ path: rel, size: st.size, modifiedAt: st.mtime.toISOString(), text: await fsp.readFile(real, 'utf8') })
    } catch {
      // Gone or unreadable since the listing: leave it out.
    }
  }
  return { files, truncated: truncated || undefined }
}

/** A model file named by the page: a relative .malloy path that really is inside root. */
async function resolveModel(rootIn, rel, fsp = nodeFs) {
  // The folder's own real path, so a short (8.3) or linked name compares right.
  const root = await fsp.realpath(rootIn).catch(() => rootIn)
  const clean = String(rel ?? '').replace(/\\/g, '/')
  if (!clean || clean.startsWith('/') || /^[a-z]:/i.test(clean) || clean.split('/').includes('..') || !clean.toLowerCase().endsWith('.malloy')) {
    throw new Error('Not a model path.')
  }
  const abs = nodePath.resolve(root, ...clean.split('/'))
  if (!inside(root, abs)) throw new Error('Not a model path.')
  const real = await fsp.realpath(abs).catch(() => {
    throw new Error(`${clean} was not found in the models folder.`)
  })
  if (!inside(root, real)) throw new Error('Not a model path.')
  return real
}

/** Turn whatever Malloy threw into a list of problems with line numbers (1-based). */
function problemsOf(e, root) {
  const list = Array.isArray(e?.problems) ? e.problems : null
  if (list) {
    return list.map((p) => {
      let file
      try {
        if (p.at?.url?.startsWith('file:')) {
          const abs = fileURLToPath(p.at.url)
          if (root && inside(root, abs)) file = nodePath.relative(root, abs).split(nodePath.sep).join('/')
        }
      } catch {
        // Not a file URL: leave it out.
      }
      return {
        message: String(p.message ?? ''),
        severity: p.severity === 'warn' || p.severity === 'debug' ? p.severity : 'error',
        line: typeof p.at?.range?.start?.line === 'number' ? p.at.range.start.line + 1 : undefined,
        character: p.at?.range?.start?.character,
        file,
      }
    })
  }
  return [{ message: cleanError(e), severity: 'error' }]
}

/** One line of an error, without tokens or local paths. */
function cleanError(e) {
  return String(e instanceof Error ? e.message : e)
    .replace(/ya29\.[\w.-]+/g, '[token]')
    .replace(/Bearer\s+[\w.-]+/gi, 'Bearer [token]')
    .split('\n')[0]
    .slice(0, 500)
}

function describe(f) {
  try {
    const texts = typeof f.annotations?.texts === 'function' ? f.annotations.texts() : f.getTaglines?.(/^#"/) ?? []
    const text = texts
      // `# "text"` (a doc string) or `# text`.
      .map((t) => String(t).replace(/^#\s*/, '').trim().replace(/^"(.*)"$/s, '$1').trim())
      .filter(Boolean)
      .join(' ')
    return text || undefined
  } catch {
    return undefined
  }
}

function lineOf(f, root) {
  try {
    const loc = f.location
    if (!loc) return undefined
    let file
    if (loc.url?.startsWith('file:') && root) {
      const abs = fileURLToPath(loc.url)
      if (inside(root, abs)) file = nodePath.relative(root, abs).split(nodePath.sep).join('/')
    }
    return { file, line: loc.range.start.line + 1 }
  } catch {
    return undefined
  }
}

function outlineFields(explore, root, depth = 0) {
  const out = []
  for (const f of explore.allFields) {
    const at = lineOf(f, root)
    if (f.isExploreField()) {
      const sd = f.structDef ?? {}
      out.push({
        name: f.name,
        kind: 'join',
        relationship: String(f.joinRelationship ?? ''),
        source: f.sourceExplore?.name ?? undefined,
        tablePath: sd.type === 'table' ? sd.tablePath : undefined,
        fields: depth < 2 ? outlineFields(f, root, depth + 1) : [],
        ...at,
      })
    } else if (f.isQueryField()) {
      out.push({ name: f.name, kind: 'view', description: describe(f), ...at })
    } else if (f.isAtomicField()) {
      out.push({ name: f.name, kind: f.isCalculation() ? 'measure' : 'dimension', type: String(f.type), description: describe(f), ...at })
    }
  }
  return out
}

/** The compiled model as plain JSON: its sources with every field, and its named queries. */
function outline(model, root) {
  const explores = model.exportedExplores ?? model.explores ?? []
  const sources = explores.map((ex) => {
    const sd = ex.structDef ?? {}
    return {
      name: ex.name,
      description: describe(ex),
      tablePath: sd.type === 'table' ? sd.tablePath : undefined,
      connection: sd.connection,
      primaryKey: ex.primaryKey,
      fields: outlineFields(ex, root),
      ...lineOf(ex, root),
    }
  })
  let queries = []
  try {
    queries = (model.namedQueries ?? []).map((q) => ({ name: q.as ?? q.name })).filter((q) => q.name)
  } catch {
    queries = []
  }
  return { sources, queries }
}

/** Every measure name in a model, joins included (two levels). */
function measureNames(model) {
  const names = new Set()
  const walk = (ex, depth) => {
    for (const f of ex.allFields) {
      if (f.isAtomicField() && f.isCalculation()) names.add(f.name)
      else if (f.isExploreField() && depth < 2) walk(f, depth + 1)
    }
  }
  try {
    for (const ex of model.exportedExplores ?? model.explores ?? []) walk(ex, 0)
  } catch {
    // An odd model: no names, every column is shown as a plain value.
  }
  return names
}

const startsWithSelect =(sql) => /^\s*(?:(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*(SELECT|WITH)\b/i.test(sql)

function cellValue(v) {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'bigint') return v.toString()
  if (Array.isArray(v)) return v.map(cellValue)
  if (v && typeof v === 'object') {
    if (typeof v.toISOString === 'function') return v.toISOString()
    if (typeof v.value === 'string' && Object.keys(v).length === 1) return v.value
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cellValue(x)]))
  }
  return v
}

/**
 * The Malloy service. deps:
 * - settings(): Malloy's settings, or undefined until a folder is picked
 *   ({ folder, project?, location?, maxBytes?, run: 'on' | 'off' })
 * - credentials(): the Google Cloud connection's { accessToken, project }
 * - fs, malloy, bigquery, authLibrary: injectable for tests
 */
function createMalloy(deps = {}) {
  const fsp = deps.fs ?? nodeFs
  const lib = () => deps.malloy ?? require('@malloydata/malloy')
  const bq = () => deps.bigquery ?? require('@malloydata/db-bigquery')
  const auth = () => deps.authLibrary ?? require('google-auth-library')
  let token // { value, project, at }
  let conn // { key, connection }
  const compiled = new Map() // path -> { stamp, result }

  async function context({ needRoot = true } = {}) {
    const s = await deps.settings?.()
    if (!s) return { block: 'not-set-up' }
    const root = await openRoot(String(s.folder ?? '').trim(), fsp)
    if (needRoot && !root) return { block: 'no-folder', s }
    return { s, root }
  }

  async function accessToken(refresh = false) {
    if (!refresh && token && Date.now() - token.at < TOKEN_TTL_MS) return token
    const c = await deps.credentials?.()
    if (!c?.accessToken) throw Object.assign(new Error('Sign in to Google Cloud on Connections first: Malloy reads BigQuery with your gcloud login.'), { code: 'no-gcloud' })
    token = { value: c.accessToken, project: c.project, at: Date.now() }
    return token
  }

  async function connection(s, refresh = false) {
    const t = await accessToken(refresh)
    const project = String(s.project ?? '').trim() || t.project
    if (!project) throw new Error('Name a BigQuery project in Malloy settings (or set one in gcloud): queries are billed to it.')
    const maxBytes = String(Number(s.maxBytes) > 0 ? Math.floor(Number(s.maxBytes)) : DEFAULT_MAX_BYTES_BILLED)
    const key = [t.value, project, s.location ?? '', maxBytes].join('|')
    if (conn?.key === key) return conn.connection
    const { OAuth2Client } = auth()
    const authClient = new OAuth2Client()
    authClient.setCredentials({ access_token: t.value })
    const { BigQueryConnection } = bq()
    const connection = new BigQueryConnection({
      name: 'bigquery',
      projectId: project,
      billingProjectId: project,
      location: String(s.location ?? '').trim() || undefined,
      maximumBytesBilled: maxBytes,
      authClient,
    })
    conn = { key, connection, maxBytes: Number(maxBytes) }
    return connection
  }

  function runtimeFor(root, connection) {
    const { Runtime } = lib()
    const urlReader = {
      readURL: async (url) => {
        const u = typeof url === 'string' ? new URL(url) : url
        if (u.protocol !== 'file:') throw new Error(`Imports must be files in the models folder: ${u}`)
        const abs = fileURLToPath(u)
        if (!inside(root, abs) || !abs.toLowerCase().endsWith('.malloy')) throw new Error('Imports must stay inside the models folder.')
        const real = await fsp.realpath(abs)
        if (!inside(root, real)) throw new Error('Imports must stay inside the models folder.')
        const st = await fsp.stat(real)
        if (st.size > MAX_BYTES) throw new Error('An imported file is over 512 KB.')
        return fsp.readFile(real, 'utf8')
      },
    }
    return new Runtime({ urlReader, connection })
  }

  /** Load a model, retrying once with a fresh token when BigQuery says the old one expired. */
  async function withModel(ctx, rel, fn) {
    const file = await resolveModel(ctx.root, rel, fsp)
    const attempt = async (refresh) => {
      const c = await connection(ctx.s, refresh)
      const mm = runtimeFor(ctx.root, c).loadModel(pathToFileURL(file))
      return fn(mm, c)
    }
    try {
      return await attempt(false)
    } catch (e) {
      if (/401|invalid_token|Invalid Credentials|UNAUTHENTICATED/i.test(String(e?.message ?? e))) return attempt(true)
      throw e
    }
  }

  async function status() {
    const ctx = await context({ needRoot: false })
    if (ctx.block) return { block: ctx.block }
    if (!ctx.root) return { block: 'no-folder' }
    let gcloud = true
    try {
      await accessToken()
    } catch {
      gcloud = false
    }
    return {
      folderName: nodePath.basename(ctx.root),
      run: ctx.s.run === 'on',
      gcloud,
      project: String(ctx.s.project ?? '').trim() || token?.project || undefined,
      maxBytesBilled: Number(ctx.s.maxBytes) > 0 ? Number(ctx.s.maxBytes) : DEFAULT_MAX_BYTES_BILLED,
      rowLimit: ROW_LIMIT,
    }
  }

  async function listModels() {
    const readAt = new Date().toISOString()
    const ctx = await context()
    if (ctx.block) return { block: ctx.block === 'no-folder' ? 'no-project' : ctx.block, files: [], readAt }
    const { files, truncated } = await listFiles(ctx.root, fsp)
    return { folderName: nodePath.basename(ctx.root), files, truncated, readAt }
  }

  /** Compile one model: its sources and fields from the compiler, or its problems. Kept in memory while the file is unchanged. */
  async function compile({ path: rel } = {}) {
    const ctx = await context()
    if (ctx.block) return { ok: false, block: ctx.block, sources: [], queries: [], problems: [] }
    let stamp
    try {
      const st = await fsp.stat(await resolveModel(ctx.root, rel, fsp))
      stamp = `${st.mtimeMs}|${st.size}`
      const hit = compiled.get(rel)
      if (hit && hit.stamp === stamp && hit.token === token?.value) return hit.result
    } catch (e) {
      return { ok: false, sources: [], queries: [], problems: problemsOf(e, ctx.root) }
    }
    let result
    try {
      result = await withModel(ctx, rel, async (mm) => ({ ok: true, ...outline(await mm.getModel(), ctx.root), problems: [] }))
    } catch (e) {
      result = { ok: false, sources: [], queries: [], problems: problemsOf(e, ctx.root), block: e?.code === 'no-gcloud' ? 'no-gcloud' : undefined }
    }
    if (result.ok) compiled.set(rel, { stamp, token: token?.value, result })
    return result
  }

  async function estimate(c, sql) {
    try {
      const stats = await c.estimateQueryCost(sql)
      return { bytes: Number(stats?.queryCostBytes ?? 0) }
    } catch (e) {
      return { error: cleanError(e) }
    }
  }

  /** The SQL a query compiles to, and what BigQuery's dry run says it would scan. Runs nothing. */
  async function sql({ path: rel, query } = {}) {
    const ctx = await context()
    if (ctx.block) return { ok: false, block: ctx.block, problems: [] }
    if (!String(query ?? '').trim()) return { ok: false, problems: [{ message: 'Write a query first.', severity: 'error' }] }
    try {
      return await withModel(ctx, rel, async (mm, c) => {
        const text = await mm.loadQuery(String(query)).getSQL()
        return { ok: true, sql: text, estimate: { ...(await estimate(c, text)), maxBytesBilled: conn.maxBytes }, problems: [] }
      })
    } catch (e) {
      return { ok: false, problems: problemsOf(e, ctx.root), block: e?.code === 'no-gcloud' ? 'no-gcloud' : undefined }
    }
  }

  let running = 0
  /** Run a query on BigQuery: only with "Run queries" on, dry-run first, refused over the scan limit. */
  async function run({ path: rel, query } = {}) {
    const ctx = await context()
    if (ctx.block) return { ok: false, block: ctx.block, problems: [] }
    if (ctx.s.run !== 'on') return { ok: false, block: 'run-off', problems: [{ message: 'Running queries is off. Turn on "Run queries on BigQuery" in Malloy settings.', severity: 'error' }] }
    if (!String(query ?? '').trim()) return { ok: false, problems: [{ message: 'Write a query first.', severity: 'error' }] }
    if (running >= 2) return { ok: false, problems: [{ message: 'Two Malloy queries are already running. Wait for one to finish.', severity: 'error' }] }
    running++
    let text
    let est
    try {
      return await withModel(ctx, rel, async (mm, c) => {
        const q = mm.loadQuery(String(query))
        text = await q.getSQL()
        if (!startsWithSelect(text)) return { ok: false, sql: text, problems: [{ message: 'MonoRail only runs queries that compile to a SELECT.', severity: 'error' }] }
        est = { ...(await estimate(c, text)), maxBytesBilled: conn.maxBytes }
        if (est.error) return { ok: false, sql: text, estimate: est, problems: [{ message: `BigQuery's dry run failed: ${est.error}`, severity: 'error' }] }
        if (est.bytes > conn.maxBytes) {
          return { ok: false, sql: text, estimate: est, problems: [{ message: `This query would scan ${fmtBytes(est.bytes)}, over the ${fmtBytes(conn.maxBytes)} limit in Malloy settings. Add a filter or raise the limit.`, severity: 'error' }] }
        }
        const started = Date.now()
        const result = await q.run({ rowLimit: ROW_LIMIT })
        // Result fields no longer say they were aggregates: match them to the model's measures by name.
        const measures = measureNames(await mm.getModel())
        const fields = result.resultExplore.allFields.map((f) => ({
          name: f.name,
          type: f.isAtomicField() ? String(f.type) : f.isExploreField() ? 'nested' : 'view',
          isMeasure: f.isAtomicField() ? f.isCalculation() || (String(f.type) === 'number' && measures.has(f.name)) : false,
        }))
        const rows = result.data.toObject().map(cellValue)
        return { ok: true, sql: text, estimate: est, fields, rows, totalRows: result.totalRows, truncated: (result.totalRows ?? rows.length) > rows.length || undefined, ms: Date.now() - started, problems: [] }
      })
    } catch (e) {
      return { ok: false, sql: text, estimate: est, problems: problemsOf(e, ctx.root), block: e?.code === 'no-gcloud' ? 'no-gcloud' : undefined }
    } finally {
      running--
    }
  }

  return { status, listModels, compile, sql, run }
}

const fmtBytes = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`)

module.exports = { createMalloy, listFiles, resolveModel, problemsOf, startsWithSelect, cellValue, ROW_LIMIT, DEFAULT_MAX_BYTES_BILLED }
