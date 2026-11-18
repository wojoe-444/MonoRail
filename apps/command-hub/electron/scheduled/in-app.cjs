// The list behind Scheduled > In-App: every job MonoRail runs on a timer while
// it is open (report rebuilds, backups, update checks, drive samples, the PR
// watcher, Remote access checks, ingestion pipelines deployed to this PC).
//
// Each backend that owns such a job registers a provider from its start(ctx):
//
//   registerProvider({
//     id: 'backups',                  // namespaces the rows: 'backups:flashcards'
//     list: async () => [row, ...],   // read the job's own state; never starts work
//     run: async (rowId) => {},       // optional: "Run now" for the rows that allow it
//   })
//
// A row is plain JSON (the page shows it as it is):
//   id, title, description, group,
//   schedule     'Every 15 minutes'
//   state        'Ready' | 'Running' | 'Disabled'   (Task Scheduler's words)
//   lastRun      ISO time or null
//   nextRun      ISO time or null (null while disabled)
//   result       'ok' | 'failed' | null (null: never ran, or nothing to report)
//   note         one line: the error, or why it is disabled
//   where        { label, path }: the page that owns the job's settings
//   runnable     false hides "Run now" for this row
//
// Listing only reads state the job already keeps (its own files, or memory), so
// opening the page never starts a build, a backup or a network call. A provider
// that throws is reported in `problems` and does not hide the others. No
// Electron here, so tests run it under Node. The registry keeps no files.

const providers = new Map()

/** Add or replace a provider. */
function registerProvider(provider) {
  if (!provider || typeof provider.id !== 'string' || !provider.id || provider.id.includes(':')) throw new Error('A provider needs an id without ":"')
  if (typeof provider.list !== 'function') throw new Error(`Provider ${provider.id} needs list()`)
  providers.set(provider.id, provider)
}

/** Tests only. */
function clearProviders() {
  providers.clear()
}

const STATES = new Set(['Ready', 'Running', 'Disabled'])
const text = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : undefined)
const iso = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null)

function cleanRow(provider, row) {
  const state = STATES.has(row.state) ? row.state : 'Ready'
  return {
    id: `${provider.id}:${row.id}`,
    title: text(row.title, 120) ?? row.id,
    description: text(row.description, 400) ?? '',
    group: text(row.group, 60) ?? 'Other',
    schedule: text(row.schedule, 120) ?? '',
    state,
    lastRun: iso(row.lastRun),
    nextRun: state === 'Disabled' ? null : iso(row.nextRun),
    result: row.result === 'ok' || row.result === 'failed' ? row.result : null,
    note: text(row.note, 300) ?? '',
    where: row.where && typeof row.where.path === 'string' ? { label: String(row.where.label ?? ''), path: row.where.path } : null,
    runnable: typeof provider.run === 'function' && row.runnable !== false && state === 'Ready',
  }
}

/** Every job, grouped and sorted by the page: { jobs, problems: [{ source, error }], readAt }. */
async function list() {
  const jobs = []
  const problems = []
  for (const provider of providers.values()) {
    try {
      for (const row of await provider.list()) jobs.push(cleanRow(provider, row))
    } catch (e) {
      problems.push({ source: provider.title ?? provider.id, error: String(e?.message ?? e).split('\n')[0].slice(0, 300) })
    }
  }
  return { jobs, problems, readAt: new Date().toISOString() }
}

/** "Run now" for one row id as `list()` returned it. Only rows marked runnable. */
async function run(id) {
  const at = typeof id === 'string' ? id.indexOf(':') : -1
  const provider = at > 0 ? providers.get(id.slice(0, at)) : undefined
  if (!provider || typeof provider.run !== 'function') throw new Error('This job cannot be run from here.')
  const local = id.slice(at + 1)
  const row = (await provider.list()).map((r) => cleanRow(provider, r)).find((r) => r.id === id)
  if (!row) throw new Error('Job not found.')
  if (!row.runnable) throw new Error(row.state === 'Running' ? 'This job is already running.' : 'This job cannot be run now.')
  await provider.run(local)
}

/** 15 minutes -> 'Every 15 minutes'; 1 hour -> 'Every hour'. */
function every(ms) {
  const units = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ]
  for (const [name, size] of units) {
    if (ms >= size && ms % size === 0) {
      const n = ms / size
      return n === 1 ? `Every ${name}` : `Every ${n} ${name}s`
    }
  }
  return `Every ${Math.round(ms / 1000)} seconds`
}

/** '3 times per day' for a backup frequency { times, unit }. */
const timesPer = ({ times, unit }) => (times === 1 ? `Once per ${unit}` : `${times} times per ${unit}`)

module.exports = { registerProvider, clearProviders, list, run, every, timesPer }
