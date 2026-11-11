// GitHub+ scheduled backups.
//
// A schedule says "back up this repo X times per hour / day / week into a
// folder on this machine". Each backup is one `git bundle` file holding every
// branch and tag with full history (restore with `git clone <file>`). Only
// committed work is included; the working tree is never touched.
//
// Files go to <destination>/<repo name>/<repo name>-<timestamp>.bundle. They
// are written under a .partial name and renamed when complete, so a synced
// folder (OneDrive etc.) never uploads half a file. The newest `keep` bundles
// are kept; older ones for that repo are deleted.
//
// The scheduler runs inside MonoRail: it checks once a minute and once at
// startup, so a backup that came due while the app was closed runs as soon
// as it opens (one catch-up run, not one per missed slot).
//
// Private data rule: schedules and results live in
// %APPDATA%\MonoRail\apps\github-plus\backups.json.

const fs = require('node:fs/promises')
const path = require('node:path')

const git = require('./git.cjs')
const { writeAtomic } = require('../../cache/files.cjs')

const FILE = 'backups.json'
const UNIT_MS = { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }
const CHECK_EVERY_MS = 60_000
const MAX_TIMES = 24
const MAX_KEEP = 365

function createBackupService(getDataDir, log = () => {}) {
  const running = new Set()
  let timer

  const file = () => path.join(getDataDir(), FILE)

  async function readAll() {
    try {
      const data = JSON.parse(await fs.readFile(file(), 'utf8'))
      return data && typeof data === 'object' && data.repos ? data : { repos: {} }
    } catch {
      return { repos: {} }
    }
  }

  // writeAtomic retries the rename while Windows briefly holds the old file open.
  const writeAll = (data) => writeAtomic(file(), JSON.stringify(data, null, 2))

  async function update(repo, fn) {
    const data = await readAll()
    data.repos[repo] = fn(data.repos[repo])
    if (!data.repos[repo]) delete data.repos[repo]
    await writeAll(data)
    return data.repos[repo]
  }

  function validateSchedule(s) {
    if (!s || typeof s !== 'object') throw new Error('Invalid backup settings')
    const times = Math.trunc(Number(s.times))
    if (!(times >= 1 && times <= MAX_TIMES)) throw new Error(`Times must be between 1 and ${MAX_TIMES}`)
    if (!UNIT_MS[s.unit]) throw new Error('Unit must be hour, day or week')
    const keep = Math.trunc(Number(s.keep))
    if (!(keep >= 1 && keep <= MAX_KEEP)) throw new Error(`Keep must be between 1 and ${MAX_KEEP}`)
    if (typeof s.destination !== 'string' || !path.isAbsolute(s.destination)) throw new Error('Pick a destination folder')
    return { enabled: !!s.enabled, times, unit: s.unit, keep, destination: path.normalize(s.destination) }
  }

  const intervalMs = (s) => UNIT_MS[s.unit] / s.times

  /**
   * When the next backup is due (ISO), or undefined when the schedule is off.
   * Due one interval after the last success (immediately if there is none).
   * After a failure, retry no sooner than 15 minutes (or one interval, if shorter).
   */
  function nextDue(entry) {
    const s = entry?.schedule
    if (!s?.enabled) return undefined
    let due = entry.lastSuccessAt ? Date.parse(entry.lastSuccessAt) + intervalMs(s) : 0
    if (entry.lastResult && !entry.lastResult.ok && entry.lastAttemptAt)
      due = Math.max(due, Date.parse(entry.lastAttemptAt) + Math.min(intervalMs(s), 15 * 60_000))
    return new Date(due).toISOString()
  }

  const safeName = (repo) => path.basename(repo).replace(/[^\w.-]+/g, '_') || 'repo'
  const stamp = (d) => d.toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '').replace('T', '_')

  async function listBundles(repo, destination) {
    const dir = path.join(destination, safeName(repo))
    const prefix = safeName(repo) + '-'
    let names = []
    try {
      names = await fs.readdir(dir)
    } catch {
      return []
    }
    const files = []
    for (const n of names) {
      if (!n.startsWith(prefix) || !n.endsWith('.bundle')) continue
      try {
        const st = await fs.stat(path.join(dir, n))
        files.push({ name: n, path: path.join(dir, n), size: st.size, createdAt: st.mtime.toISOString() })
      } catch {
        /* vanished */
      }
    }
    return files.sort((a, b) => b.name.localeCompare(a.name))
  }

  /** Make one backup now. Records the result either way. */
  async function run(repo) {
    if (running.has(repo)) throw new Error('A backup of this repository is already running')
    const entry = (await readAll()).repos[repo]
    if (!entry?.schedule) throw new Error('Set up backups for this repository first')
    const { destination, keep } = entry.schedule
    running.add(repo)
    const startedAt = new Date()
    try {
      const info = await git.openRepo(repo)
      if (info.isEmpty) throw new Error('This repository has no commits to back up yet')
      const dir = path.join(destination, safeName(repo))
      await fs.mkdir(dir, { recursive: true })
      const target = path.join(dir, `${safeName(repo)}-${stamp(startedAt)}.bundle`)
      const partial = target + '.partial'
      try {
        await git.createBundle(info.path, partial)
        await fs.rename(partial, target)
      } finally {
        await fs.rm(partial, { force: true })
      }
      const st = await fs.stat(target)
      // Retention: keep the newest `keep` bundles for this repo.
      const old = (await listBundles(repo, destination)).slice(keep)
      for (const f of old) await fs.rm(f.path, { force: true })
      const result = { ok: true, at: new Date().toISOString(), file: target, size: st.size }
      await update(repo, (e) => e && { ...e, lastAttemptAt: result.at, lastSuccessAt: result.at, lastResult: result })
      log('backup ok', target)
      return result
    } catch (err) {
      const result = { ok: false, at: new Date().toISOString(), error: String(err?.message ?? err).split('\n')[0].slice(0, 300) }
      await update(repo, (e) => e && { ...e, lastAttemptAt: result.at, lastResult: result })
      log('backup failed', repo, result.error)
      throw new Error(result.error)
    } finally {
      running.delete(repo)
    }
  }

  /** Run every backup that is due. Failures are recorded and retried after a short wait. */
  async function tick() {
    const { repos } = await readAll()
    const now = Date.now()
    for (const [repo, entry] of Object.entries(repos)) {
      const due = nextDue(entry)
      if (due && Date.parse(due) <= now && !running.has(repo)) await run(repo).catch(() => undefined)
    }
  }

  return {
    async get(repo) {
      const entry = (await readAll()).repos[repo]
      const files = entry?.schedule ? await listBundles(repo, entry.schedule.destination) : []
      return {
        schedule: entry?.schedule ?? null,
        lastResult: entry?.lastResult ?? null,
        lastSuccessAt: entry?.lastSuccessAt ?? null,
        nextDueAt: nextDue(entry) ?? null,
        running: running.has(repo),
        files,
      }
    },
    async save(repo, schedule) {
      const s = validateSchedule(schedule)
      await update(repo, (e) => ({ ...(e ?? {}), schedule: s }))
      // A new or changed schedule may already be due (e.g. first setup): check soon.
      setTimeout(() => tick().catch(() => undefined), 2_000).unref?.()
      return this.get(repo)
    },
    async remove(repo) {
      await update(repo, () => undefined)
      return this.get(repo)
    },
    run,
    tick,
    start() {
      if (timer) return
      setTimeout(() => tick().catch(() => undefined), 10_000).unref?.()
      timer = setInterval(() => tick().catch(() => undefined), CHECK_EVERY_MS)
      timer.unref?.()
    },
    stop() {
      clearInterval(timer)
      timer = undefined
    },
    _nextDue: nextDue,
  }
}

module.exports = { createBackupService, UNIT_MS }
