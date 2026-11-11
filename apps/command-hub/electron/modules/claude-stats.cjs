// Claude Stats backend: runs ccusage against the local Claude Code logs
// (~/.claude/projects and ~/.config/claude) and returns its JSON reports.
//
// Private data rule: the logs and the cached report never leave this machine.
// The cache lives in %APPDATA%\Command Hub\modules\claude-stats\usage.json.

const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

const { collectPhases } = require('./claude-stats-phases.cjs')

const CACHE_FILE = 'usage.json'
const CACHE_MAX_AGE_MS = 10 * 60 * 1000
const REPORT_VERSION = 2

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
  const [byProjectDay, bySession, partners] = await Promise.all([
    ccusage(['daily', '--instances'], ctx.log),
    ccusage(['session'], ctx.log),
    collectPhases().catch((e) => {
      ctx.log('session partner parsing failed:', e.message)
      return { error: e.message, phases: [] }
    }),
  ])
  return {
    version: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'ccusage',
    daily: byProjectDay,
    sessions: bySession,
    partners,
  }
}

module.exports = {
  id: 'claude-stats',
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
