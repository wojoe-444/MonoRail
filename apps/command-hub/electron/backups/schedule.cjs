// Shared backup schedule rules: "X times per hour / day / week, keep the
// newest N". Used by GitHub+'s per-repo backups and by the global backup
// folder (Settings > Backups). No Electron here, so tests run under Node.

const fs = require('node:fs/promises')
const path = require('node:path')

const UNIT_MS = Object.freeze({ hour: 3_600_000, day: 86_400_000, week: 604_800_000 })
const MAX_TIMES = 24
const MAX_KEEP = 365
const RETRY_MS = 15 * 60_000

/** Validate and normalize { times, unit, keep }; throws a user-facing message. */
function validateFrequency(s) {
  if (!s || typeof s !== 'object') throw new Error('Invalid backup settings')
  const times = Math.trunc(Number(s.times))
  if (!(times >= 1 && times <= MAX_TIMES)) throw new Error(`Times must be between 1 and ${MAX_TIMES}`)
  if (!Object.hasOwn(UNIT_MS, s.unit)) throw new Error('Unit must be hour, day or week')
  const keep = Math.trunc(Number(s.keep))
  if (!(keep >= 1 && keep <= MAX_KEEP)) throw new Error(`Keep must be between 1 and ${MAX_KEEP}`)
  return { times, unit: s.unit, keep }
}

const intervalMs = (f) => UNIT_MS[f.unit] / f.times

/**
 * When the next backup is due (ISO), or undefined when `frequency` is null
 * (the schedule is off). Due one interval after the last success
 * (immediately if there is none). After a failure, retry no sooner than 15
 * minutes (or one interval, if shorter).
 */
function nextDue(frequency, entry) {
  if (!frequency) return undefined
  let due = entry?.lastSuccessAt ? Date.parse(entry.lastSuccessAt) + intervalMs(frequency) : 0
  if (entry?.lastResult && !entry.lastResult.ok && entry.lastAttemptAt)
    due = Math.max(due, Date.parse(entry.lastAttemptAt) + Math.min(intervalMs(frequency), RETRY_MS))
  return new Date(due).toISOString()
}

/** File-name timestamp, e.g. 2026-11-11_200532 (UTC). Sorts by time. */
const stamp = (d) => d.toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '').replace('T', '_')

/** Files in `dir` named `<prefix><stamp><suffix>`, newest first. */
async function listBackups(dir, prefix, suffix) {
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const files = []
  for (const n of names) {
    if (!n.startsWith(prefix) || !n.endsWith(suffix)) continue
    try {
      const st = await fs.stat(path.join(dir, n))
      if (st.isFile()) files.push({ name: n, path: path.join(dir, n), size: st.size, createdAt: st.mtime.toISOString() })
    } catch {
      /* vanished */
    }
  }
  return files.sort((a, b) => b.name.localeCompare(a.name))
}

/** Delete all but the newest `keep` backups matching prefix/suffix in `dir`. Only ever touches those files. */
async function prune(dir, prefix, suffix, keep) {
  for (const f of (await listBackups(dir, prefix, suffix)).slice(keep)) await fs.rm(f.path, { force: true })
}

const errorLine = (err) => String(err?.message ?? err).split('\n')[0].slice(0, 300)

module.exports = { UNIT_MS, MAX_TIMES, MAX_KEEP, validateFrequency, intervalMs, nextDue, stamp, listBackups, prune, errorLine }
