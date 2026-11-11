// Spending limit for agent turns MonoRail runs (Chat, the Coordinator and its
// child turns, and Agent access' ask_coordinator). Off by default.
//
// One file in Chat's data folder, spending.json:
//   { format, settings: { enabled, dailyUsd, monthlyUsd, warnAt, onLimit },
//     days: { 'YYYY-MM-DD': usd }, allowOnce }
// Numbers only: no prompts, chat ids or paths. Spend is only counted while the
// limit is on, so nothing is written for anyone who never turns it on.
//
// No Electron here and everything is synchronous: the coordinator worker and
// the MCP server run turns from their own processes, and a turn's cost is
// booked from the turn's synchronous onFinish. Every change takes
// spending.json.lock, reads the file fresh and writes it atomically. A damaged
// file is never treated as empty or written over, except by an explicit reset
// from Settings.

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const FILE = 'spending.json'
const LOCK_FILE = 'spending.json.lock'
const FORMAT = 1
const KEEP_DAYS = 62
const WARN_LEVELS = Object.freeze([50, 80, 90])
const ON_LIMIT = Object.freeze(['stop', 'warn'])
const MAX_LIMIT_USD = 1_000_000
const LOCK_STALE_MS = 10_000

const DEFAULT_SETTINGS = Object.freeze({ enabled: false, dailyUsd: null, monthlyUsd: null, warnAt: 80, onLimit: 'stop' })

class SpendingLimitError extends Error {
  constructor(message) {
    super(message)
    this.code = 'spending-limit'
  }
}

// ---------- days ----------

const pad = (n) => String(n).padStart(2, '0')
function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const monthKey = (ms) => dayKey(ms).slice(0, 7)
function nextDay(ms) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}
function nextMonth(ms) {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
}

// ---------- validation ----------

function limitArg(v, field) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0 || n > MAX_LIMIT_USD) throw new Error(`${field} must be a dollar amount above 0, or empty for none.`)
  return Math.round(n * 100) / 100
}

/** Settings from the page, checked field by field. Unknown fields are dropped. */
function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new Error('Spending settings are missing.')
  const s = {
    enabled: input.enabled === true,
    dailyUsd: limitArg(input.dailyUsd, 'The daily limit'),
    monthlyUsd: limitArg(input.monthlyUsd, 'The monthly limit'),
    warnAt: WARN_LEVELS.includes(Number(input.warnAt)) ? Number(input.warnAt) : DEFAULT_SETTINGS.warnAt,
    onLimit: ON_LIMIT.includes(input.onLimit) ? input.onLimit : DEFAULT_SETTINGS.onLimit,
  }
  return s
}

// ---------- file ----------

function emptyData() {
  return { format: FORMAT, settings: { ...DEFAULT_SETTINGS }, days: {}, allowOnce: false }
}

/** The file's data; a missing file is the default (off). Throws when damaged. */
function read(dataDir) {
  const file = path.join(dataDir, FILE)
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return emptyData()
    throw e
  }
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw damaged()
  }
  if (!data || typeof data !== 'object' || !data.settings || typeof data.settings !== 'object') throw damaged()
  if (data.format > FORMAT) throw new Error('The spending limit file was written by a newer MonoRail. Update MonoRail to use it.')
  const settings = { ...DEFAULT_SETTINGS, ...data.settings }
  const days = {}
  for (const [k, v] of Object.entries(data.days && typeof data.days === 'object' ? data.days : {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) days[k] = v
  }
  return { format: FORMAT, settings, days, allowOnce: data.allowOnce === true }
}

function damaged() {
  const e = new Error('The spending limit file is damaged, so MonoRail cannot tell how much has been spent. Reset it in Settings > Spending limit to start counting again.')
  e.code = 'spending-damaged'
  return e
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, file)
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Take the lock file (a stale one is broken), run fn, release. */
function withLock(dataDir, fn) {
  fs.mkdirSync(dataDir, { recursive: true })
  const lockFile = path.join(dataDir, LOCK_FILE)
  const deadline = Date.now() + 3000
  let fd
  for (;;) {
    try {
      fd = fs.openSync(lockFile, 'wx')
      break
    } catch (e) {
      // Windows: a lock file being deleted can't be opened yet (EPERM/EACCES): busy.
      const busy = process.platform === 'win32' && (e.code === 'EPERM' || e.code === 'EACCES')
      if (e.code !== 'EEXIST' && !busy) throw e
      if (busy) {
        if (Date.now() > deadline) throw new Error('The spending limit file is busy. Try again in a moment.')
        sleepSync(20)
        continue
      }
      try {
        if (Date.now() - fs.statSync(lockFile).mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockFile, { force: true })
          continue
        }
      } catch {
        continue
      }
      if (Date.now() > deadline) throw new Error('The spending limit file is busy. Try again in a moment.')
      sleepSync(20)
    }
  }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }))
    fs.closeSync(fd)
    return fn()
  } finally {
    fs.rmSync(lockFile, { force: true })
  }
}

/** Run fn(data, now) under the lock and save data. `fresh` starts from defaults (reset). */
function update(dataDir, fn, { now = Date.now(), fresh = false } = {}) {
  return withLock(dataDir, () => {
    const data = fresh ? emptyData() : read(dataDir)
    const result = fn(data, now)
    const oldest = dayKey(now - KEEP_DAYS * 86_400_000)
    for (const k of Object.keys(data.days)) if (k < oldest) delete data.days[k]
    writeAtomic(path.join(dataDir, FILE), data)
    return result
  })
}

// ---------- status ----------

function meter(spent, limit, warnAt) {
  if (limit == null) return { spent, limit: null, pct: null, state: 'ok' }
  const pct = limit > 0 ? (spent / limit) * 100 : 0
  return { spent, limit, pct, state: spent >= limit ? 'reached' : pct >= warnAt ? 'warn' : 'ok' }
}

const RANK = { off: 0, ok: 1, warn: 2, reached: 3 }

/** What the page shows, worked out from the data at `now`. */
function statusOf(data, now = Date.now()) {
  const s = data.settings
  const today = data.days[dayKey(now)] ?? 0
  const month = Object.entries(data.days)
    .filter(([k]) => k.startsWith(monthKey(now)))
    .reduce((n, [, v]) => n + v, 0)
  const daily = meter(today, s.dailyUsd, s.warnAt)
  const monthly = meter(month, s.monthlyUsd, s.warnAt)
  let state = 'off'
  let period
  if (s.enabled) {
    state = 'ok'
    for (const [p, m] of [['day', daily], ['month', monthly]]) {
      if (RANK[m.state] > RANK[state]) {
        state = m.state
        period = p
      }
    }
  }
  // The day limit can be reached while the month is fine; a reached month wins.
  if (s.enabled && monthly.state === 'reached') period = 'month'
  const blocked = state === 'reached' && s.onLimit === 'stop'
  return {
    settings: { ...s },
    state,
    period,
    blocked: blocked && !data.allowOnce,
    allowOnce: blocked && data.allowOnce,
    daily,
    monthly,
    resetsAt: period === 'month' ? nextMonth(now) : period === 'day' ? nextDay(now) : undefined,
    monthLabel: new Date(now).toLocaleString('en-US', { month: 'long' }),
  }
}

/** Status for the page. A damaged file comes back as `{ state: 'damaged' }`, never thrown. */
function getStatus(dataDir, now = Date.now()) {
  try {
    return statusOf(read(dataDir), now)
  } catch (e) {
    if (e.code === 'spending-damaged') return { state: 'damaged', message: e.message }
    throw e
  }
}

function saveSettings(dataDir, input, now = Date.now()) {
  const settings = validateSettings(input)
  return update(dataDir, (data) => {
    data.settings = settings
    if (!settings.enabled) data.allowOnce = false
    return statusOf(data, now)
  }, { now })
}

/** Let the next turn start even though the limit is reached ("Allow one more turn"). */
function allowOneMore(dataDir, now = Date.now()) {
  return update(dataDir, (data) => {
    data.allowOnce = true
    return statusOf(data, now)
  }, { now })
}

/** Start over from the defaults; the only write that may replace a damaged file. User-started only. */
function reset(dataDir, now = Date.now()) {
  return update(dataDir, (data) => statusOf(data, now), { now, fresh: true })
}

/**
 * Called before a turn starts. Throws SpendingLimitError when the limit is
 * reached and set to stop new turns (a pending "allow one more" is used up
 * instead). Off or no file: nothing is read beyond the missing file, nothing
 * is written. A damaged file stops turns only while it cannot be read at
 * all, and says how to fix it.
 */
function checkBeforeTurn(dataDir, now = Date.now()) {
  if (!dataDir) return
  let data
  try {
    data = read(dataDir)
  } catch (e) {
    if (e.code === 'spending-damaged') throw new SpendingLimitError(e.message)
    throw e
  }
  if (!data.settings.enabled) return
  const st = statusOf(data, now)
  if (st.state !== 'reached' || data.settings.onLimit !== 'stop') return
  if (data.allowOnce) {
    update(dataDir, (d) => {
      d.allowOnce = false
    }, { now })
    return
  }
  const which = st.period === 'month' ? `This month's spending limit ($${fmt(st.monthly.limit)})` : `Today's spending limit ($${fmt(st.daily.limit)})`
  throw new SpendingLimitError(`${which} is reached, so new agent turns are paused. Change the limit or allow one more turn in Settings > Spending limit.`)
}

/** Book a finished turn's cost. Only counted while the limit is on; never throws. */
function record(dataDir, usd, now = Date.now()) {
  if (!dataDir || typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) return false
  try {
    const data = read(dataDir)
    if (!data.settings.enabled) return false
    update(dataDir, (d) => {
      const k = dayKey(now)
      d.days[k] = Math.round(((d.days[k] ?? 0) + usd) * 1e6) / 1e6
    }, { now })
    return true
  } catch {
    return false // bookkeeping is best-effort; a damaged file already stops turns
  }
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

module.exports = {
  FILE,
  LOCK_FILE,
  DEFAULT_SETTINGS,
  WARN_LEVELS,
  SpendingLimitError,
  getStatus,
  saveSettings,
  allowOneMore,
  reset,
  checkBeforeTurn,
  record,
  _internal: { read, statusOf, validateSettings, dayKey },
}
