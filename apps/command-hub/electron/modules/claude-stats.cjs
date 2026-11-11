// Claude Stats backend: runs ccusage against the local Claude Code logs (the
// cost authority for Claude Code) and scans the session logs of every supported
// agent CLI (claude-stats-scan.cjs). Returns both in one cached report.
//
// Private data rule: the logs and the cached report never leave this machine.
// The cache lives in %APPDATA%\MonoRail\modules\claude-stats\usage.json.
// summarize() turns a report into the small digest the Home widget shows.

const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const { IDLE_GAP_MS } = require('./claude-stats-phases.cjs')
const { findPrice, normalizeModelId, rowCost } = require('./claude-stats-prices.cjs')
const { scanAll } = require('./claude-stats-scan.cjs')

const CACHE_FILE = 'usage.json'
const CACHE_MAX_AGE_MS = 10 * 60 * 1000
const REPORT_VERSION = 3
const SUMMARY_DAYS = 30

/** Path to the native ccusage binary installed with the app, if present. */
function bundledBinary() {
  const name = `@ccusage/ccusage-${process.platform}-${process.arch}`
  try {
    const pkg = require.resolve(`${name}/package.json`)
    const bin = path.join(path.dirname(pkg), 'bin', process.platform === 'win32' ? 'ccusage.exe' : 'ccusage')
    // Native binaries cannot run from inside app.asar; electron-builder unpacks them.
    return bin.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
  } catch {
    return undefined
  }
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: 512 * 1024 * 1024, windowsHide: true, timeout: 5 * 60 * 1000, ...opts },
      (err, stdout, stderr) => {
        if (err) {
          err.message = `${err.message}\n${String(stderr).slice(0, 2000)}`
          reject(err)
        } else resolve(stdout)
      },
    )
  })
}

/** Run one ccusage report and parse its JSON. Falls back to npx if no bundled binary. */
async function ccusage(args, log) {
  const full = ['claude', ...args, '--json', '--breakdown', '--mode', 'calculate']
  const bin = bundledBinary()
  const attempts = []
  if (bin) {
    attempts.push(() => run(bin, full))
    attempts.push(() => run(bin, [...full, '--offline'])) // pricing fetch failed: use bundled prices
  }
  attempts.push(() => run('npx', ['-y', 'ccusage@20', ...full], { shell: process.platform === 'win32' }))

  let lastErr
  for (const attempt of attempts) {
    try {
      return JSON.parse(await attempt())
    } catch (e) {
      lastErr = e
      log('ccusage attempt failed:', e.message.split('\n')[0])
    }
  }
  throw new Error(
    `Could not run ccusage. ${lastErr ? lastErr.message.split('\n')[0] : ''}`.trim(),
  )
}

async function readCache(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

async function collect(ctx) {
  const [daily, scan] = await Promise.all([
    ccusage(['daily', '--instances'], ctx.log).catch((e) => ({ error: e.message })),
    scanAll().catch((e) => {
      ctx.log('log scan failed:', e.message)
      return { error: e.message }
    }),
  ])
  // ccusage prices Claude Code; the scanner reads every source. One of them is enough.
  if (daily.error && scan.error) throw new Error(daily.error)
  const { phases = [], ...rest } = scan.error ? {} : scan
  return {
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'ccusage',
    daily: daily.error ? { projects: {} } : daily,
    ccusageError: daily.error,
    sessions: { sessions: [] },
    partners: { idleGapMinutes: IDLE_GAP_MS / 60000, error: scan.error, phases },
    scan: scan.error ? undefined : rest,
    scanError: scan.error,
  }
}

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Small digest of a report for the Home widget: API-equivalent cost per day
 * for the last 30 days and the top models by cost over those days. Claude Code
 * cost comes from ccusage (list prices from the logs if ccusage failed); pi's
 * logged cost is used where every request has one; the rest is list-priced.
 */
function summarize(report, now = new Date()) {
  const days = []
  for (let i = SUMMARY_DAYS - 1; i >= 0; i--) days.push(localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))
  const first = days[0]
  const byDay = new Map(days.map((d) => [d, 0]))
  const byModel = new Map()
  const add = (date, source, model, cost) => {
    if (!byDay.has(date) || !(cost > 0)) return
    byDay.set(date, byDay.get(date) + cost)
    const k = `${source}|${normalizeModelId(model)}`
    const m = byModel.get(k) ?? { source, model: normalizeModelId(model), cost: 0 }
    m.cost += cost
    byModel.set(k, m)
  }
  const haveCcusage = !report.ccusageError && Object.keys(report.daily?.projects ?? {}).length > 0
  if (haveCcusage) {
    for (const rows of Object.values(report.daily.projects)) {
      for (const r of rows) for (const b of r.modelBreakdowns ?? []) add(r.date, 'claude-code', b.modelName, b.cost)
    }
  }
  for (const r of report.scan?.requests ?? []) {
    if (r.date < first) continue
    if (r.source === 'claude-code' && haveCcusage) continue
    let cost
    if (r.logged && r.logged.n === r.n) cost = r.logged.input + r.logged.output + r.logged.cacheWrite + r.logged.cacheRead
    else {
      const price = findPrice(r.model)
      cost = price ? rowCost(price, r) : 0
    }
    add(r.date, r.source, r.model, cost)
  }
  const total = [...byDay.values()].reduce((a, b) => a + b, 0)
  return {
    version: 1,
    generatedAt: report.generatedAt,
    days: days.map((date) => ({ date, cost: byDay.get(date) })),
    total,
    topModels: [...byModel.values()].sort((a, b) => b.cost - a.cost).slice(0, 5),
  }
}

module.exports = {
  id: 'claude-stats',
  summarize,
  methods: {
    /**
     * getUsage({ refresh?: boolean })
     * Returns the cached report if it is fresh, otherwise runs ccusage.
     * If ccusage fails and a cache exists, returns the stale cache with `stale: true`.
     */
    async getUsage(ctx, args) {
      const file = path.join(ctx.dataDir, CACHE_FILE)
      const cached = await readCache(file)
      const fresh = cached?.version === REPORT_VERSION && Date.now() - Date.parse(cached.generatedAt) < CACHE_MAX_AGE_MS
      if (cached && fresh && !args?.refresh) return cached

      try {
        const report = await collect(ctx)
        await fs.writeFile(file, JSON.stringify(report))
        return report
      } catch (e) {
        if (cached) return { ...cached, stale: true, error: e.message }
        throw e
      }
    },
  },
}
