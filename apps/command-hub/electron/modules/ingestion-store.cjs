// Where the Services page's local ingestion pipelines keep their data: MonoRail's
// local database (electron/localdb, docs/local-database.md), in OpenMetadata's
// shape, so the OpenMetadata page shows it too.
//
//   ingestionPipeline entities   pipelines that run on this PC (fqn service.name)
//   records 'pipelineStatus'     newest RUNS_KEPT run statuses per pipeline, in
//                                OpenMetadata's pipelineStatus shape, with up to
//                                LOG_LINES log lines
//   records 'pipelineSchedule'   the last scheduled time per pipeline
//   catalog entities             what the pipelines read: databaseService,
//                                database, databaseSchema and table entities
//                                (extension.monorail.catalog = true)
//   records 'tableProfile'       profiler results per table, newest PROFILES_KEPT,
//                                kept apart from the table as OpenMetadata keeps
//                                profiles apart from entity versions
//   lineage edges                dbt's table-to-table lineage in the database's
//                                lineage table (OpenMetadata's edge shape,
//                                lineageDetails.source 'DbtLineage'), resolved
//                                to the catalog's table entities
//
// Older versions kept lineage as { from, to } table keys in
// databaseService.extension.monorail.lineage. That field is still read
// (legacyLineage, and readCatalog when a service has no edges in the table)
// but no longer written: the next catalog write moves it into the table.
//
// Older versions kept pipelines.json, runs.json and catalog.json in the
// module's data folder. They are copied in once (meta 'import.ingestion') and
// then left as they are; a damaged one is skipped, never changed.
//
// The interface (pipelines, updatePipelines, runsFile, saveRun, setScheduled,
// forgetRuns, catalog, updateCatalog) is what ingestion.cjs and
// ingestion-local.cjs use; the catalog reads and writes as one nested object
// per service. No Electron here.

const path = require('node:path')
const fs = require('node:fs/promises')
const { fqnOf } = require('../localdb/index.cjs')

const PIPELINES_FILE = 'pipelines.json'
const RUNS_FILE = 'runs.json'
const CATALOG_FILE = 'catalog.json'
const RUNS_KEPT = 30
const LOG_LINES = 200
const PROFILES_KEPT = 30
const IMPORT_KEY = 'import.ingestion'

const ref = (e, type) => ({ id: e.id, type, name: e.name, fullyQualifiedName: e.fullyQualifiedName })
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const isCatalog = (e) => e.extension?.monorail?.catalog === true
/** A catalog table's key inside its service, as the runners name tables: database.schema.table. */
const tableKeyOf = (t) => [t.database?.name, t.databaseSchema?.name, t.name].join('.')
/** One dbt lineage edge in OpenMetadata's EntitiesEdge shape. */
const dbtEdge = (from, to) => ({ fromEntity: ref(from, 'table'), toEntity: ref(to, 'table'), lineageDetails: { source: 'DbtLineage' } })

/** A service's catalog tables by key. */
function catalogTables(db, service) {
  const map = new Map()
  for (const t of db.all('table')) if (isCatalog(t) && t.service?.fullyQualifiedName === service.fullyQualifiedName) map.set(tableKeyOf(t), t)
  return map
}

/**
 * Edges older versions kept in databaseService.extension.monorail.lineage
 * ({ from, to } table keys), resolved to the catalog's table entities, as
 * [{ fromId, toId, edge }]. Reads only; pairs that no longer resolve are left out.
 */
function legacyLineage(db) {
  const out = []
  for (const s of db.all('databaseService')) {
    const pairs = isCatalog(s) ? s.extension.monorail.lineage : undefined
    if (!Array.isArray(pairs) || !pairs.length) continue
    const tables = catalogTables(db, s)
    for (const p of pairs) {
      const from = tables.get(p?.from)
      const to = tables.get(p?.to)
      if (from && to && from.id !== to.id) out.push({ fromId: from.id, toId: to.id, edge: dbtEdge(from, to) })
    }
  }
  return out
}

function createStore({ db, legacyDir } = {}) {
  if (!db) throw new Error('The ingestion store needs the local database.')
  let imported = false

  async function ready() {
    if (imported) return
    imported = true
    if (db.getMeta(IMPORT_KEY) || !legacyDir) return
    const read = async (name) => {
      try {
        const data = JSON.parse(await fs.readFile(path.join(legacyDir, name), 'utf8'))
        return data && typeof data === 'object' && data.version === 1 ? data : undefined
      } catch {
        return undefined // missing or damaged: skipped, left as it is
      }
    }
    const [pipelines, runs, catalog] = await Promise.all([read(PIPELINES_FILE), read(RUNS_FILE), read(CATALOG_FILE)])
    db.transaction(() => {
      for (const p of pipelines?.pipelines ?? []) if (p?.name && p.service?.name) putPipeline(p)
      for (const [id, list] of Object.entries(runs?.runs ?? {})) for (const r of list ?? []) if (r?.runId) saveRunSync(id, r)
      for (const [id, iso] of Object.entries(runs?.scheduled ?? {})) if (typeof iso === 'string') db.putRecord('pipelineSchedule', id, 'last', Date.parse(iso) || 0, { at: iso })
      if (catalog?.services) writeCatalog(catalog.services)
      db.setMeta(IMPORT_KEY, new Date().toISOString())
    })
  }

  // ---------- pipelines

  const localPipelines = () => db.all('ingestionPipeline').filter((p) => p.extension?.monorail?.runner === 'this-pc')

  function putPipeline(p) {
    const { pipelineStatuses: _s, ...entity } = p
    return db.put('ingestionPipeline', { ...entity, fullyQualifiedName: fqnOf(p.service.name, p.name) })
  }

  /** Change the list in place (add, replace, splice); what `change` returns is returned. */
  async function updatePipelines(change) {
    await ready()
    return db.transaction(() => {
      const list = localPipelines()
      const before = new Set(list.map((p) => p.id))
      const result = change(list)
      const after = new Set()
      for (const p of list) {
        putPipeline(p)
        after.add(p.id)
      }
      for (const id of before) if (!after.has(id)) db.remove(id)
      return result
    })
  }

  // ---------- runs

  function saveRunSync(pipelineId, status) {
    const log = Array.isArray(status.log) ? status.log.slice(-LOG_LINES) : undefined
    db.putRecord('pipelineStatus', pipelineId, status.runId, Number(status.startDate) || 0, { ...status, log })
    db.pruneRecords('pipelineStatus', pipelineId, RUNS_KEPT)
  }

  async function runsFile() {
    await ready()
    const scheduled = {}
    for (const [id, [last]] of Object.entries(db.recordsByOwner('pipelineSchedule'))) scheduled[id] = last.at
    return { runs: db.recordsByOwner('pipelineStatus'), scheduled }
  }

  // ---------- catalog

  /** The nested catalog per service, as the runners read it: { [service]: { serviceType, updatedAt, databases, lineage } }. */
  /** A service's lineage as { from, to } table keys: the lineage table's edges between its tables, else the older field. */
  function serviceLineage(service) {
    const keyOf = new Map([...catalogTables(db, service)].map(([key, t]) => [t.id, key]))
    const pairs = []
    for (const [id, to] of keyOf) for (const e of db.lineageInto(id)) if (keyOf.has(e.fromId)) pairs.push({ from: keyOf.get(e.fromId), to })
    if (pairs.length) return pairs
    const legacy = service.extension?.monorail?.lineage
    return Array.isArray(legacy) && legacy.length ? legacy : undefined
  }

  function readCatalog() {
    const services = {}
    const byFqn = new Map()
    for (const s of db.all('databaseService').filter(isCatalog)) {
      services[s.name] = strip({ serviceType: s.serviceType, updatedAt: db.getMeta(`catalog.updatedAt.${s.name}`), lineage: serviceLineage(s), databases: [] })
      byFqn.set(s.fullyQualifiedName, services[s.name])
    }
    const dbs = new Map()
    for (const d of db.all('database').filter(isCatalog)) {
      const svc = byFqn.get(d.service?.fullyQualifiedName)
      if (!svc) continue
      const node = { name: d.name, schemas: [] }
      svc.databases.push(node)
      dbs.set(d.fullyQualifiedName, node)
    }
    const schemas = new Map()
    for (const s of db.all('databaseSchema').filter(isCatalog)) {
      const parent = dbs.get(s.database?.fullyQualifiedName)
      if (!parent) continue
      const node = { name: s.name, tables: [] }
      parent.schemas.push(node)
      schemas.set(s.fullyQualifiedName, node)
    }
    for (const t of db.all('table').filter(isCatalog)) {
      const parent = schemas.get(t.databaseSchema?.fullyQualifiedName)
      if (!parent) continue
      const { monorail, ...ext } = t.extension ?? {}
      const [profile] = db.records('tableProfile', t.id, 1)
      parent.tables.push(
        strip({
          name: t.name,
          tableType: t.tableType,
          description: t.description,
          columns: (t.columns ?? []).map(({ fullyQualifiedName: _f, ...c }) => strip(c)),
          tags: monorail?.tags,
          extension: Object.keys(ext).length ? ext : undefined,
          deleted: t.deleted || undefined,
          profile,
        }),
      )
    }
    return services
  }

  /**
   * Write the nested catalog back as entities; entities of a service that are
   * no longer in it are removed, with their lineage. `svc.lineage` ({ from, to }
   * table keys), when given, replaces the edges between the service's tables.
   */
  function writeCatalog(services) {
    for (const [svcName, svc] of Object.entries(services)) {
      const keep = new Set()
      const mark = (e) => (keep.add(e.id), e)
      const tablesByKey = new Map()
      const prev = db.get('databaseService', fqnOf(svcName))
      // The older lineage field is not written again (it lives in the lineage table now); kept only while
      // this write brings no lineage of its own, so data a newer runner has not rewritten yet still reads.
      const legacy = Array.isArray(svc.lineage) ? undefined : prev?.extension?.monorail?.lineage
      const service = mark(
        db.put('databaseService', strip({ name: svcName, fullyQualifiedName: fqnOf(svcName), serviceType: svc.serviceType, description: prev?.description, extension: { monorail: strip({ catalog: true, lineage: legacy }) } })),
      )
      if (svc.updatedAt) db.setMeta(`catalog.updatedAt.${svcName}`, svc.updatedAt)
      for (const d of svc.databases ?? []) {
        const database = mark(db.put('database', { name: d.name, fullyQualifiedName: fqnOf(svcName, d.name), service: ref(service, 'databaseService'), serviceType: svc.serviceType, extension: { monorail: { catalog: true } } }))
        for (const s of d.schemas ?? []) {
          const schema = mark(
            db.put('databaseSchema', { name: s.name, fullyQualifiedName: fqnOf(svcName, d.name, s.name), service: ref(service, 'databaseService'), database: ref(database, 'database'), serviceType: svc.serviceType, extension: { monorail: { catalog: true } } }),
          )
          for (const t of s.tables ?? []) {
            const fqn = fqnOf(svcName, d.name, s.name, t.name)
            const stored = mark(
              db.put(
                'table',
                strip({
                  name: t.name,
                  fullyQualifiedName: fqn,
                  tableType: t.tableType,
                  description: t.description,
                  columns: (t.columns ?? []).map((c) => strip({ ...c, fullyQualifiedName: `${fqn}.${fqnOf(c.name)}` })),
                  service: ref(service, 'databaseService'),
                  database: ref(database, 'database'),
                  databaseSchema: ref(schema, 'databaseSchema'),
                  serviceType: svc.serviceType,
                  deleted: t.deleted || undefined,
                  extension: { ...t.extension, monorail: strip({ catalog: true, tags: t.tags }) },
                }),
              ),
            )
            tablesByKey.set([d.name, s.name, t.name].join('.'), stored)
            const [last] = db.records('tableProfile', stored.id, 1)
            if (t.profile && t.profile.timestamp !== last?.timestamp) {
              db.putRecord('tableProfile', stored.id, String(t.profile.timestamp), Number(t.profile.timestamp) || 0, t.profile)
              db.pruneRecords('tableProfile', stored.id, PROFILES_KEPT)
            }
          }
        }
      }
      for (const type of ['database', 'databaseSchema', 'table']) {
        for (const e of db.all(type)) {
          if (e.extension?.monorail?.catalog === true && e.service?.fullyQualifiedName === service.fullyQualifiedName && !keep.has(e.id)) {
            db.deleteRecords('tableProfile', e.id)
            db.removeLineageOf(e.id)
            db.remove(e.id)
          }
        }
      }
      if (Array.isArray(svc.lineage)) writeLineage(tablesByKey, svc.lineage)
    }
  }

  /**
   * Replace the edges between a service's tables with `pairs` ({ from, to }
   * table keys), each resolved to the stored table entities; a pair whose
   * table is not in the catalog (filtered out, say) is left out. Unchanged
   * edges keep their time. Returns how many edges were written.
   */
  function writeLineage(tablesByKey, pairs) {
    const wanted = new Map()
    for (const p of pairs) {
      const from = tablesByKey.get(p?.from)
      const to = tablesByKey.get(p?.to)
      if (from && to && from.id !== to.id) wanted.set(`${from.id}|${to.id}`, dbtEdge(from, to))
    }
    const ids = new Set([...tablesByKey.values()].map((t) => t.id))
    for (const t of tablesByKey.values()) {
      for (const e of db.lineageInto(t.id)) if (ids.has(e.fromId) && !wanted.has(`${e.fromId}|${e.toId}`)) db.removeLineage(e.fromId, e.toId)
    }
    for (const edge of wanted.values()) db.putLineage(edge)
    return wanted.size
  }

  return {
    pipelines: async () => (await ready(), localPipelines()),
    updatePipelines,
    runsFile,
    saveRun: async (pipelineId, status) => (await ready(), db.transaction(() => saveRunSync(pipelineId, status))),
    setScheduled: async (pipelineId, iso) => (await ready(), db.putRecord('pipelineSchedule', pipelineId, 'last', Date.parse(iso) || 0, { at: iso })),
    forgetRuns: async (pipelineId) => {
      await ready()
      db.transaction(() => {
        db.deleteRecords('pipelineStatus', pipelineId)
        db.deleteRecords('pipelineSchedule', pipelineId)
      })
    },
    catalog: async () => (await ready(), { services: readCatalog() }),
    /** Read the nested catalog, let `change` edit it, write it back in one transaction. */
    updateCatalog: async (change) => {
      await ready()
      return db.transaction(() => {
        const services = readCatalog()
        const result = change(services)
        writeCatalog(services)
        return result
      })
    },
  }
}

module.exports = { createStore, legacyLineage, PIPELINES_FILE, RUNS_FILE, CATALOG_FILE, RUNS_KEPT, LOG_LINES }
