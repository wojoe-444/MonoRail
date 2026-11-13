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
// Global backup folder (Settings > Backups, electron/backups/global.cjs): a
// schedule may follow the global folder (useGlobalFolder: backups go to
// <global folder>/github-plus/<repo name>/) and/or the global frequency
// (useGlobalFrequency: times, unit and keep come from there). Both are read
// when a backup runs, so changing the global folder only moves future backups;
// existing bundles stay where they are. A repo's own folder or frequency wins
// whenever its flag is off. Older schedules have neither flag and keep working
// exactly as before.
//
// Private data rule: schedules and results live in
// %APPDATA%\MonoRail\apps\github-plus\backups.json.

const fs = require('node:fs/promises')
const path = require('node:path')

const git = require('./git.cjs')
const { writeAtomic } = require('../../cache/files.cjs')
const { UNIT_MS, validateFrequency, nextDue: dueAt, stamp, listBackups, errorLine } = require('../../backups/schedule.cjs')
const global = require('../../backups/global.cjs')

const FILE = 'backups.json'
const CHECK_EVERY_MS = 60_000

/**
 * getDataDir() is %APPDATA%\MonoRail\apps\github-plus; the global settings sit
 * two folders up (<userData>\modules\backups), unless getUserData is given.
 */
function createBackupService(getDataDir, log = () => {}, getUserData = () => path.resolve(getDataDir(), '..', '..')) {
  const running = new Set()
  let timer

  const file = () => path.join(getDataDir(), FILE)
  const readGlobal = () => global.readGlobal(getUserData())

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

  function validateSchedule(s, g) {
    if (!s || typeof s !== 'object') throw new Error('Invalid backup settings')
    const useGlobalFolder = !!s.useGlobalFolder
    const useGlobalFrequency = !!s.useGlobalFrequency
    if ((useGlobalFolder || useGlobalFrequency) && !g.enabled)
      throw new Error('The global backup folder is off. Turn it on in Settings > Backups, or choose a folder and frequency here.')
    const freq = validateFrequency(s)
    let destination = ''
    if (typeof s.destination === 'string' && s.destination && path.isAbsolute(s.destination)) destination = path.normalize(s.destination)
    if (!useGlobalFolder && !destination) throw new Error('Pick a destination folder')
    return { enabled: !!s.enabled, ...freq, destination, useGlobalFolder, useGlobalFrequency }
  }

  /**
   * What a schedule means right now, with the global settings applied:
   * { destination, times, unit, keep } or { problem } when it cannot run
   * (it follows the global folder or frequency and that is off).
   */
  function effective(s, g) {
    if (!s) return null
    if ((s.useGlobalFolder || s.useGlobalFrequency) && !g.enabled)
      return { problem: 'This schedule uses the global backup folder, which is off. Turn it on in Settings > Backups, or choose a folder and frequency here.' }
    const destination = s.useGlobalFolder ? global.pageRoot(g, 'github-plus') : s.destination
    const f = s.useGlobalFrequency ? g : s
    return { destination, times: f.times, unit: f.unit, keep: f.keep }
  }

  /** When the next backup is due (ISO), or undefined when the schedule is off or cannot run. */
  function nextDue(entry, g) {
    const s = entry?.schedule
    if (!s?.enabled) return undefined
    const eff = effective(s, g)
    return eff?.problem ? undefined : dueAt(eff, entry)
  }

  const safeName = (repo) => path.basename(repo).replace(/[^\w.-]+/g, '_') || 'repo'
  const listBundles = (repo, destination) => listBackups(path.join(destination, safeName(repo)), safeName(repo) + '-', '.bundle')

  /** Make one backup now. Records the result either way. */
  async function run(repo) {
    if (running.has(repo)) throw new Error('A backup of this repository is already running')
    const entry = (await readAll()).repos[repo]
    if (!entry?.schedule) throw new Error('Set up backups for this repository first')
    const eff = effective(entry.schedule, await readGlobal())
    if (eff.problem) throw new Error(eff.problem)
    const { destination, keep } = eff
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
      // Retention: keep the newest `keep` bundles for this repo, in this folder only.
      const old = (await listBundles(repo, destination)).slice(keep)
      for (const f of old) await fs.rm(f.path, { force: true })
      const result = { ok: true, at: new Date().toISOString(), file: target, size: st.size }
      await update(repo, (e) => e && { ...e, lastAttemptAt: result.at, lastSuccessAt: result.at, lastResult: result })
      log('backup ok', target)
      return result
    } catch (err) {
      const result = { ok: false, at: new Date().toISOString(), error: errorLine(err) }
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
    const g = await readGlobal()
    const now = Date.now()
    for (const [repo, entry] of Object.entries(repos)) {
      const due = nextDue(entry, g)
      if (due && Date.parse(due) <= now && !running.has(repo)) await run(repo).catch(() => undefined)
    }
  }

  return {
    async get(repo) {
      const entry = (await readAll()).repos[repo]
      const g = await readGlobal()
      const eff = effective(entry?.schedule, g)
      const files = eff?.destination ? await listBundles(repo, eff.destination) : []
      return {
        schedule: entry?.schedule ?? null,
        effective: eff && !eff.problem ? eff : null,
        problem: eff?.problem ?? null,
        global: global.summary(g),
        globalFolder: global.pageRoot(g, 'github-plus'),
        lastResult: entry?.lastResult ?? null,
        lastSuccessAt: entry?.lastSuccessAt ?? null,
        nextDueAt: nextDue(entry, g) ?? null,
        running: running.has(repo),
        files,
      }
    },
    async save(repo, schedule) {
      const s = validateSchedule(schedule, await readGlobal())
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
    _effective: effective,
  }
}

module.exports = { createBackupService, UNIT_MS }
