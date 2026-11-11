// Shared cache primitive for module and app backends. Rules and examples:
// docs/caching.md. Every cache is declared in ./declared.cjs (id, tier, file,
// time limits, content policy); opening an undeclared cache throws.
//
//   const cache = require('../cache/index.cjs')
//   const usage = cache.report(ctx, 'claude-stats.usage', { build, onBuilt })
//   await usage.read()              // page open: never builds
//   await usage.refresh({ force })  // Refresh button
//   cache.schedule(usage)           // background rebuilds (call from start(ctx))
//   cache.keyed('connections.sign-in').get(key, check, { definition, failed })
//   cache.incremental(ctx, id, { init, reduce }).read(key, file)
//   cache.history(ctx, id).add(snapshot, { csvRow })
//   cache.writeSummary(ctx, id, summary) / cache.readSummaries(rootDir)

const fs = require('node:fs/promises')
const path = require('node:path')

const declared = require('./declared.cjs')
const { HistoryCache } = require('./history.cjs')
const { IncrementalCache } = require('./incremental.cjs')
const { KeyedCache, definitionHash } = require('./keyed.cjs')
const { ReportCache } = require('./report.cjs')
const { readJson, writeJsonAtomic } = require('./files.cjs')

/** Check that `ctx.dataDir` is the declared folder of cache `id`. */
function dirFor(ctx, id) {
  const d = declared.declaration(id)
  const want = path.join(...d.folder.split('/'))
  if (!path.normalize(ctx.dataDir).endsWith(want)) throw new Error(`Cache ${id} belongs to ${d.folder}, not ${ctx.dataDir}`)
  return ctx.dataDir
}

const keyedCaches = new Map()

const api = {
  report: (ctx, id, opts) => new ReportCache(dirFor(ctx, id), id, { log: ctx.log, ...opts }),
  /** Keyed memory caches are shared per process: one per id. */
  keyed: (id, opts) => {
    if (!keyedCaches.has(id)) keyedCaches.set(id, new KeyedCache(id, opts))
    return keyedCaches.get(id)
  },
  incremental: (ctx, id, opts) => new IncrementalCache(dirFor(ctx, id), id, opts),
  history: (ctx, id, opts) => new HistoryCache(dirFor(ctx, id), id, opts),
  definitionHash,
}

// ---------------------------------------------------------------------------
// Summaries (D1): after each build a module writes a small summary file; Home
// reads only those files and never starts a read or a scan.

async function writeSummary(ctx, id, summary, { builtAt = new Date().toISOString() } = {}) {
  const d = declared.declaration(id)
  if (d.tier !== 'summary') throw new Error(`${id} is not a summary`)
  await writeJsonAtomic(path.join(dirFor(ctx, id), d.file), { version: d.version, builtAt, summary })
}

/** Every declared summary under userData: { [id]: { builtAt, ageMs, stale, summary } }. */
async function readSummaries(rootDir, { now = Date.now() } = {}) {
  const out = {}
  for (const d of declared.CACHES.filter((c) => c.tier === 'summary')) {
    const e = await readJson(path.join(rootDir, ...d.folder.split('/'), d.file))
    if (!e || e.version !== d.version) continue
    const ageMs = Math.max(0, now - Date.parse(e.builtAt))
    out[d.id] = { builtAt: e.builtAt, ageMs, ttlMs: d.ttlMs, stale: ageMs >= d.ttlMs, summary: e.summary }
  }
  return out
}

// ---------------------------------------------------------------------------
// Background schedule (C4): while the app runs, report caches with a
// scheduleMs are rebuilt when due. The old result stays readable until the new
// one replaces it. A failed build waits failureTtlMs (at most hourly retries).

const scheduled = new Set()
let timer

function schedule(report, { tickMs = 60_000, firstDelayMs = 15_000 } = {}) {
  if (!report.decl.scheduleMs) throw new Error(`${report.decl.id} has no scheduleMs`)
  scheduled.add(report)
  if (!timer) {
    const tick = () => void runDue()
    timer = setInterval(tick, tickMs)
    timer.unref?.()
    setTimeout(tick, firstDelayMs).unref?.()
  }
}

async function runDue() {
  for (const r of scheduled) {
    try {
      if (await r.due()) await r.refresh({ force: false, waitMs: 0 })
    } catch (e) {
      r.log?.('scheduled rebuild failed:', e.message)
    }
  }
}

function stopSchedule() {
  clearInterval(timer)
  timer = undefined
  scheduled.clear()
}

// ---------------------------------------------------------------------------
// Audit (A1): every file in a declared data folder must be declared.

/** Names in `dir` that `folder` does not declare (leftover temp files are listed too). */
async function auditDataDir(folder, dir) {
  const allowed = declared.declaredFiles(folder)
  let names
  try {
    names = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return names
    .map((n) => (n.isDirectory() ? `${n.name}/` : n.name))
    .filter((n) => !allowed.has(n))
}

/** Log undeclared files in every declared folder under userData (startup check). */
async function auditAll(rootDir, log = console.warn) {
  const report = {}
  for (const folder of declared.declaredFolders()) {
    const extra = await auditDataDir(folder, path.join(rootDir, ...folder.split('/')))
    if (extra.length) {
      report[folder] = extra
      log(`[cache] undeclared files in ${folder}: ${extra.join(', ')} (declare them in electron/cache/declared.cjs)`)
    }
  }
  return report
}

module.exports = { ...api, writeSummary, readSummaries, schedule, runDue, stopSchedule, auditDataDir, auditAll, declared }
