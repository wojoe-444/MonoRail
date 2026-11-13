// MetricFlow for the Semantic page, the MetricFlow connector and the MCP server.
//
// No Electron here: the MCP server (electron/mcp) uses it too.
//
// Two halves:
//
//   Reading (no program runs). The dbt project's dbt_project.yml (name,
//   profile, target-path), target/semantic_manifest.json (semantic models,
//   metrics, saved queries) and, for versions, the `*.dist-info` folder names
//   next to the `mf` program. profiles.yml is only looked for, never opened:
//   it holds warehouse passwords.
//
//   Running (only when the user turned on "Run queries with MetricFlow" in
//   the connection; the callers check). The user's own `mf` program, started
//   directly (never through a shell) in the project folder with arguments
//   built here from names checked against the manifest. On Windows only a
//   real mf.exe is run (pip makes one); a .cmd/.bat shim is refused. Results
//   come back through a CSV file in a fresh temp folder that is deleted right
//   after reading; nothing is kept.

const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const MANIFEST_LIMIT = 64 * 1024 * 1024
const OUTPUT_LIMIT = 2 * 1024 * 1024
const RESULT_ROWS = 10_000
const QUERY_TIMEOUT_MS = 3 * 60_000
const GRAINS = ['day', 'week', 'month', 'quarter', 'year']
const NAME = /^[a-z_][a-z0-9_]*$/i
const GROUP_BY = /^[a-z_][a-z0-9_]*(__[a-z0-9_]+)*$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

const isWin = (deps) => (deps.platform ?? process.platform) === 'win32'

async function isFile(file, stat = fs.stat) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- project

/** Top-level `key: value` pairs of dbt_project.yml we need. Plain text, no YAML library. */
function parseProjectYml(text) {
  const out = {}
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^(name|profile|target-path)\s*:\s*['"]?([^'"#\r\n]+?)['"]?\s*(#.*)?$/.exec(line)
    if (m && !(m[1] in out)) out[m[1]] = m[2].trim()
  }
  return out
}

/** The project in `dir`, or { error } when it is not a dbt project. Reads one file. */
async function readProject(dir, deps = {}) {
  if (typeof dir !== 'string' || !dir.trim() || !path.isAbsolute(dir)) return { error: 'no-project' }
  let text
  try {
    text = await (deps.readFile ?? fs.readFile)(path.join(dir, 'dbt_project.yml'), 'utf8')
  } catch {
    return { error: 'no-project' }
  }
  const yml = parseProjectYml(text)
  const target = yml['target-path'] && !/[{}]/.test(yml['target-path']) ? yml['target-path'] : 'target'
  const targetDir = path.resolve(dir, target)
  return { dir, name: yml.name || path.basename(dir), profile: yml.profile, targetDir, folderName: path.basename(dir) }
}

/** profiles.yml's place, if there is one. Never read: it holds passwords. */
async function findProfiles(dir, deps = {}) {
  const env = deps.env ?? process.env
  const home = deps.home ?? os.homedir()
  const places = [env.DBT_PROFILES_DIR, dir, home && path.join(home, '.dbt')].filter(Boolean)
  for (const p of places) {
    if (await isFile(path.join(p, 'profiles.yml'), deps.stat)) return p === dir ? 'project folder' : p === env.DBT_PROFILES_DIR ? 'DBT_PROFILES_DIR' : '~/.dbt'
  }
  return undefined
}

/** dbt's version and parse time, from the start of target/manifest.json (only its metadata is read). */
async function manifestMeta(targetDir, deps = {}) {
  let handle
  try {
    handle = await (deps.open ?? fs.open)(path.join(targetDir, 'manifest.json'), 'r')
    const buf = Buffer.alloc(8192)
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0)
    const head = buf.subarray(0, bytesRead).toString('utf8')
    return {
      dbtVersion: /"dbt_version"\s*:\s*"([^"]+)"/.exec(head)?.[1],
      generatedAt: /"generated_at"\s*:\s*"([^"]+)"/.exec(head)?.[1],
    }
  } catch {
    return {}
  } finally {
    await handle?.close().catch(() => {})
  }
}

// ---------------------------------------------------------------- manifest

const str = (v) => (typeof v === 'string' && v ? v : undefined)
const arr = (v) => (Array.isArray(v) ? v : [])
const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : undefined)

function whereList(filter) {
  if (!filter) return []
  if (typeof filter === 'string') return [filter]
  return arr(filter.where_filters).map((w) => str(w?.where_sql_template)).filter(Boolean)
}

function toModel(m) {
  const entities = arr(m.entities)
    .filter((e) => str(e?.name))
    .map((e) => ({ name: e.name, type: ['primary', 'foreign', 'unique', 'natural'].includes(lower(e.type)) ? lower(e.type) : 'foreign' }))
  const primary = str(m.primary_entity) ?? entities.find((e) => e.type === 'primary' || e.type === 'natural')?.name ?? entities.find((e) => e.type === 'unique')?.name
  return {
    name: m.name,
    description: str(m.description),
    model: str(m.node_relation?.alias),
    defaultTimeDimension: str(m.defaults?.agg_time_dimension),
    primaryEntity: primary,
    entities,
    dimensions: arr(m.dimensions)
      .filter((d) => str(d?.name))
      .map((d) => {
        const time = lower(d.type) === 'time'
        const g = lower(d.type_params?.time_granularity)
        return { name: d.name, type: time ? 'time' : 'categorical', grain: time ? (GRAINS.includes(g) ? g : 'day') : undefined, description: str(d.description) }
      }),
    measures: arr(m.measures)
      .filter((x) => str(x?.name))
      .map((x) => ({ name: x.name, agg: lower(x.agg) ?? 'sum', description: str(x.description) })),
  }
}

/**
 * Group-by dimensions per semantic model: its own (through each of its
 * entities) and one join away (another model whose primary or unique entity
 * is one of this model's entities). MetricFlow can sometimes go further; when
 * queries are on, mf itself is the final word.
 */
function reachableDimensions(models) {
  const byEntity = new Map()
  for (const m of models) for (const e of m.entities) if (e.type !== 'foreign') byEntity.set(e.name, [...(byEntity.get(e.name) ?? []), m])
  const all = new Map()
  const out = new Map()
  for (const m of models) {
    const names = new Set()
    for (const e of m.entities) {
      const targets = e.type === 'foreign' ? byEntity.get(e.name) ?? [] : [m, ...(byEntity.get(e.name) ?? []).filter((x) => x !== m)]
      for (const t of targets) {
        for (const d of t.dimensions) {
          const name = `${e.name}__${d.name}`
          names.add(name)
          if (!all.has(name)) all.set(name, { name, type: d.type, grain: d.grain, semanticModel: t.name, description: d.description })
        }
      }
    }
    out.set(m.name, names)
  }
  return { byModel: out, all: [...all.values()].sort((a, b) => a.name.localeCompare(b.name)) }
}

function describeMetric(m) {
  const p = m.type_params ?? {}
  const type = lower(m.type)
  const name = (x) => str(x?.name) ?? str(x)
  if (type === 'simple') return name(p.measure) ? `From measure ${name(p.measure)}` : 'Simple metric'
  if (type === 'ratio') return `${name(p.numerator) ?? '?'} ÷ ${name(p.denominator) ?? '?'}`
  if (type === 'derived') return str(p.expr) ? `${p.expr}` : 'Derived from other metrics'
  if (type === 'cumulative') {
    const c = p.cumulative_type_params ?? p
    const base = name(p.measure) ?? name(c.metric) ?? name(p.metric) ?? 'its input'
    const win = c.window ? `over a ${c.window.count ?? ''} ${lower(c.window.granularity) ?? ''} window`.replace(/\s+/g, ' ') : c.grain_to_date ? `${lower(c.grain_to_date)} to date` : 'all time'
    return `Running total of ${base}, ${win}`
  }
  if (type === 'conversion') {
    const c = p.conversion_type_params ?? {}
    return `Conversion from ${name(c.base_measure) ?? '?'} to ${name(c.conversion_measure) ?? '?'}${c.entity ? ` per ${c.entity}` : ''}`
  }
  return 'Metric'
}

function inputMetricsOf(m) {
  const p = m.type_params ?? {}
  const names = [p.numerator, p.denominator, ...arr(p.metrics), p.cumulative_type_params?.metric].map((x) => str(x?.name) ?? str(x)).filter(Boolean)
  return [...new Set(names)]
}

function directMeasuresOf(m) {
  const p = m.type_params ?? {}
  const c = p.conversion_type_params ?? {}
  const listed = arr(p.input_measures).map((x) => str(x?.name)).filter(Boolean)
  const direct = [p.measure, c.base_measure, c.conversion_measure].map((x) => str(x?.name) ?? str(x)).filter(Boolean)
  return [...new Set([...listed, ...direct])]
}

/** semantic_manifest.json -> the page's shape (types.ts SemanticProject, without project and metricflow). */
function parseManifest(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.semantic_models) || !Array.isArray(json.metrics)) throw new Error('This is not a semantic manifest.')
  const models = json.semantic_models.filter((m) => str(m?.name)).map(toModel)
  const measureModel = new Map()
  for (const m of models) for (const x of m.measures) measureModel.set(x.name, m.name)
  const { byModel, all } = reachableDimensions(models)
  const raw = new Map(json.metrics.filter((m) => str(m?.name)).map((m) => [m.name, m]))

  const measuresCache = new Map()
  function measuresOf(name, seen = new Set()) {
    if (measuresCache.has(name)) return measuresCache.get(name)
    const m = raw.get(name)
    if (!m || seen.has(name)) return []
    seen.add(name)
    const out = new Set(directMeasuresOf(m))
    for (const input of inputMetricsOf(m)) for (const x of measuresOf(input, seen)) out.add(x)
    const list = [...out]
    measuresCache.set(name, list)
    return list
  }

  const metrics = [...raw.values()].map((m) => {
    const measures = measuresOf(m.name)
    const semanticModels = [...new Set(measures.map((x) => measureModel.get(x)).filter(Boolean))]
    let dims
    for (const sm of semanticModels) {
      const set = byModel.get(sm) ?? new Set()
      dims = dims ? new Set([...dims].filter((d) => set.has(d))) : new Set(set)
    }
    const type = ['simple', 'ratio', 'cumulative', 'derived', 'conversion'].includes(lower(m.type)) ? lower(m.type) : 'simple'
    const measureAgg = type === 'simple' ? models.flatMap((x) => x.measures).find((x) => x.name === measures[0])?.agg : undefined
    const definition = type === 'simple' && measures[0] ? `${aggWords(measureAgg)} ${measures[0]}` : describeMetric(m)
    const where = whereList(m.filter)
    return {
      name: m.name,
      label: str(m.label),
      description: str(m.description),
      type,
      definition,
      filter: where.length ? where.join(' AND ') : undefined,
      measures,
      inputMetrics: inputMetricsOf(m),
      semanticModels,
      dimensions: ['metric_time', ...[...(dims ?? [])].sort()],
    }
  })

  const savedQueries = arr(json.saved_queries)
    .filter((s) => str(s?.name))
    .map((s) => {
      const q = s.query_params ?? {}
      return {
        name: s.name,
        description: str(s.description),
        metrics: arr(q.metrics).map((x) => str(x?.name) ?? str(x)).filter(Boolean),
        groupBy: arr(q.group_by).map((x) => str(x?.name) ?? str(x)).filter(Boolean).map(cleanGroupBy),
        where: whereList(q.where),
      }
    })

  return {
    models,
    metrics: metrics.sort((a, b) => a.name.localeCompare(b.name)),
    dimensions: [{ name: 'metric_time', type: 'time', grain: 'day', semanticModel: '', description: 'The time of each metric, from its measure’s default time dimension.' }, ...all],
    savedQueries,
  }
}

function aggWords(agg) {
  const map = { sum: 'Sum of', count: 'Count of', count_distinct: 'Distinct count of', average: 'Average of', avg: 'Average of', min: 'Minimum of', max: 'Maximum of', median: 'Median of', percentile: 'Percentile of', sum_boolean: 'Count of true' }
  return map[agg] ?? 'From'
}

/** Saved queries write group-bys as Jinja, e.g. "{{ TimeDimension('metric_time', 'month') }}". */
function cleanGroupBy(g) {
  const t = /TimeDimension\(\s*['"]([\w]+)['"]\s*(?:,\s*['"](\w+)['"])?/.exec(g)
  if (t) return t[2] ? `${t[1]}__${t[2].toLowerCase()}` : t[1]
  const d = /(?:Dimension|Entity)\(\s*['"]([\w]+)['"]/.exec(g)
  return d ? d[1] : g
}

/** Read and parse the semantic manifest, or { error }. */
async function readManifest(targetDir, deps = {}) {
  const file = path.join(targetDir, 'semantic_manifest.json')
  let st
  try {
    st = await (deps.stat ?? fs.stat)(file)
  } catch {
    return { error: 'no-manifest' }
  }
  if (st.size > MANIFEST_LIMIT) return { error: 'bad-manifest', detail: 'The semantic manifest is larger than 64 MB.' }
  try {
    const parsed = parseManifest(JSON.parse(await (deps.readFile ?? fs.readFile)(file, 'utf8')))
    return { ...parsed, mtime: st.mtime.toISOString() }
  } catch (e) {
    return { error: 'bad-manifest', detail: String(e?.message ?? e).split('\n')[0].slice(0, 300) }
  }
}

// ---------------------------------------------------------------- mf and versions

/** Where mf usually is: the project's virtual environment first, then PATH. Files only; nothing runs. */
async function findMf(projectDir, deps = {}) {
  const win = isWin(deps)
  const exe = win ? 'mf.exe' : 'mf'
  const bin = win ? 'Scripts' : 'bin'
  for (const venv of ['.venv', 'venv', 'env']) {
    const file = path.join(projectDir, venv, bin, exe)
    if (await isFile(file, deps.stat)) return { file, where: `the project’s ${venv}` }
  }
  const env = deps.env ?? process.env
  if (env.VIRTUAL_ENV) {
    const file = path.join(env.VIRTUAL_ENV, bin, exe)
    if (await isFile(file, deps.stat)) return { file, where: 'the active virtual environment' }
  }
  const cli = require('./docker-cli.cjs')
  const found = await cli.findOnPath('mf', { env, platform: deps.platform, stat: deps.stat, exts: win ? ['.exe', '.cmd', '.bat'] : undefined })
  if (!found) return undefined
  return { file: found, where: 'PATH', shim: win && !/\.exe$/i.test(found) }
}

/** Installed package versions from the dist-info folders near mf. Folder names only. */
async function packageVersions(mfFile, deps = {}) {
  const binDir = path.dirname(mfFile)
  const root = path.dirname(binDir)
  const candidates = [path.join(root, 'Lib', 'site-packages'), path.join(root, 'site-packages')]
  try {
    for (const d of await (deps.readdir ?? fs.readdir)(path.join(root, 'lib'))) if (/^python3/.test(d)) candidates.push(path.join(root, 'lib', d, 'site-packages'))
  } catch {
    // no lib folder
  }
  for (const dir of candidates) {
    let names
    try {
      names = await (deps.readdir ?? fs.readdir)(dir)
    } catch {
      continue
    }
    const out = {}
    for (const n of names) {
      const m = /^([A-Za-z0-9_.-]+?)-(\d[^-]*)\.dist-info$/.exec(n)
      if (m) out[m[1].toLowerCase().replace(/[-.]/g, '_')] = m[2]
    }
    if (Object.keys(out).length) return out
  }
  return {}
}

/** "dbt-core 1.10.4, dbt-duckdb 1.10.0" and MetricFlow's own version. */
function summarizeVersions(v) {
  const adapters = Object.entries(v)
    .filter(([k]) => /^dbt_/.test(k) && !['dbt_core', 'dbt_metricflow', 'dbt_semantic_interfaces', 'dbt_extractor', 'dbt_common', 'dbt_adapters', 'dbt_protos', 'dbt_core_experimental_parser'].includes(k))
    .map(([k, ver]) => `${k.replace(/_/g, '-')} ${ver}`)
  return {
    metricflow: v.metricflow ?? v.dbt_metricflow,
    dbt: [v.dbt_core && `dbt-core ${v.dbt_core}`, ...adapters].filter(Boolean).join(', ') || undefined,
  }
}

// ---------------------------------------------------------------- queries

/** Check a query request against the manifest; returns the mf arguments. Throws a readable message. */
function queryArgs(req, manifest, { defaultLimit = RESULT_ROWS } = {}) {
  if (!req || typeof req !== 'object') throw new Error('No query.')
  const metricNames = new Set(manifest.metrics.map((m) => m.name))
  const dimNames = new Set(manifest.dimensions.map((d) => d.name))
  const metrics = arr(req.metrics)
  if (!metrics.length || metrics.length > 20) throw new Error('Pick 1 to 20 metrics.')
  for (const m of metrics) if (typeof m !== 'string' || !NAME.test(m) || !metricNames.has(m)) throw new Error(`Unknown metric: ${String(m).slice(0, 80)}`)
  const groupBy = arr(req.groupBy)
  if (groupBy.length > 10) throw new Error('Group by at most 10 dimensions.')
  for (const g of groupBy) {
    if (typeof g !== 'string' || !GROUP_BY.test(g)) throw new Error(`Not a dimension name: ${String(g).slice(0, 80)}`)
    const parts = g.split('__')
    const base = GRAINS.includes(parts.at(-1)) && parts.length > 1 ? parts.slice(0, -1).join('__') : g
    if (!dimNames.has(base) && !dimNames.has(g)) throw new Error(`Unknown dimension: ${g}`)
  }
  const where = arr(req.where)
  if (where.length > 10) throw new Error('At most 10 filters.')
  for (const w of where) if (typeof w !== 'string' || !w.trim() || w.length > 2000 || /[\0\r\n]/.test(w)) throw new Error('A filter must be one line of at most 2000 characters.')
  for (const d of [req.start, req.end]) if (d !== undefined && d !== null && d !== '' && !(typeof d === 'string' && DATE.test(d))) throw new Error('Dates must look like 2026-01-31.')
  const orderBy = arr(req.orderBy)
  const allowedOrder = new Set([...metrics, ...groupBy])
  for (const o of orderBy) if (typeof o !== 'string' || !allowedOrder.has(o.replace(/^-/, ''))) throw new Error(`Can only sort by a chosen metric or group-by: ${String(o).slice(0, 80)}`)
  const limit = req.limit === undefined || req.limit === null ? undefined : Number(req.limit)
  if (limit !== undefined && !(Number.isInteger(limit) && limit >= 1 && limit <= RESULT_ROWS)) throw new Error(`The row limit must be 1 to ${RESULT_ROWS}.`)

  const args = ['query', '--metrics', metrics.join(',')]
  if (groupBy.length) args.push('--group-by', groupBy.join(','))
  for (const w of where) args.push('--where', w)
  if (req.start) args.push('--start-time', req.start)
  if (req.end) args.push('--end-time', req.end)
  if (orderBy.length) args.push('--order', orderBy.join(','))
  if (limit ?? defaultLimit) args.push('--limit', String(limit ?? defaultLimit))
  return args
}

/** RFC 4180 CSV, in memory. */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const s = String(text).replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const NUMBER = /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i

/** CSV text -> { columns, rows }, numbers as numbers, empty cells as null; time values trimmed to the date when midnight. */
function csvResult(text) {
  const all = parseCsv(text).filter((r) => r.length > 1 || r[0] !== '')
  const [header = [], ...body] = all
  const columns = header.map((h) => h.trim().toLowerCase())
  const rows = body.slice(0, RESULT_ROWS).map((r) =>
    columns.map((_, i) => {
      const v = r[i]
      if (v === undefined || v === '' || v === 'None' || v === 'NaN') return null
      if (NUMBER.test(v)) return Number(v)
      return /^\d{4}-\d{2}-\d{2}[ T]00:00:00(\.0+)?$/.test(v) ? v.slice(0, 10) : v
    }),
  )
  return { columns, rows, truncated: body.length > RESULT_ROWS || undefined }
}

function killTree(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {})
  else child.kill('SIGTERM')
}

/** Run mf to completion, no shell: { code, stdout, stderr, timedOut }. Never throws. */
function runMf(file, args, { cwd, timeoutMs = QUERY_TIMEOUT_MS, env } = {}) {
  return new Promise((resolve) => {
    let child
    const binDir = path.dirname(file)
    const base = env ?? process.env
    const PATH = `${binDir}${path.delimiter}${base.PATH ?? base.Path ?? ''}`
    try {
      child = spawn(file, args, {
        cwd,
        windowsHide: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...base, PATH, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', NO_COLOR: '1', TERM: 'dumb', DBT_SEND_ANONYMOUS_USAGE_STATS: 'false' },
      })
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: String(error.message), timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)
    const take = (cur, d) => (cur.length >= OUTPUT_LIMIT ? cur : cur + d)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => (stdout = take(stdout, d)))
    child.stderr.on('data', (d) => (stderr = take(stderr, d)))
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: stderr || String(error.message), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr, timedOut })
    })
  })
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g

/** The useful lines of a failed mf run, for the page. */
function mfError(res) {
  if (res.timedOut) return 'MetricFlow did not finish within 3 minutes and was stopped.'
  const text = `${res.stderr}\n${res.stdout}`.replace(ANSI, '').trim()
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !/^[\s|/\\-]*$/.test(l))
  const tail = lines.slice(-12).join('\n')
  return tail ? `MetricFlow failed:\n${tail}`.slice(0, 4000) : `MetricFlow failed (exit code ${res.code}).`
}

function assertRunnable(mf) {
  if (!mf) throw new Error('The mf command was not found in the project’s virtual environment (.venv, venv) or on PATH.')
  if (mf.shim) throw new Error('mf on PATH is a script, not mf.exe. Install MetricFlow with pip into a virtual environment in the project (.venv).')
}

/** Run a checked query. The temp folder holding mf's CSV is deleted before this returns. */
async function runQuery({ projectDir, mf, manifest, req }, deps = {}) {
  assertRunnable(mf)
  const args = queryArgs(req, manifest)
  const tmp = await fs.mkdtemp(path.join(deps.tmpdir ?? os.tmpdir(), 'monorail-mf-'))
  const csv = path.join(tmp, 'result.csv')
  const started = Date.now()
  try {
    const res = await (deps.runMf ?? runMf)(mf.file, [...args, '--csv', csv], { cwd: projectDir })
    if (res.code !== 0) throw new Error(mfError(res))
    let text
    try {
      text = await fs.readFile(csv, 'utf8')
    } catch {
      throw new Error('MetricFlow finished but wrote no result.')
    }
    return { ...csvResult(text), ms: Date.now() - started }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

/** The SQL MetricFlow would run, without running it. */
async function explainQuery({ projectDir, mf, manifest, req }, deps = {}) {
  assertRunnable(mf)
  const args = queryArgs(req, manifest, { defaultLimit: 0 })
  const res = await (deps.runMf ?? runMf)(mf.file, [...args, '--explain'], { cwd: projectDir })
  if (res.code !== 0) throw new Error(mfError(res))
  return { sql: extractSql(res.stdout) }
}

/** mf --explain prints a heading line, then the SQL. */
function extractSql(stdout) {
  const lines = String(stdout).replace(ANSI, '').split(/\r?\n/)
  const i = lines.findIndex((l) => /\bSQL\b/.test(l) && /explain|remove/i.test(l))
  const body = (i >= 0 ? lines.slice(i + 1) : lines).join('\n').trim()
  return body
}

/** mf validate-configs without warehouse checks, for the connector's action. */
async function validateConfigs({ projectDir, mf }, deps = {}) {
  assertRunnable(mf)
  const res = await (deps.runMf ?? runMf)(mf.file, ['validate-configs', '--skip-dw'], { cwd: projectDir })
  const out = `${res.stdout}\n${res.stderr}`.replace(ANSI, '').trim().slice(-6000)
  return { ok: res.code === 0, output: out, error: res.code === 0 ? undefined : mfError(res) }
}

// ---------------------------------------------------------------- the whole picture

/**
 * Everything the page and the MCP list tool show, from files only.
 * settings: { project, run } from the connection (run === 'on' allows queries).
 */
async function loadProject(settings, deps = {}) {
  const readAt = new Date().toISOString()
  const empty = { metrics: [], models: [], dimensions: [], savedQueries: [], metricflow: { canRun: false, found: false }, readAt }
  const project = await readProject(settings?.project, deps)
  if (project.error) return { ...empty, block: 'no-project' }
  const [manifest, meta, mf] = await Promise.all([readManifest(project.targetDir, deps), manifestMeta(project.targetDir, deps), findMf(project.dir, deps)])
  const versions = mf ? summarizeVersions(await packageVersions(mf.file, deps)) : {}
  const metricflow = { canRun: settings?.run === 'on', found: !!mf && !mf.shim, version: versions.metricflow }
  const info = { name: project.name, folderName: project.folderName, dbtVersion: meta.dbtVersion, manifestAt: meta.generatedAt ?? manifest.mtime }
  if (manifest.error) return { ...empty, block: manifest.error, blockDetail: manifest.detail, project: info, metricflow }
  const { mtime: _m, ...data } = manifest
  return { ...data, project: info, metricflow, readAt, _internal: { project, mf } }
}

module.exports = {
  loadProject,
  readProject,
  readManifest,
  parseManifest,
  manifestMeta,
  findProfiles,
  findMf,
  packageVersions,
  summarizeVersions,
  queryArgs,
  runQuery,
  explainQuery,
  validateConfigs,
  csvResult,
  parseCsv,
  extractSql,
  cleanGroupBy,
  parseProjectYml,
  RESULT_ROWS,
}
