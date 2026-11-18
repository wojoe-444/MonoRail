// The "This PC" runner for ingestion pipelines: what MonoRail can ingest by
// itself, with no OpenMetadata server. Each run returns OpenMetadata's
// pipelineStatus pieces (state plus one step summary per stage) and writes
// what it read into the local catalog (catalog.json, see ingestion-store.cjs).
//
//   SQLite service   metadata  tables, views and columns (read-only)
//                    profiler  row counts, nulls and distinct values per column
//   dbt (MetricFlow) dbt       models, seeds, snapshots and sources with their
//                              columns and lineage, from target/manifest.json
//
// SQLite work runs in a worker thread (node:sqlite is synchronous), so the app
// stays responsive and Kill can stop it at once. The database is opened
// read-only; no row data leaves the worker, only names and counts. No
// Electron here, so tests run it under Node.

const path = require('node:path')
const fs = require('node:fs/promises')
const { Worker } = require('node:worker_threads')

const mfLib = require('./semantic-mf.cjs')
const { stableStringify } = require('../localdb/index.cjs')

const MANIFEST_LIMIT = 64 * 1024 * 1024
/** Tables with more rows get a row count only, no per-column metrics (one full scan each). */
const DEFAULT_COLUMN_METRICS_ROW_LIMIT = 1_000_000

/** What each local service can run. */
const LOCAL_TYPES = Object.freeze({
  sqlite: ['metadata', 'profiler'],
  metricflow: ['dbt'],
})

// ---------------------------------------------------------------- filters

/** Check an OpenMetadata FilterPattern ({ includes, excludes } of regexes). Throws a readable message. */
function checkPattern(pattern, label) {
  if (pattern === undefined || pattern === null) return
  if (typeof pattern !== 'object') throw new Error(`The ${label} must have includes and excludes.`)
  for (const key of ['includes', 'excludes']) {
    const list = pattern[key]
    if (list === undefined) continue
    if (!Array.isArray(list) || list.length > 50) throw new Error(`The ${label} ${key} must be a list.`)
    for (const p of list) {
      if (typeof p !== 'string' || !p || p.length > 300) throw new Error(`Each ${label} ${key.slice(0, -1)} must be a regular expression.`)
      try {
        new RegExp(p)
      } catch {
        throw new Error(`"${p}" in the ${label} is not a valid regular expression.`)
      }
    }
  }
}

/** OpenMetadata's rule: anchored at the start, case-insensitive; includes (if any) must match, excludes must not. */
function passes(name, pattern) {
  if (!pattern) return true
  const match = (p) => new RegExp(`^(?:${p})`, 'i').test(name)
  if (Array.isArray(pattern.includes) && pattern.includes.length && !pattern.includes.some(match)) return false
  if (Array.isArray(pattern.excludes) && pattern.excludes.some(match)) return false
  return true
}

// ---------------------------------------------------------------- SQLite worker

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { DatabaseSync } = require('node:sqlite')
const q = (n) => '"' + String(n).replace(/"/g, '""') + '"'
const log = (line) => parentPort.postMessage({ log: line })
const { file, job, tables, rowLimit } = workerData
const db = new DatabaseSync(file, { readOnly: true, timeout: 5000 })
try {
  if (job === 'metadata') {
    const rows = db.prepare("SELECT name, type FROM sqlite_schema WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    const out = []
    for (const r of rows) {
      const cols = db.prepare('PRAGMA table_xinfo(' + q(r.name) + ')').all()
      out.push({ name: r.name, type: r.type, columns: cols.filter((c) => !c.hidden).map((c) => ({ name: c.name, type: c.type || '', notnull: !!c.notnull, pk: c.pk > 0 })) })
    }
    parentPort.postMessage({ result: out })
  } else if (job === 'profiler') {
    const out = []
    for (const t of tables) {
      try {
        const n = db.prepare('SELECT count(*) AS n FROM ' + q(t.name)).get().n
        const p = { name: t.name, rowCount: Number(n), columnCount: t.columns.length, columns: [] }
        if (n <= rowLimit && t.columns.length) {
          const parts = t.columns.map((c, i) => 'count(' + q(c) + ') AS v' + i + ', count(DISTINCT ' + q(c) + ') AS d' + i)
          const row = db.prepare('SELECT ' + parts.join(', ') + ' FROM ' + q(t.name)).get()
          p.columns = t.columns.map((c, i) => ({ name: c, valuesCount: Number(row['v' + i]), nullCount: Number(n) - Number(row['v' + i]), distinctCount: Number(row['d' + i]) }))
          log('Profiled ' + t.name + ': ' + n + ' rows, ' + t.columns.length + ' columns')
        } else {
          log('Counted ' + t.name + ': ' + n + ' rows' + (t.columns.length ? ' (over the row limit, so no column metrics)' : ''))
        }
        out.push(p)
      } catch (e) {
        out.push({ name: t.name, error: String(e && e.message || e) })
      }
    }
    parentPort.postMessage({ result: out })
  }
} finally {
  db.close()
}
`

/** Run one SQLite job in a worker. control.kill is set while it runs. */
function runSqliteWorker(data, { log, control }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: data })
    let done = false
    if (control) control.kill = () => void worker.terminate()
    worker.on('message', (m) => {
      if (m.log) log(m.log)
      if (m.result) {
        done = true
        resolve(m.result)
      }
    })
    worker.on('error', (e) => {
      done = true
      reject(e)
    })
    worker.on('exit', (code) => {
      if (control) control.kill = undefined
      if (!done) reject(new Error(code === 1 ? 'The run was stopped.' : `The SQLite reader stopped (exit ${code}).`))
    })
  })
}

// ---------------------------------------------------------------- helpers

const step = (name, counts = {}) => ({ name, records: 0, updated_records: 0, warnings: 0, errors: 0, filtered: 0, failures: [], ...counts })

function tableKey(t) {
  return [t.database, t.schema, t.name].join('.')
}

/** Flatten a service's catalog into a map of table key -> table, keeping database and schema names. */
function tablesOf(service) {
  const map = new Map()
  for (const db of service?.databases ?? []) for (const s of db.schemas ?? []) for (const t of s.tables ?? []) map.set(tableKey({ database: db.name, schema: s.name, name: t.name }), { ...t, database: db.name, schema: s.name })
  return map
}

/** Build a service's catalog from a flat list of tables (each with database and schema). */
function nest(tables) {
  const dbs = new Map()
  for (const t of [...tables].sort((a, b) => tableKey(a).localeCompare(tableKey(b)))) {
    const db = dbs.get(t.database) ?? new Map()
    const s = db.get(t.schema) ?? []
    const { database: _d, schema: _s, ...rest } = t
    s.push(rest)
    db.set(t.schema, s)
    dbs.set(t.database, db)
  }
  return [...dbs].map(([name, schemas]) => ({ name, schemas: [...schemas].map(([sname, list]) => ({ name: sname, tables: list })) }))
}

/** Merge freshly read tables into the old ones; returns { tables, added, updated, deleted }. */
const comparable = (t) => stableStringify({ ...t, profile: undefined, deleted: undefined })

function mergeTables(old, fresh, { markDeleted, keep = () => ({}) }) {
  const out = []
  let added = 0
  let updated = 0
  let deleted = 0
  for (const t of fresh) {
    const prev = old.get(tableKey(t))
    if (!prev || prev.deleted) added++
    else if (comparable(prev) !== comparable(t)) updated++
    out.push(prev ? { ...keep(prev), ...t, deleted: undefined } : t)
  }
  const freshKeys = new Set(fresh.map(tableKey))
  for (const [key, prev] of old) {
    if (freshKeys.has(key)) continue
    if (markDeleted) {
      if (!prev.deleted) deleted++
      out.push({ ...prev, deleted: true })
    }
  }
  return { tables: out, added, updated, deleted }
}

// ---------------------------------------------------------------- runners

async function runSqliteMetadata(pipeline, { creds, log, control, catalog }) {
  const cfg = pipeline.sourceConfig?.config ?? {}
  const file = creds.file
  log(`Reading ${path.basename(file)} (read-only)`)
  const raw = await runSqliteWorker({ file, job: 'metadata' }, { log, control })
  const source = step('SQLite source')
  const fresh = []
  for (const t of raw) {
    if (t.type === 'view' && cfg.includeViews === false) {
      source.filtered++
      continue
    }
    if (!passes(t.name, cfg.tableFilterPattern)) {
      source.filtered++
      log(`Filtered out ${t.name}`)
      continue
    }
    source.records++
    fresh.push({
      database: 'main',
      schema: 'main',
      name: t.name,
      tableType: t.type === 'view' ? 'View' : 'Regular',
      columns: t.columns.map((c) => ({ name: c.name, dataType: (c.type.split('(')[0] || 'UNKNOWN').toUpperCase(), dataTypeDisplay: c.type || undefined, constraint: c.pk ? 'PRIMARY_KEY' : c.notnull ? 'NOT_NULL' : undefined })),
    })
  }
  log(`Found ${raw.length} tables and views, ${source.filtered} filtered`)
  const sink = step('Local catalog sink')
  await catalog((services) => {
    const prev = services[pipeline.service.name]
    const merged = mergeTables(tablesOf(prev), fresh, { markDeleted: cfg.markDeletedTables !== false, keep: (t) => ({ profile: t.profile }) })
    services[pipeline.service.name] = { ...prev, serviceType: 'SQLite', updatedAt: new Date().toISOString(), databases: nest(merged.tables) }
    sink.records = fresh.length
    sink.updated_records = merged.updated
    log(`Catalog: ${merged.added} new, ${merged.updated} changed${merged.deleted ? `, ${merged.deleted} marked deleted` : ''}`)
  })
  return [source, sink]
}

async function runSqliteProfiler(pipeline, { creds, log, control, catalog, readCatalog }) {
  const cfg = pipeline.sourceConfig?.config ?? {}
  const known = [...tablesOf((await readCatalog()).services[pipeline.service.name]).values()].filter((t) => !t.deleted && t.tableType !== 'View')
  if (!known.length) throw new Error('No tables in the local catalog yet. Run a metadata pipeline for this service first.')
  const source = step('SQLite profiler')
  const chosen = known.filter((t) => {
    const ok = passes(t.name, cfg.tableFilterPattern)
    if (!ok) source.filtered++
    return ok
  })
  const rowLimit = Number.isFinite(cfg.columnMetricsRowLimit) && cfg.columnMetricsRowLimit > 0 ? cfg.columnMetricsRowLimit : DEFAULT_COLUMN_METRICS_ROW_LIMIT
  log(`Profiling ${chosen.length} tables (column metrics up to ${rowLimit.toLocaleString('en-US')} rows)`)
  const results = await runSqliteWorker({ file: creds.file, job: 'profiler', rowLimit, tables: chosen.map((t) => ({ name: t.name, columns: (t.columns ?? []).map((c) => c.name) })) }, { log, control })
  const now = Date.now()
  const byName = new Map()
  for (const r of results) {
    if (r.error) {
      source.errors++
      source.failures.push({ name: r.name, error: r.error })
      log(`Could not profile ${r.name}: ${r.error}`)
    } else {
      source.records++
      byName.set(r.name, { timestamp: now, rowCount: r.rowCount, columnCount: r.columnCount, columns: r.columns })
    }
  }
  const sink = step('Local catalog sink')
  await catalog((services) => {
    const svc = services[pipeline.service.name]
    for (const db of svc?.databases ?? []) for (const s of db.schemas ?? []) for (const t of s.tables ?? []) {
      const p = byName.get(t.name)
      if (p) {
        t.profile = p
        sink.records++
        sink.updated_records++
      }
    }
    if (svc) svc.updatedAt = new Date().toISOString()
  })
  return [source, sink]
}

/** Read dbt's target/manifest.json into tables and lineage. Exported for tests. */
function parseDbtManifest(manifest, cfg = {}) {
  const tables = []
  const filtered = { count: 0 }
  const fqnOf = new Map()
  const consider = (id, n, name, tableType) => {
    const database = n.database || 'default'
    const schema = n.schema || 'default'
    if (!passes(database, cfg.databaseFilterPattern) || !passes(schema, cfg.schemaFilterPattern) || !passes(name, cfg.tableFilterPattern)) {
      filtered.count++
      return
    }
    const cols = Object.values(n.columns ?? {}).map((c) => ({ name: c.name, dataType: c.data_type ? String(c.data_type).split('(')[0].toUpperCase() : 'UNKNOWN', dataTypeDisplay: c.data_type || undefined, description: cfg.dbtUpdateDescriptions === false ? undefined : c.description || undefined }))
    const t = { database, schema, name, tableType, columns: cols, description: cfg.dbtUpdateDescriptions === false ? undefined : n.description || undefined, tags: cfg.includeTags === false ? undefined : (n.tags?.length ? n.tags : undefined), extension: { dbt: { uniqueId: id, resourceType: n.resource_type, materialized: n.config?.materialized } } }
    tables.push(t)
    fqnOf.set(id, tableKey(t))
  }
  for (const [id, n] of Object.entries(manifest?.nodes ?? {})) {
    if (!['model', 'seed', 'snapshot'].includes(n?.resource_type)) continue
    if (n.config?.materialized === 'ephemeral') continue
    consider(id, n, n.alias || n.name, n.config?.materialized === 'view' ? 'View' : 'Regular')
  }
  for (const [id, n] of Object.entries(manifest?.sources ?? {})) consider(id, n, n.identifier || n.name, 'External')
  const lineage = []
  for (const [id, n] of Object.entries(manifest?.nodes ?? {})) {
    const to = fqnOf.get(id)
    if (!to) continue
    for (const dep of n.depends_on?.nodes ?? []) {
      const from = fqnOf.get(dep)
      if (from && from !== to) lineage.push({ from, to })
    }
  }
  const tests = Object.values(manifest?.nodes ?? {}).filter((n) => n?.resource_type === 'test').length
  return { tables, lineage, filtered: filtered.count, tests, dbtVersion: manifest?.metadata?.dbt_version }
}

async function runDbt(pipeline, { creds, log, catalog }) {
  const cfg = pipeline.sourceConfig?.config ?? {}
  const project = await mfLib.readProject(creds.project)
  if (project.error) throw new Error('The dbt project folder has no dbt_project.yml. Edit the MetricFlow connection.')
  const file = path.join(project.targetDir, 'manifest.json')
  let st
  try {
    st = await fs.stat(file)
  } catch {
    throw new Error('manifest.json not found. Run "dbt parse" (or any dbt command) in the project folder, then run this pipeline again.')
  }
  if (st.size > MANIFEST_LIMIT) throw new Error('target/manifest.json is larger than 64 MB.')
  log(`Reading target/manifest.json of ${project.name}`)
  let manifest
  try {
    manifest = JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (e) {
    throw new Error(`target/manifest.json could not be read: ${String(e?.message ?? e).split('\n')[0]}`)
  }
  const parsed = parseDbtManifest(manifest, cfg)
  const source = step('dbt manifest', { records: parsed.tables.length, filtered: parsed.filtered })
  log(`Found ${parsed.tables.length} models, seeds, snapshots and sources, ${parsed.lineage.length} lineage edges, ${parsed.tests} tests${parsed.dbtVersion ? ` (dbt ${parsed.dbtVersion})` : ''}`)
  const sink = step('Local catalog sink')
  await catalog((services) => {
    const prev = services[pipeline.service.name]
    const merged = mergeTables(tablesOf(prev), parsed.tables, { markDeleted: cfg.markDeletedTables !== false })
    services[pipeline.service.name] = { ...prev, serviceType: 'dbt', updatedAt: new Date().toISOString(), databases: nest(merged.tables), lineage: parsed.lineage }
    sink.records = parsed.tables.length + parsed.lineage.length
    sink.updated_records = merged.updated
    log(`Catalog: ${merged.added} new, ${merged.updated} changed${merged.deleted ? `, ${merged.deleted} marked deleted` : ''}`)
  })
  return [source, sink]
}

const RUNNERS = {
  'sqlite:metadata': runSqliteMetadata,
  'sqlite:profiler': runSqliteProfiler,
  'metricflow:dbt': runDbt,
}

/**
 * Run a local pipeline. ctx: { creds, log(line), control: { kill? },
 * catalog(change), readCatalog() }. Returns the step summaries; throws on
 * failure (the caller records a failed run).
 */
async function runLocal(pipeline, ctx) {
  const run = RUNNERS[`${pipeline.extension?.monorail?.serviceKind}:${pipeline.pipelineType}`]
  if (!run) throw new Error(`This PC cannot run ${pipeline.pipelineType} pipelines for this service.`)
  return run(pipeline, ctx)
}

module.exports = { LOCAL_TYPES, runLocal, checkPattern, passes, parseDbtManifest, mergeTables, tablesOf, nest, runSqliteWorker }
