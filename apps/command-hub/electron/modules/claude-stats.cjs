// Claude Stats backend: runs ccusage against the local Claude Code logs (the
// cost authority for Claude Code) and scans the session logs of every supported
// agent CLI (claude-stats-scan.cjs). Returns both in one cached report.
//
// Private data rule: the logs and the cached report never leave this machine.
// The cache lives in %APPDATA%\MonoRail\modules\claude-stats\usage.json and is
// run by the shared cache primitive (electron/cache, declared as
// 'claude-stats.usage'): opening the page only reads it; a build runs from the
// Refresh button or the background schedule, one at a time.

const { execFile } = require('node:child_process')
const path = require('node:path')

const cache = require('../cache/index.cjs')
const { IDLE_GAP_MS } = require('./claude-stats-phases.cjs')
const { scanAll } = require('./claude-stats-scan.cjs')

const REPORT_VERSION = cache.declared.declaration('claude-stats.usage').version

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

/** One report cache per data folder (the dev bridge and the app use different ones). */
const reports = new Map()
function usageCache(ctx) {
  if (!reports.has(ctx.dataDir)) {
    reports.set(
      ctx.dataDir,
      cache.report(ctx, 'claude-stats.usage', {
        build: () => collect(ctx),
        // Home reads only this small file (D1). summarize() is optional so the
        // summary shape stays owned by Claude Stats.
        onBuilt: async (report, builtAt) => {
          const summarize = module.exports.summarize
          if (typeof summarize === 'function') await cache.writeSummary(ctx, 'claude-stats.summary', summarize(report, new Date(builtAt)), { builtAt })
        },
      }),
    )
  }
  return reports.get(ctx.dataDir)
}

/** The page's view: the last good report (if any) plus the cache status. */
function view({ value, status }) {
  const base = value ?? {
    version: REPORT_VERSION,
    generatedAt: undefined,
    source: 'ccusage',
    daily: { projects: {} },
    sessions: { sessions: [] },
    missing: true,
  }
  // `stale`/`error` keep their old meaning: the last build failed, this is the saved report.
  return { ...base, cache: status, stale: !!status.lastError && !!value, error: status.lastError }
}

module.exports = {
  id: 'claude-stats',
  /** Background rebuilds while the app runs (C4). */
  start(ctx) {
    cache.schedule(usageCache(ctx))
  },
  methods: {
    /**
     * getUsage({ refresh?: boolean })
     * Without refresh: returns the saved report and its status, and never runs
     * ccusage (the schedule keeps it fresh). With refresh (the Refresh button):
     * builds a new report, sharing a build that is already running; returns
     * after the build or, if it takes longer than the wait, with
     * cache.building = true so the page polls.
     */
    async getUsage(ctx, args) {
      const usage = usageCache(ctx)
      return view(args?.refresh ? await usage.refresh({ force: true }) : await usage.read())
    },
  },
}
