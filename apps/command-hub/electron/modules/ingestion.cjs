// Services page backend (Settings > Data > Services; docs/ingestion.md):
// data sources as OpenMetadata services, and OpenMetadata's ingestion
// pipelines that read them.
//
// Two runners, chosen per pipeline (extension.monorail.runner):
//
//   this-pc   MonoRail runs the pipeline itself while it is open, on its own
//             cron schedule (ingestion-local.cjs; listed under Scheduled >
//             In-App). Services are the data-source connections from
//             Connections (SQLite, MetricFlow's dbt project). Pipelines, runs
//             and the local catalog are files in this backend's data folder
//             (ingestion-st().cjs). Secrets never leave the PC.
//   server    The pipeline lives on the user's OpenMetadata server and runs on
//             its Airflow. MonoRail lists the server's own services and their
//             pipelines and calls OpenMetadata's REST API to create, deploy,
//             run, pause, kill and read logs. The server keeps each service's
//             connection; MonoRail never sends it a password.
//
// Opt-in: nothing runs until the user adds a data-source connection (local)
// or the OpenMetadata connection (server), and a pipeline only runs on a
// schedule after the user deploys it. There is no Auto Pilot: adding a
// service creates no pipelines. The scheduler's tick reads pipelines.json
// only (no tool, account or network call) and runs nothing while no pipeline
// is deployed.

const { randomUUID } = require('node:crypto')

const cron = require('./ingestion-cron.cjs')
const local = require('./ingestion-local.cjs')
const { createStore, PIPELINES_FILE } = require('./ingestion-store.cjs')
const localdb = require('../localdb/index.cjs')
const omLib = require('./openmetadata.cjs')

/** Run fn on the next tick, so a throw (the local database cannot open) becomes a rejection. */
const later = (fn) => Promise.resolve().then(fn)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const LOGGER_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR']
const TICK_MS = 60_000
const SERVER_PIPELINE_LIMIT = 500

/**
 * Local services: connection kinds whose connector declares `service`. Their
 * OpenMetadata service name is fixed. `ingestion: 'connect'` marks a service
 * whose ingestion is the connection itself: no pipelines, MonoRail keeps a
 * copy of it on this PC (BigQuery metadata, docs/bigquery-metadata.md).
 */
const LOCAL_SERVICES = Object.freeze({
  sqlite: { name: 'local_sqlite', label: (v) => baseName(v.file) || 'SQLite' },
  metricflow: { name: 'local_dbt', label: (v) => baseName(v.project) || 'dbt project' },
  'bigquery-metadata': { name: 'bigquery_metadata', label: (v) => (v.project ? `${String(v.project).trim()}.${String(v.dataset ?? '').trim() || 'METADATA'}` : 'BigQuery metadata'), ingestion: 'connect' },
})

function baseName(p) {
  return typeof p === 'string' && p.trim() ? p.trim().replace(/[\\/]+$/, '').split(/[\\/]/).pop() : ''
}

/** sourceConfig.config.type for each service category and pipeline type, as OpenMetadata names them. */
const SOURCE_TYPES = Object.freeze({
  databaseService: { metadata: 'DatabaseMetadata', usage: 'DatabaseUsage', lineage: 'DatabaseLineage', profiler: 'Profiler', autoClassification: 'AutoClassification', dbt: 'DBT' },
  dashboardService: { metadata: 'DashboardMetadata' },
  messagingService: { metadata: 'MessagingMetadata' },
  pipelineService: { metadata: 'PipelineMetadata' },
  mlmodelService: { metadata: 'MlModelMetadata' },
  storageService: { metadata: 'StorageMetadata' },
  searchService: { metadata: 'SearchMetadata' },
  apiService: { metadata: 'ApiMetadata' },
})

/** Pipeline types MonoRail can create on the server, per category (dbt needs a dbt source the server can reach, so it is left to OpenMetadata's own UI). */
const SERVER_CREATE_TYPES = Object.freeze(Object.fromEntries(Object.entries(SOURCE_TYPES).map(([cat, types]) => [cat, Object.keys(types).filter((t) => t !== 'dbt')])))

/** Service collections on the server, by category (OpenMetadata's REST paths). */
const SERVICE_COLLECTIONS = Object.freeze(Object.fromEntries(Object.keys(SOURCE_TYPES).concat(['metadataService']).map((cat) => [cat, omLib.TYPES[cat]])))

// ---------------------------------------------------------------- validation

function text(v, name, max = 200) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Give a ${name}.`)
  return v.trim()
}

function bool(v, fallback) {
  return typeof v === 'boolean' ? v : fallback
}

/** Keep only the sourceConfig options this pipeline type uses; check filter patterns. */
function cleanConfig(category, pipelineType, raw = {}) {
  const type = SOURCE_TYPES[category]?.[pipelineType]
  if (!type) throw new Error(`OpenMetadata has no ${pipelineType} pipeline for this kind of service.`)
  const cfg = { type }
  const patterns = ['databaseFilterPattern', 'schemaFilterPattern', 'tableFilterPattern']
  for (const p of patterns) {
    if (raw[p] === undefined) continue
    local.checkPattern(raw[p], p.replace('FilterPattern', ' filter'))
    const includes = (raw[p].includes ?? []).filter(Boolean)
    const excludes = (raw[p].excludes ?? []).filter(Boolean)
    if (includes.length || excludes.length) cfg[p] = { includes, excludes }
  }
  if (category !== 'databaseService') return cfg
  if (pipelineType === 'metadata') Object.assign(cfg, { includeViews: bool(raw.includeViews, true), includeTags: bool(raw.includeTags, true), markDeletedTables: bool(raw.markDeletedTables, true) })
  if (pipelineType === 'usage' || pipelineType === 'lineage') {
    const days = Number(raw.queryLogDuration ?? 1)
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Query history must be 1 to 30 days.')
    cfg.queryLogDuration = days
  }
  if (pipelineType === 'profiler') {
    if (raw.profileSample !== undefined) {
      const pct = Number(raw.profileSample)
      if (!(pct > 0 && pct <= 100)) throw new Error('The profile sample must be 1 to 100 percent.')
      cfg.profileSample = pct
    }
    if (raw.columnMetricsRowLimit !== undefined) {
      const n = Number(raw.columnMetricsRowLimit)
      if (!Number.isInteger(n) || n < 1) throw new Error('The row limit must be a whole number.')
      cfg.columnMetricsRowLimit = n
    }
  }
  if (pipelineType === 'dbt') Object.assign(cfg, { dbtConfigSource: { dbtConfigType: 'local' }, dbtUpdateDescriptions: bool(raw.dbtUpdateDescriptions, true), includeTags: bool(raw.includeTags, true), markDeletedTables: bool(raw.markDeletedTables, true) })
  return cfg
}

/** airflowConfig: a cron schedule (or none: run by hand), retries and their delay. */
function cleanSchedule(raw = {}) {
  const out = {}
  if (typeof raw.scheduleInterval === 'string' && raw.scheduleInterval.trim()) {
    cron.parse(raw.scheduleInterval)
    out.scheduleInterval = raw.scheduleInterval.trim()
  }
  const retries = Number(raw.retries ?? 0)
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) throw new Error('Retries must be 0 to 5.')
  out.retries = retries
  const delay = Number(raw.retryDelay ?? 300)
  if (!Number.isInteger(delay) || delay < 60 || delay > 86_400) throw new Error('The retry delay must be 60 seconds to a day.')
  out.retryDelay = delay
  return out
}

// ---------------------------------------------------------------- service

function createIngestion({ dataDir, deps = {} }) {
  // The local database opens on first use (electron/localdb); pipelines.json from older versions is copied in then.
  let store
  const st = () => (store ??= createStore({ db: deps.db ?? localdb.localDb(), legacyDir: dataDir }))
  /** Whether there can be pipelines at all, without creating the database: it exists, or an older version left pipelines.json. */
  const mayHavePipelines = () => !!deps.db || !!store || localdb.localDbExists() || require('node:fs').existsSync(require('node:path').join(dataDir, PIPELINES_FILE))
  const connections = () => deps.connections ?? require('../connections/index.cjs')
  const om = () => (deps.omClient ??= omLib._internal.createClient(deps.omDeps))
  const isServerSetUp = () => connections().hasConnection('openmetadata')
  const now = () => (deps.now ? deps.now() : new Date())
  /** The BigQuery copy, shared with the OpenMetadata page so both see the same sync. */
  const bigquery = () => deps.bigquery ?? require('./openmetadata.cjs').bigquerySource()

  /** pipeline id -> { status, control, pipeline } while a run is going. */
  const running = new Map()
  const retryTimers = new Map()

  // ---------- local services

  async function localServices() {
    const list = await connections().connections().list()
    const added = new Map(list.connections.map((c) => [c.kind, c]))
    return list.connectors
      .filter((c) => c.service && LOCAL_SERVICES[c.kind])
      .map((c) => {
        const conn = added.get(c.kind)
        return {
          kind: c.kind,
          title: c.title,
          name: LOCAL_SERVICES[c.kind].name,
          displayName: conn ? LOCAL_SERVICES[c.kind].label(conn.values ?? {}) : c.title,
          category: c.service.category,
          serviceType: c.service.serviceType,
          added: !!conn,
          status: conn?.status,
          localTypes: local.LOCAL_TYPES[c.kind] ?? [],
          ingestion: LOCAL_SERVICES[c.kind].ingestion ?? 'pipelines',
        }
      })
  }

  async function serviceFor(kind) {
    const svc = (await localServices()).find((s) => s.kind === kind)
    if (!svc) throw new Error('That is not a data service this PC can ingest.')
    if (!svc.added) throw new Error(`Set up ${svc.title} on the Connections page first. MonoRail reads nothing it was not asked to.`)
    return svc
  }

  /** Test connection: the connection's check, as OpenMetadata-style steps. */
  async function testConnection({ kind } = {}) {
    const svc = await serviceFor(kind)
    const s = await connections().connections().check(svc.kind, { force: true })
    return {
      state: s.state,
      summary: s.summary,
      hint: s.hint,
      checkedAt: s.checkedAt,
      steps: (s.details ?? []).map((d) => ({ name: d.label, message: d.value, passed: d.ok !== false, mandatory: d.ok !== undefined })),
    }
  }

  // ---------- local pipelines

  function withState(p, runsFile) {
    const live = running.get(p.id)
    const runs = runsFile.runs[p.id] ?? []
    const last = live?.status ?? runs[0]
    const expr = p.airflowConfig?.scheduleInterval
    let nextRun = null
    if (p.deployed && p.enabled && expr) {
      const from = runsFile.scheduled[p.id] ?? p.extension?.monorail?.deployedAt ?? now().toISOString()
      const n = cron.next(expr, new Date(from))
      nextRun = n ? new Date(Math.max(n.getTime(), now().getTime())).toISOString() : null
    }
    return {
      ...p,
      schedule: expr ? cron.describe(expr) : 'Manual only',
      nextRun,
      running: !!live,
      lastRun: last ? summaryOf(last) : null,
      recent: runs.slice(0, 10).map((r) => ({ runId: r.runId, pipelineState: r.pipelineState, startDate: r.startDate, records: totalRecords(r) })),
    }
  }

  async function listPipelines() {
    if (!mayHavePipelines()) return []
    const [pipelines, runsFile] = await Promise.all([st().pipelines(), st().runsFile()])
    return pipelines.map((p) => withState(p, runsFile))
  }

  async function findPipeline(id) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give a pipeline id.')
    const p = (await st().pipelines()).find((x) => x.id === id)
    if (!p) throw new Error('That pipeline no longer exists.')
    return p
  }

  async function savePipeline({ pipeline: raw } = {}) {
    if (!raw || typeof raw !== 'object') throw new Error('Give the pipeline.')
    const kind = raw.extension?.monorail?.serviceKind ?? raw.serviceKind
    const svc = await serviceFor(kind)
    const pipelineType = text(raw.pipelineType, 'pipeline type', 40)
    if (!svc.localTypes.includes(pipelineType)) throw new Error(`This PC cannot run ${pipelineType} pipelines for ${svc.title}. Use an OpenMetadata server for those.`)
    const name = text(raw.name, 'name', 128)
    if (!NAME_RE.test(name)) throw new Error('Use letters, digits, dots, dashes and underscores in the name.')
    const loggerLevel = LOGGER_LEVELS.includes(raw.loggerLevel) ? raw.loggerLevel : 'INFO'
    const sourceConfig = { config: cleanConfig(svc.category, pipelineType, raw.sourceConfig?.config) }
    const airflowConfig = cleanSchedule(raw.airflowConfig)
    const id = raw.id === undefined ? randomUUID() : raw.id
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give a pipeline id.')
    if (running.has(id)) throw new Error('Wait for the running run to finish, or kill it, before editing this pipeline.')
    const at = now().toISOString()
    return st().updatePipelines((list) => {
      if (list.some((p) => p.name === name && p.id !== id)) throw new Error(`A pipeline named ${name} already exists.`)
      const prev = list.find((p) => p.id === id)
      if (raw.id !== undefined && !prev) throw new Error('That pipeline no longer exists.')
      const deploy = raw.deploy === true || (prev?.deployed ?? false)
      const entity = {
        id,
        name,
        displayName: typeof raw.displayName === 'string' && raw.displayName.trim() ? raw.displayName.trim().slice(0, 200) : undefined,
        description: typeof raw.description === 'string' ? raw.description.slice(0, 2000) : prev?.description,
        pipelineType,
        service: { type: svc.category, name: svc.name, fullyQualifiedName: svc.name, displayName: svc.displayName },
        sourceConfig,
        airflowConfig,
        loggerLevel,
        enabled: prev?.enabled ?? true,
        deployed: deploy,
        provider: 'user',
        updatedAt: Date.parse(at),
        extension: { monorail: { runner: 'this-pc', serviceKind: svc.kind, createdAt: prev?.extension?.monorail?.createdAt ?? at, deployedAt: deploy ? (prev?.deployed ? prev.extension?.monorail?.deployedAt : at) : undefined } },
      }
      if (prev) list[list.indexOf(prev)] = entity
      else list.push(entity)
      return entity
    })
  }

  async function deletePipeline({ id } = {}) {
    await findPipeline(id)
    if (running.has(id)) throw new Error('Kill the running run before deleting this pipeline.')
    clearRetry(id)
    await st().updatePipelines((list) => {
      const i = list.findIndex((p) => p.id === id)
      if (i >= 0) list.splice(i, 1)
    })
    await st().forgetRuns(id)
    return { deleted: id }
  }

  /** Deploy (hand to this PC's scheduler) or undeploy; pause and resume keep it deployed. */
  async function setFlags({ id, deployed, enabled } = {}) {
    await findPipeline(id)
    const at = now().toISOString()
    const p = await st().updatePipelines((list) => {
      const p = list.find((x) => x.id === id)
      if (typeof deployed === 'boolean' && deployed !== p.deployed) {
        p.deployed = deployed
        p.extension = { ...p.extension, monorail: { ...p.extension?.monorail, deployedAt: deployed ? at : undefined } }
      }
      if (typeof enabled === 'boolean') p.enabled = enabled
      return p
    })
    if (!p.deployed || !p.enabled) clearRetry(id)
    // Deploying starts the schedule from now: no catch-up for times before the deploy.
    if (deployed === true || enabled === true) await st().setScheduled(id, at)
    return p
  }

  function clearRetry(id) {
    clearTimeout(retryTimers.get(id))
    retryTimers.delete(id)
  }

  const stamp = (d = now()) => d.toTimeString().slice(0, 8)

  /** Start a run. Returns at once with the run id; the page polls `runs`. */
  async function startRun(p, { trigger = 'manual', attempt = 0 } = {}) {
    if (running.has(p.id)) throw new Error('This pipeline is already running.')
    const startDate = now().getTime()
    const log = []
    const status = { runId: randomUUID(), pipelineState: 'running', startDate, timestamp: startDate, status: [], log, extension: { monorail: { trigger, attempt } } }
    const control = {}
    const entry = { status, control, killed: false }
    running.set(p.id, entry)
    const release = () => {
      if (running.get(p.id) === entry) running.delete(p.id)
    }
    const addLog = (line, level = 'INFO') => log.push(`${stamp()} ${level.padEnd(5)} ${line}`)
    let creds
    try {
      creds = await connections().getCredentials(p.extension?.monorail?.serviceKind)
      addLog(`Starting ${p.name} (${p.pipelineType}, ${trigger}${attempt ? `, retry ${attempt}` : ''})`)
      await st().saveRun(p.id, { ...status, log: [...log] })
    } catch (e) {
      release()
      throw e
    }
    const finished = (async () => {
      try {
        if (entry.killed) throw new Error('The run was killed.')
        const steps = await local.runLocal(p, {
          creds,
          log: (l) => addLog(l),
          control,
          catalog: (change) => st().updateCatalog(change),
          readCatalog: () => st().catalog(),
        })
        status.status = steps
        status.pipelineState = steps.some((s) => s.errors > 0 || s.warnings > 0) ? 'partialSuccess' : 'success'
      } catch (e) {
        status.pipelineState = 'failed'
        const msg = entry.killed ? 'The run was killed.' : String(e?.message ?? e).split('\n')[0].slice(0, 500)
        status.status = [...status.status, { name: 'Run', records: 0, updated_records: 0, warnings: 0, errors: 1, filtered: 0, failures: [{ name: p.name, error: msg }] }]
        addLog(msg, 'ERROR')
      }
      status.endDate = now().getTime()
      status.timestamp = status.endDate
      addLog(`Finished with status ${status.pipelineState}`)
      await st().saveRun(p.id, { ...status, log: [...log] }).catch((e) => console.error('[ingestion] could not save run', e))
      // Scheduled runs retry as OpenMetadata's Airflow tasks do: retries times, retryDelay apart.
      const retries = p.airflowConfig?.retries ?? 0
      if (status.pipelineState === 'failed' && trigger !== 'manual' && !entry.killed && attempt < retries) {
        clearRetry(p.id)
        retryTimers.set(
          p.id,
          setTimeout(() => {
            retryTimers.delete(p.id)
            findPipeline(p.id)
              .then((fresh) => fresh.deployed && fresh.enabled && startRun(fresh, { trigger, attempt: attempt + 1 }))
              .catch(() => {})
          }, (p.airflowConfig?.retryDelay ?? 300) * 1000),
        )
      }
    })().finally(release)
    entry.finished = finished
    return { runId: status.runId }
  }

  async function run({ id } = {}) {
    return startRun(await findPipeline(id), { trigger: 'manual' })
  }

  async function kill({ id } = {}) {
    const entry = running.get(id)
    clearRetry(id)
    if (!entry) return { killed: false }
    entry.killed = true
    entry.control.kill?.()
    return { killed: true }
  }

  async function runs({ id } = {}) {
    const p = await findPipeline(id)
    const saved = (await st().runsFile()).runs[p.id] ?? []
    const live = running.get(p.id)?.status
    return live ? [{ ...live, log: [...live.log] }, ...saved.filter((r) => r.runId !== live.runId)] : saved
  }

  // ---------- scheduler

  let ticking = false
  async function tick() {
    if (ticking) return
    ticking = true
    try {
      if (!mayHavePipelines()) return
      const pipelines = (await st().pipelines()).filter((p) => p.deployed && p.enabled && p.airflowConfig?.scheduleInterval)
      if (!pipelines.length) return
      const { scheduled } = await st().runsFile()
      const t = now()
      for (const p of pipelines) {
        if (running.has(p.id) || retryTimers.has(p.id)) continue
        const from = scheduled[p.id] ?? p.extension?.monorail?.deployedAt
        if (!from) continue
        const due = cron.next(p.airflowConfig.scheduleInterval, new Date(from))
        if (!due || due > t) continue
        // One run for any number of missed times (like backups after the app was closed).
        await st().setScheduled(p.id, t.toISOString())
        await startRun(p, { trigger: 'schedule' }).catch((e) => console.error(`[ingestion] ${p.name} could not start:`, e.message))
      }
    } catch (e) {
      console.error('[ingestion] scheduler', e.message)
    } finally {
      ticking = false
    }
  }

  /** Rows for Scheduled > In-App: deployed local pipelines. */
  async function inAppRows() {
    if (!mayHavePipelines()) return []
    const list = await listPipelines()
    return list
      .filter((p) => p.deployed)
      .map((p) => ({
        id: p.id,
        title: p.displayName || p.name,
        description: `${p.pipelineType} ingestion of ${p.service.displayName ?? p.service.name}`,
        group: 'Ingestion pipelines',
        schedule: p.schedule,
        state: p.running ? 'Running' : p.enabled && p.airflowConfig?.scheduleInterval ? 'Ready' : 'Disabled',
        lastRun: p.lastRun ? new Date(p.lastRun.startDate).toISOString() : null,
        nextRun: p.nextRun,
        result: p.lastRun ? (p.lastRun.pipelineState === 'failed' ? 'failed' : p.lastRun.pipelineState === 'running' ? null : 'ok') : null,
        note: p.lastRun?.error ?? (p.enabled ? '' : 'Paused'),
        where: { label: 'Services', path: '/services' },
      }))
  }

  // ---------- server (OpenMetadata) pipelines

  async function serverGuard() {
    if (!(await isServerSetUp())) throw new Error('Set up OpenMetadata on the Connections page first.')
    return om()
  }

  /** The server's services (every category with pipelines) and their ingestion pipelines. */
  async function serverOverview() {
    if (!(await isServerSetUp())) return { block: 'not-set-up' }
    const c = om()
    const services = []
    const problems = []
    await Promise.all(
      Object.entries(SERVICE_COLLECTIONS).map(async ([category, collection]) => {
        try {
          const res = await c.get(`/${collection}?limit=100`)
          for (const s of res?.data ?? []) services.push({ id: s.id, name: s.name, fullyQualifiedName: s.fullyQualifiedName ?? s.name, displayName: s.displayName, description: s.description, category, serviceType: s.serviceType, deleted: !!s.deleted })
        } catch (e) {
          if (e.status !== 404) problems.push(`${category}: ${e.message}`)
        }
      }),
    )
    const pipelines = []
    let after
    try {
      do {
        const q = new URLSearchParams({ limit: '100' })
        if (after) q.set('after', after)
        const res = await c.withFields('services/ingestionPipelines', ['pipelineStatuses,owners', 'pipelineStatuses'], (fields) => c.get(`/services/ingestionPipelines?${q}${fields ? `&fields=${fields}` : ''}`))
        for (const p of res?.data ?? []) pipelines.push(serverPipeline(p))
        after = res?.paging?.after
      } while (after && pipelines.length < SERVER_PIPELINE_LIMIT)
    } catch (e) {
      if (e.status === 401 || e.status === 0) return { block: e.status === 401 ? 'rejected' : 'unreachable', error: e.message }
      problems.push(`Ingestion pipelines: ${e.message}`)
    }
    services.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    return { services, pipelines, problems, truncated: !!after, createTypes: SERVER_CREATE_TYPES }
  }

  function serverPipeline(p) {
    const statuses = Array.isArray(p.pipelineStatuses) ? p.pipelineStatuses : p.pipelineStatuses ? [p.pipelineStatuses] : []
    const last = statuses.sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0))[0]
    const expr = p.airflowConfig?.scheduleInterval
    return {
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      fullyQualifiedName: p.fullyQualifiedName,
      pipelineType: p.pipelineType,
      service: p.service ? { id: p.service.id, type: p.service.type, name: p.service.name, fullyQualifiedName: p.service.fullyQualifiedName } : undefined,
      airflowConfig: p.airflowConfig,
      schedule: expr ? cron.describe(expr) : 'Manual only',
      enabled: p.enabled !== false,
      deployed: !!p.deployed,
      lastRun: last ? summaryOf(last) : null,
      extension: { monorail: { runner: 'server' } },
    }
  }

  async function serverRuns({ fqn } = {}) {
    const c = await serverGuard()
    const name = text(fqn, 'pipeline name', 500)
    const endTs = now().getTime()
    const res = await c.get(`/services/ingestionPipelines/${encodeURIComponent(name)}/pipelineStatus?startTs=${endTs - 30 * 86_400_000}&endTs=${endTs}`)
    return (res?.data ?? []).sort((a, b) => (b.startDate ?? 0) - (a.startDate ?? 0)).slice(0, 30)
  }

  const SERVER_ACTIONS = { run: 'trigger', deploy: 'deploy', kill: 'kill', toggle: 'toggleIngestion' }

  async function serverAction({ id, action } = {}) {
    const c = await serverGuard()
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give a pipeline id.')
    const verb = Object.hasOwn(SERVER_ACTIONS, action) ? SERVER_ACTIONS[action] : undefined
    if (!verb) throw new Error('Unknown pipeline action.')
    const res = await c.post(`/services/ingestionPipelines/${verb}/${id}`)
    return { ok: true, message: typeof res?.reason === 'string' ? res.reason : typeof res?.message === 'string' ? res.message : undefined }
  }

  async function serverLogs({ id } = {}) {
    const c = await serverGuard()
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give a pipeline id.')
    const res = await c.get(`/services/ingestionPipelines/logs/${id}/last`)
    const parts = Object.entries(res ?? {}).filter(([k, v]) => typeof v === 'string' && k !== 'after' && k !== 'total')
    const lines = parts.flatMap(([, v]) => v.split(/\r?\n/))
    return { lines: lines.slice(-400), truncated: lines.length > 400 }
  }

  async function serverCreate({ service, pipeline: raw, deploy = false } = {}) {
    const c = await serverGuard()
    if (!service || typeof service.id !== 'string' || !UUID_RE.test(service.id)) throw new Error('Pick a service on the server.')
    const category = service.category
    if (!SERVER_CREATE_TYPES[category]) throw new Error('MonoRail cannot create pipelines for this kind of service. Use OpenMetadata to add one.')
    const pipelineType = text(raw?.pipelineType, 'pipeline type', 40)
    if (!SERVER_CREATE_TYPES[category].includes(pipelineType)) throw new Error(`MonoRail cannot create ${pipelineType} pipelines for this service.`)
    const name = text(raw?.name, 'name', 128)
    if (!NAME_RE.test(name)) throw new Error('Use letters, digits, dots, dashes and underscores in the name.')
    const body = {
      name,
      displayName: typeof raw.displayName === 'string' && raw.displayName.trim() ? raw.displayName.trim().slice(0, 200) : undefined,
      pipelineType,
      service: { id: service.id, type: category },
      sourceConfig: { config: cleanConfig(category, pipelineType, raw.sourceConfig?.config) },
      airflowConfig: cleanSchedule(raw.airflowConfig),
      loggerLevel: LOGGER_LEVELS.includes(raw.loggerLevel) ? raw.loggerLevel : 'INFO',
    }
    const created = await c.post('/services/ingestionPipelines', body)
    let deployError
    if (deploy && created?.id) {
      try {
        await c.post(`/services/ingestionPipelines/deploy/${created.id}`)
      } catch (e) {
        deployError = e.message
      }
    }
    return { pipeline: created ? serverPipeline(created) : undefined, deployError }
  }

  // ---------- Explore

  /** Local services, pipelines and the local catalog, for Explore. Reads only; creates no database. */
  async function explore() {
    const [services, pipelines, catalog] = await Promise.all([localServices(), mayHavePipelines() ? later(() => st().pipelines()).catch(() => []) : [], mayHavePipelines() ? later(() => st().catalog()).catch(() => ({ services: {} })) : { services: {} }])
    return { services: services.filter((s) => s.added).map(({ status: _s, ...s }) => s), pipelines, catalog: catalog.services }
  }

  /** How the copy of a connect-only service stands. Reads the copy's own state; starts nothing. */
  async function copyOf(s) {
    if (s.kind !== 'bigquery-metadata' || !s.added) return undefined
    try {
      const b = await bigquery().status()
      if (!b.setUp) return undefined
      return { source: b.source, entities: b.entities ?? 0, synced: !!b.synced, syncEvery: b.syncEvery, last: b.last, running: !!b.running, nextAt: b.nextAt, error: b.error }
    } catch (e) {
      return { entities: 0, synced: false, error: e.message }
    }
  }

  /** Sync now (or Full refresh) for a connect-only service. */
  async function syncConnected({ kind, full = false } = {}) {
    const svc = await serviceFor(kind)
    if (svc.ingestion !== 'connect') throw new Error('This service is read by its ingestion pipelines. Run one of them instead.')
    return bigquery().sync({ full: full === true })
  }

  async function overview() {
    const [services, pipelines, server] = await Promise.all([localServices(), listPipelines(), isServerSetUp()])
    const catalog = mayHavePipelines() ? await later(() => st().catalog()).catch((e) => ({ error: e.message, services: {} })) : { services: {} }
    const copies = await Promise.all(services.map(copyOf))
    return {
      services: services.map((s, i) => ({ ...s, pipelines: pipelines.filter((p) => p.extension?.monorail?.serviceKind === s.kind).length, catalog: catalogCounts(catalog.services[s.name]), copy: copies[i] })),
      pipelines,
      serverSetUp: server,
      catalogError: catalog.error,
    }
  }

  return {
    overview,
    testConnection,
    listPipelines,
    savePipeline,
    deletePipeline,
    setFlags,
    run,
    kill,
    runs,
    tick,
    inAppRows,
    serverOverview,
    serverRuns,
    serverAction,
    serverLogs,
    serverCreate,
    explore,
    syncConnected,
    _running: running,
    _db: () => deps.db,
  }
}

function totalRecords(r) {
  const s = Array.isArray(r.status) ? r.status : []
  return s.length ? s[s.length - 1].records ?? 0 : 0
}

/** A run status in short: state, times, totals and the first failure. */
function summaryOf(r) {
  const steps = Array.isArray(r.status) ? r.status : []
  const sum = (k) => steps.reduce((n, s) => n + (Number(s[k]) || 0), 0)
  const failure = steps.flatMap((s) => s.failures ?? [])[0]
  return {
    runId: r.runId,
    pipelineState: r.pipelineState,
    startDate: r.startDate,
    endDate: r.endDate,
    records: totalRecords(r),
    warnings: sum('warnings'),
    errors: sum('errors'),
    error: failure ? String(failure.error ?? failure.message ?? '').slice(0, 300) : undefined,
  }
}

function catalogCounts(svc) {
  if (!svc) return undefined
  let schemas = 0
  let tables = 0
  for (const db of svc.databases ?? []) {
    schemas += db.schemas?.length ?? 0
    for (const s of db.schemas ?? []) tables += (s.tables ?? []).filter((t) => !t.deleted).length
  }
  return { databases: svc.databases?.length ?? 0, schemas, tables, updatedAt: svc.updatedAt }
}

// ---------------------------------------------------------------- the app's instance

let instance
function svc(ctx) {
  return (instance ??= createIngestion({ dataDir: ctx.dataDir }))
}

module.exports = {
  id: 'ingestion',
  methods: {
    overview: (ctx) => svc(ctx).overview(),
    testConnection: (ctx, args) => svc(ctx).testConnection(args),
    syncConnected: (ctx, args) => svc(ctx).syncConnected(args),
    listPipelines: (ctx) => svc(ctx).listPipelines(),
    savePipeline: (ctx, args) => svc(ctx).savePipeline(args),
    deletePipeline: (ctx, args) => svc(ctx).deletePipeline(args),
    setFlags: (ctx, args) => svc(ctx).setFlags(args),
    run: (ctx, args) => svc(ctx).run(args),
    kill: (ctx, args) => svc(ctx).kill(args),
    runs: (ctx, args) => svc(ctx).runs(args),
    serverOverview: (ctx) => svc(ctx).serverOverview(),
    serverRuns: (ctx, args) => svc(ctx).serverRuns(args),
    serverAction: (ctx, args) => svc(ctx).serverAction(args),
    serverLogs: (ctx, args) => svc(ctx).serverLogs(args),
    serverCreate: (ctx, args) => svc(ctx).serverCreate(args),
    explore: (ctx) => svc(ctx).explore(),
  },
  start(ctx) {
    const s = svc(ctx)
    require('../scheduled/in-app.cjs').registerProvider({
      id: 'ingestion',
      title: 'Ingestion pipelines',
      list: () => s.inAppRows(),
      run: (id) => s.run({ id }).then(() => undefined),
    })
    setTimeout(() => void s.tick(), 20_000).unref?.()
    setInterval(() => void s.tick(), TICK_MS).unref?.()
  },
  createIngestion,
  SOURCE_TYPES,
  SERVER_CREATE_TYPES,
  LOCAL_SERVICES,
}
