// BigQuery as the source of truth for the OpenMetadata page
// (docs/bigquery-metadata.md): runs the sync from localdb/bigquery-mirror.cjs
// into the copy on this PC (localdb mirrorDb()) and reports on it.
//
// Opt-in: nothing runs until the user adds the BigQuery metadata connection
// (hasConnection reads the saved list only). Then the copy is refreshed on the
// connection's schedule while MonoRail is open (a tick every minute; the first
// sync for a dataset runs on the next tick), on Sync now, or on Full refresh.
// One sync runs at a time; a failed one is retried after 15 minutes. The last
// result is kept in the copy's meta table (bq.last). Status only reads; it
// never starts a sync or a network call.

const localdb = require('../localdb/index.cjs')
const mirrorLib = require('../localdb/bigquery-mirror.cjs')

const KIND = 'bigquery-metadata'
const RETRY_MS = 15 * 60_000
const TICK_MS = 60_000
/** Explore flattens every field of every entry, so it gets at most this many. */
const EXPLORE_LIMIT = 5000

const EVERY_TEXT = { '15m': 'Every 15 minutes', '1h': 'Every hour', '6h': 'Every 6 hours', '24h': 'Once a day', manual: 'Only on Sync now' }

function createBigQuerySource(deps = {}) {
  const conns = () => deps.connections ?? require('../connections/index.cjs')
  const isSetUp = () => conns().hasConnection(KIND)
  const config = async () => conns().getCredentials(KIND)
  const store = () => (deps.mirror ? deps.mirror() : localdb.mirrorDb())
  const exists = () => (deps.mirror ? true : localdb.mirrorDbExists())
  const now = () => (deps.now ? deps.now() : Date.now())
  let client
  const bq = () => (client ??= deps.client ?? mirrorLib.gcloudClient({ fetch: deps.fetch }))
  let running // { promise, full, startedAt }

  function readLast() {
    if (!exists()) return undefined
    try {
      const raw = store().getMeta('bq.last')
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  }

  function writeLast(last) {
    try {
      store().setMeta('bq.last', JSON.stringify(last))
    } catch {
      // the copy cannot be opened: the error is reported by the page's status
    }
  }

  /** What the page and Scheduled show. Reads the copy's meta only. */
  async function status() {
    if (!(await isSetUp())) return { setUp: false }
    let cfg
    try {
      cfg = await config()
    } catch (e) {
      return { setUp: true, error: e.message }
    }
    const last = readLast()
    const copied = exists() ? store().getMeta('bq.source') : undefined
    const current = copied === cfg.source
    const lastForThis = last?.source === cfg.source ? last : undefined
    return {
      setUp: true,
      projectId: cfg.projectId,
      datasetId: cfg.datasetId,
      source: cfg.source,
      syncEvery: cfg.syncEvery,
      synced: current,
      entities: current ? Object.values(store().counts()).reduce((n, c) => n + c, 0) : 0,
      last: lastForThis,
      running: running ? { full: running.full, startedAt: new Date(running.startedAt).toISOString() } : undefined,
      nextAt: nextAt(cfg, lastForThis, current),
    }
  }

  function nextAt(cfg, last, current) {
    if (!cfg.everyMs) return undefined
    if (!current || !last) return new Date(now()).toISOString()
    const wait = last.ok ? cfg.everyMs : Math.min(cfg.everyMs, RETRY_MS)
    return new Date(Date.parse(last.at) + wait).toISOString()
  }

  /** Sync now. Joins a sync that is already running. */
  function sync({ full = false } = {}) {
    if (running) return running.promise
    const startedAt = now()
    const promise = (async () => {
      if (!(await isSetUp())) throw Object.assign(new Error('Set up BigQuery metadata on the Connections page first.'), { code: 'not-set-up' })
      const cfg = await config()
      try {
        const result = await mirrorLib.syncMirror({ client: bq(), store: store(), config: cfg, full })
        // Removed while it ran: leave nothing behind.
        if (!(await isSetUp())) {
          store().clearAll()
          return result
        }
        const last = { at: new Date(now()).toISOString(), ok: true, source: cfg.source, ms: now() - startedAt, ...result }
        writeLast(last)
        return last
      } catch (e) {
        writeLast({ at: new Date(now()).toISOString(), ok: false, source: cfg.source, error: e.message, code: e.code })
        throw e
      }
    })().finally(() => (running = undefined))
    running = { promise, full, startedAt }
    return promise
  }

  /** The scheduler: sync when due. Never throws. */
  async function tick() {
    try {
      if (running || !(await isSetUp())) return
      const s = await status()
      if (!s.nextAt || Date.parse(s.nextAt) > now()) return
      await sync()
    } catch {
      // kept in bq.last; the page and Scheduled show it
    }
  }

  async function inAppRows() {
    const s = await status()
    if (!s.setUp || !s.source) return []
    return [
      {
        id: 'copy',
        title: `BigQuery metadata copy (${s.source})`,
        description: 'Copies what changed in the BigQuery dataset that is the source of truth into the copy on this PC.',
        group: 'OpenMetadata',
        schedule: EVERY_TEXT[s.syncEvery] ?? '',
        state: s.running ? 'Running' : s.syncEvery === 'manual' ? 'Disabled' : 'Ready',
        lastRun: s.last?.at ?? null,
        nextRun: s.nextAt ?? null,
        result: s.last ? (s.last.ok ? 'ok' : 'failed') : null,
        note: s.last && !s.last.ok ? s.last.error : s.syncEvery === 'manual' ? 'Refreshed only when you press Sync now.' : '',
        where: { label: 'OpenMetadata', path: '/openmetadata' },
      },
    ]
  }

  /**
   * The copy's entities for Explore (not deleted, at most 5,000). Reads the
   * copy only: never syncs, never creates the copy file.
   */
  async function exploreEntities() {
    const s = await status()
    if (!s.setUp || !s.synced || !exists()) return { setUp: s.setUp, source: s.source, synced: false, entities: [], total: 0 }
    const { entities, total } = store().everything(EXPLORE_LIMIT)
    return { setUp: true, source: s.source, synced: true, entities, total, truncated: total > entities.length }
  }

  async function setupSql() {
    const cfg = await config()
    return { sql: mirrorLib.setupSql(cfg.projectId, cfg.datasetId), source: cfg.source }
  }

  return { isSetUp, status, sync, tick, inAppRows, setupSql, exploreEntities, store, exists }
}

module.exports = { createBigQuerySource, KIND, TICK_MS }
