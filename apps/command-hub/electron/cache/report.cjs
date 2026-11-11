// Report cache: one expensive result saved to disk (tiers 'report' and
// 'reading').
//
//   read()            never builds (C3): the last good result, its age, and
//                     the build status. Pages call this when they open.
//   refresh({force})  builds under the lock file (A4). A second caller waits
//                     up to waitMs for the running build, then reports that it
//                     is still under way; it never starts another build. After
//                     a failure, a non-forced refresh does nothing until
//                     failureTtlMs has passed (C1, D4); force (the Refresh
//                     button, C5) skips that wait but still shares the lock.
//   due()             true when the background schedule should rebuild (C4).
//
// Files: <file> holds { version, builtAt, value } and is only replaced by a
// good build, atomically (A3). <file>.status.json holds the last attempt and
// its error, so a failure never touches the last good result (C2) and the
// backoff survives a restart.

const path = require('node:path')

const { declaration } = require('./declared.cjs')
const { lockHolder, readJson, sleep, tryLock, writeJsonAtomic } = require('./files.cjs')

const POLL_MS = 200

class ReportCache {
  /**
   * @param {string} dir the data folder (ctx.dataDir)
   * @param {string} id a declared cache id
   * @param {{ build: (info: { force: boolean }) => Promise<unknown>, onBuilt?: (value: unknown, builtAt: string) => Promise<void> | void, log?: (...a: unknown[]) => void, now?: () => number }} opts
   */
  constructor(dir, id, opts) {
    const d = declaration(id)
    if (d.storage !== 'disk' || !['report', 'reading'].includes(d.tier)) throw new Error(`${id} is not a report cache`)
    this.decl = d
    this.file = path.join(dir, d.file)
    this.statusFile = `${this.file}.status.json`
    this.lockFile = `${this.file}.lock`
    this.build = opts.build
    this.onBuilt = opts.onBuilt
    this.log = opts.log ?? (() => {})
    this.now = opts.now ?? Date.now
    this.running = undefined // this process's build promise
  }

  get waitMs() {
    return this.decl.waitMs ?? 15000
  }

  get timeoutMs() {
    return this.decl.timeoutMs ?? 5 * 60 * 1000
  }

  async #readEntry() {
    const e = await readJson(this.file)
    // An older format is rebuilt, never misread.
    if (!e || e.version !== this.decl.version || typeof e.builtAt !== 'string') return undefined
    return e
  }

  async #readStatus() {
    return (await readJson(this.statusFile)) ?? {}
  }

  /** The status the page shows: built time, age, stale, building, last failure, next retry. */
  async status(entry, st) {
    entry ??= await this.#readEntry()
    st ??= await this.#readStatus()
    const now = this.now()
    const builtMs = entry ? Date.parse(entry.builtAt) : undefined
    const failed = !!st.lastError && (!builtMs || Date.parse(st.lastAttemptAt ?? 0) > builtMs)
    const holder = this.runningSince ? { startedAt: this.runningSince } : await lockHolder(this.lockFile)
    const building = !!holder && now - Date.parse(holder.startedAt) < this.timeoutMs + 60_000
    const retryAt = failed && Number.isFinite(this.decl.failureTtlMs) ? Date.parse(st.lastAttemptAt) + this.decl.failureTtlMs : undefined
    return {
      id: this.decl.id,
      builtAt: entry?.builtAt,
      ageMs: builtMs === undefined ? undefined : Math.max(0, now - builtMs),
      ttlMs: this.decl.ttlMs,
      stale: builtMs === undefined ? true : now - builtMs >= this.decl.ttlMs,
      building,
      buildingSince: building ? holder.startedAt : undefined,
      lastAttemptAt: st.lastAttemptAt,
      lastError: failed ? st.lastError : undefined,
      nextRetryAt: retryAt === undefined ? undefined : new Date(retryAt).toISOString(),
      scheduleMs: this.decl.scheduleMs,
    }
  }

  /** The last good result and its status. Never starts a build. */
  async read() {
    const entry = await this.#readEntry()
    return { value: entry?.value, status: await this.status(entry) }
  }

  /** Should the background schedule rebuild now? */
  async due() {
    if (!this.decl.scheduleMs) return false
    const { status: s } = await this.read()
    if (s.building) return false
    if (s.nextRetryAt && this.now() < Date.parse(s.nextRetryAt)) return false
    return s.ageMs === undefined || s.ageMs >= this.decl.scheduleMs
  }

  /**
   * Build a new result unless one is fresh (or force). Returns { value, status }
   * once the build finishes, or after waitMs with status.building still true.
   */
  async refresh({ force = false, waitMs = this.waitMs } = {}) {
    if (!force) {
      const { value, status: s } = await this.read()
      const backingOff = s.nextRetryAt && this.now() < Date.parse(s.nextRetryAt)
      if ((value !== undefined && !s.stale) || backingOff) return { value, status: s }
    }
    const job = this.running ?? this.#start(force)
    // Either the build finished, or waitMs passed and status.building says it is still under way.
    let timer
    await Promise.race([job, new Promise((r) => (timer = setTimeout(r, waitMs)))])
    clearTimeout(timer)
    return this.read()
  }

  /** Start a build if this process can take the lock; else wait on the other holder. */
  #start(force) {
    const job = (async () => {
      const release = await tryLock(this.lockFile, { staleMs: this.timeoutMs + 60_000 })
      if (!release) {
        await this.#waitForOtherHolder()
        return
      }
      this.runningSince = new Date(this.now()).toISOString()
      try {
        await this.#runBuild(force)
      } finally {
        await release()
      }
    })()
    this.running = job.finally(() => {
      this.running = undefined
      this.runningSince = undefined
    })
    return this.running
  }

  async #waitForOtherHolder() {
    const until = this.now() + this.timeoutMs + 60_000
    while (this.now() < until && (await lockHolder(this.lockFile))) await sleep(POLL_MS)
  }

  async #runBuild(force) {
    const attemptAt = new Date(this.now()).toISOString()
    let timer
    try {
      const value = await Promise.race([
        this.build({ force }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Gave up after ${Math.round(this.timeoutMs / 1000)} s.`)), this.timeoutMs)
          timer.unref?.()
        }),
      ])
      const builtAt = new Date(this.now()).toISOString()
      await writeJsonAtomic(this.file, { version: this.decl.version, builtAt, value })
      await writeJsonAtomic(this.statusFile, { lastAttemptAt: attemptAt, lastSuccessAt: builtAt })
      if (this.onBuilt) {
        try {
          await this.onBuilt(value, builtAt)
        } catch (e) {
          this.log('after-build step failed:', e.message)
        }
      }
    } catch (e) {
      const prev = await this.#readStatus()
      this.log('build failed:', e.message)
      await writeJsonAtomic(this.statusFile, {
        lastAttemptAt: attemptAt,
        lastSuccessAt: prev.lastSuccessAt,
        lastError: String(e.message ?? e).slice(0, 2000),
      })
    } finally {
      clearTimeout(timer)
    }
  }
}

module.exports = { ReportCache }
