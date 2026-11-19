// BigQuery as the source of truth for MonoRail's metadata (docs/bigquery-metadata.md).
//
// The user picks a BigQuery project and dataset (default METADATA) that holds
// MonoRail's metadata layout: the local database's tables (entity,
// entity_version, record, lineage, meta) as BigQuery tables. Something else keeps that
// dataset up to date; MonoRail only connects and reads. It keeps a copy in
// its own SQLite file (localdb mirrorDb(), bigquery.sqlite3) and every page
// reads the copy, so browsing never runs a BigQuery query.
//
// Sync:
//   - full: every row through tabledata.list, which runs no query, so
//     BigQuery bills nothing for it. Used the first time, after the
//     project or dataset changed, and on Full refresh. Entities that are
//     no longer in BigQuery are removed from the copy afterwards (nothing is
//     emptied first, so the page keeps working while it runs).
//   - incremental: one query per table for rows whose time column is at or
//     after the last one seen, less 10 minutes for late writers. Each query
//     is dry-run first; when they would scan more than the user's limit,
//     nothing runs and the error says so (a table partitioned on its time
//     column keeps this small). Entities (and lineage edges) removed from
//     BigQuery outright are found by comparing row counts (free table
//     metadata) and, when the copy has more, listing BigQuery's ids, or
//     from_id/to_id pairs, through tabledata.list (free).
//
// Layout versions: /1 has entity, entity_version, record and meta; /2 adds the
// optional lineage table (OpenMetadata keeps lineage as edges apart from
// entity JSON). Both are read; a /1 dataset simply has no lineage. A newer
// number than LAYOUT is refused, so an older MonoRail never misreads one. A
// dataset ensureDataset() makes is /2, with an empty lineage table.
//
// Read-only, with one exception: when the dataset is the default METADATA
// and it does not exist yet (or exists with no tables), ensureDataset() makes
// it by running setupSql() as one script: the dataset, the empty layout tables
// and the meta row, all IF NOT EXISTS. Any other dataset is only reported
// (setupSql() is then text for the user to run). Nothing else here writes to
// BigQuery. No Electron here, so tests run it with a fake client.

const { createClient, _ids } = require('../modules/bigquery-api.cjs')

const LAYOUT = 'monorail.metadata/2'
const DEFAULT_DATASET = 'METADATA'
const DEFAULT_LOCATION = 'US'
const OVERLAP_MS = 10 * 60_000
const PAGE_ROWS = 2000
const ID_PAGE_ROWS = 10_000
const QUERY_WAIT_MS = 10 * 60_000
const TOKEN_TTL_MS = 30 * 60_000

const STRING = ['STRING']
const NUMBER = ['FLOAT', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC', 'INTEGER', 'INT64']
const TIMESTAMP = ['TIMESTAMP']
const JSON_TYPES = ['JSON', 'STRING']

const BOOL = ['BOOLEAN', 'BOOL']

/**
 * The layout's tables: columns with the BigQuery types allowed, the time
 * column incremental syncs follow, and `since`, the first layout version
 * that has the table (a dataset of an older layout is not read for it).
 */
const TABLES = Object.freeze({
  entity: {
    required: true,
    time: 'updated_at',
    columns: { id: STRING, type: STRING, fqn: STRING, name: STRING, version: NUMBER, updated_at: TIMESTAMP, deleted: BOOL, json: JSON_TYPES },
  },
  entity_version: { required: false, time: 'updated_at', columns: { id: STRING, version: NUMBER, updated_at: TIMESTAMP, json: JSON_TYPES } },
  record: { required: false, time: 'at', columns: { kind: STRING, owner: STRING, key: STRING, at: TIMESTAMP, json: JSON_TYPES } },
  lineage: {
    required: false,
    since: 2,
    time: 'updated_at',
    columns: { from_id: STRING, from_type: STRING, to_id: STRING, to_type: STRING, updated_at: TIMESTAMP, deleted: BOOL, json: JSON_TYPES },
  },
  meta: { required: true, columns: { key: STRING, value: STRING } },
})

/** Choices on the connection (connectors/bigquery-metadata.cjs). */
const SYNC_EVERY = Object.freeze({ '15m': 15 * 60_000, '1h': 60 * 60_000, '6h': 6 * 60 * 60_000, '24h': 24 * 60 * 60_000, manual: null })
const MAX_SCAN_GB = Object.freeze(['1', '10', '100'])

function fail(message, code) {
  const e = new Error(message)
  e.code = code
  return e
}

function checkProject(v, what = 'project id') {
  const s = String(v ?? '').trim()
  if (!_ids.PROJECT_RE.test(s)) throw fail(`Not a valid BigQuery ${what}: ${s.slice(0, 80) || '(empty)'}`, 'config')
  return s
}
function checkDataset(v) {
  const s = String(v ?? '').trim() || DEFAULT_DATASET
  if (!_ids.DATASET_RE.test(s)) throw fail(`Not a valid BigQuery dataset name: ${s.slice(0, 80)}. Use letters, digits and underscores.`, 'config')
  return s
}

const LOCATION_RE = /^[A-Za-z][A-Za-z0-9-]{0,39}$/
function checkLocation(v) {
  const s = String(v ?? '').trim() || DEFAULT_LOCATION
  if (!LOCATION_RE.test(s)) throw fail(`Not a valid BigQuery location: ${s.slice(0, 40)}. Use one such as US, EU or europe-west2.`, 'config')
  return s
}

/** The connection's values as the sync needs them. Throws a readable message on a bad value. */
function configOf(values = {}) {
  const projectId = checkProject(values.project)
  const datasetId = checkDataset(values.dataset)
  const location = checkLocation(values.location)
  const billing = String(values.billingProject ?? '').trim()
  const every = Object.hasOwn(SYNC_EVERY, values.syncEvery) ? values.syncEvery : '1h'
  const gb = MAX_SCAN_GB.includes(String(values.maxScanGb)) ? Number(values.maxScanGb) : 1
  return {
    projectId,
    datasetId,
    /** Where MonoRail creates the default dataset when it does not exist. */
    location,
    billingProject: billing ? checkProject(billing, 'billing project id') : projectId,
    syncEvery: every,
    everyMs: SYNC_EVERY[every],
    maxBytes: gb * 1024 ** 3,
    source: `${projectId}.${datasetId}`,
  }
}

/**
 * SQL that makes an empty dataset in the layout. Safe to run again: every
 * statement is IF NOT EXISTS, and the layout row is added only when missing.
 * The page shows it for the user to run; ensureDataset() runs it for the
 * default dataset only.
 */
function setupSql(projectId, datasetId = DEFAULT_DATASET, location = DEFAULT_LOCATION) {
  const p = checkProject(projectId)
  const d = checkDataset(datasetId)
  const l = checkLocation(location)
  const t = (name) => `\`${p}.${d}.${name}\``
  return `-- MonoRail metadata layout (${LAYOUT}) in ${p}.${d}.
-- Safe to run again: nothing that exists is changed. The location only
-- applies when the dataset is created.
CREATE SCHEMA IF NOT EXISTS \`${p}.${d}\` OPTIONS (location = '${l}');

-- One row per entity: OpenMetadata's JSON with owners, tags and columns inside.
CREATE TABLE IF NOT EXISTS ${t('entity')} (
  id STRING NOT NULL,          -- OpenMetadata's UUID
  type STRING NOT NULL,        -- entity type, as OpenMetadata spells it (table, databaseSchema, glossaryTerm, ...)
  fqn STRING NOT NULL,         -- fullyQualifiedName
  name STRING NOT NULL,
  version FLOAT64 NOT NULL,    -- 0.1, 0.2, ...
  updated_at TIMESTAMP NOT NULL,
  deleted BOOL NOT NULL,
  json JSON NOT NULL
)
PARTITION BY DATE(updated_at)
CLUSTER BY type, fqn;

-- Every version of every entity (optional).
CREATE TABLE IF NOT EXISTS ${t('entity_version')} (
  id STRING NOT NULL,
  version FLOAT64 NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  json JSON NOT NULL
)
PARTITION BY DATE(updated_at)
CLUSTER BY id;

-- JSON documents that are not entities, such as table profiles (optional).
CREATE TABLE IF NOT EXISTS ${t('record')} (
  kind STRING NOT NULL,        -- tableProfile, pipelineStatus, ...
  owner STRING NOT NULL,       -- the entity id it belongs to
  key STRING NOT NULL,
  \`at\` TIMESTAMP NOT NULL,   -- AT is reserved in BigQuery, so quoted
  json JSON NOT NULL
)
PARTITION BY DATE(\`at\`)
CLUSTER BY kind, owner;

-- Lineage: one row per edge between two entities (optional). json is
-- OpenMetadata's edge: { "fromEntity": {...}, "toEntity": {...}, "lineageDetails": {...} },
-- both ends EntityReferences ({ "id", "type", "fullyQualifiedName", ... }).
-- Keep one row per (from_id, to_id); set deleted to drop an edge, or delete the row.
CREATE TABLE IF NOT EXISTS ${t('lineage')} (
  from_id STRING NOT NULL,     -- upstream entity's UUID
  from_type STRING NOT NULL,   -- its entity type (table, pipeline, dashboard, ...)
  to_id STRING NOT NULL,       -- downstream entity's UUID
  to_type STRING NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted BOOL NOT NULL,
  json JSON NOT NULL
)
PARTITION BY DATE(updated_at)
CLUSTER BY from_id, to_id;

-- Says which layout this dataset holds.
CREATE TABLE IF NOT EXISTS ${t('meta')} (
  key STRING NOT NULL,
  value STRING NOT NULL
);
INSERT INTO ${t('meta')} (key, value)
SELECT 'layout', '${LAYOUT}'
FROM (SELECT 1)
WHERE NOT EXISTS (SELECT 1 FROM ${t('meta')} WHERE key = 'layout');
`
}

const layoutVersion = (v) => {
  const m = /^monorail\.metadata\/(\d+)$/.exec(String(v ?? ''))
  return m ? Number(m[1]) : undefined
}

/** Rows from tabledata.list ({ f: [{ v }] }, every column in schema order) as objects. */
function decodeRows(fields, rows) {
  return rows.map((r) => Object.fromEntries(fields.map((f, i) => [f.name, r?.f?.[i]?.v ?? null])))
}

/** tabledata.list TIMESTAMP (int64 microseconds) to ms. */
const microsToMs = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.floor(n / 1000) : NaN
}

/**
 * Whether the dataset holds the layout. Reads metadata only (dataset, table
 * list, table schemas, the meta table through tabledata.list): no query.
 * state: ok | missing | empty | foreign | mismatch | newer
 */
async function inspectDataset(client, { projectId, datasetId }) {
  const where = `${projectId}.${datasetId}`
  let location
  try {
    location = (await client.getDataset({ projectId, datasetId })).location
  } catch (e) {
    if (e.status === 404) return { state: 'missing', message: `There is no dataset ${datasetId} in project ${projectId}, or your Google account cannot see it. Create it with the setup SQL, or pick another dataset.` }
    if (e.status === 403) return { state: 'denied', message: `Your Google account may not read ${where}: ${e.message}` }
    throw e
  }
  const { tables } = await client.listTables({ projectId, datasetId })
  const names = new Set(tables.map((t) => t.id))
  if (!names.size) return { state: 'empty', location, message: `${where} is empty. Run the setup SQL to create MonoRail's tables in it, then fill them.` }
  const missing = Object.entries(TABLES).filter(([n, spec]) => spec.required && !names.has(n)).map(([n]) => n)
  if (missing.length) {
    const other = [...names].slice(0, 5).join(', ')
    return { state: 'foreign', location, message: `${where} holds other tables (${other}${names.size > 5 ? ', ...' : ''}) and not MonoRail's ${missing.join(' and ')}. Pick another dataset, or create the layout with the setup SQL.` }
  }
  const info = {}
  const problems = []
  const checkTable = async (name, spec) => {
    const t = await client.getTable({ projectId, datasetId, tableId: name })
    const types = new Map(t.fields.map((f) => [f.name, String(f.type).toUpperCase()]))
    for (const [col, allowed] of Object.entries(spec.columns)) {
      const type = types.get(col)
      if (!type) problems.push(`${name}.${col} is missing`)
      else if (!allowed.includes(type)) problems.push(`${name}.${col} is ${type}, expected ${allowed[0]}`)
    }
    info[name] = {
      rows: t.numRows ?? 0,
      bytes: t.numBytes ?? 0,
      streamingRows: t.streamingRows ?? 0,
      partitioned: spec.time ? t.partitionField === spec.time : undefined,
      jsonType: types.get('json'),
      fields: t.fields.map((f) => ({ name: f.name })),
    }
  }
  const mismatch = () => ({ state: 'mismatch', location, tables: info, message: `${where} does not match MonoRail's layout: ${problems.slice(0, 6).join('; ')}.` })
  // Tables every layout version has first; tables added later only once the layout row says the dataset has them.
  for (const [name, spec] of Object.entries(TABLES)) if (!spec.since && names.has(name)) await checkTable(name, spec)
  if (problems.length) return mismatch()
  const meta = decodeRows(info.meta.fields, (await client.listTableData({ projectId, datasetId, tableId: 'meta', maxResults: 1000 })).rows)
  const layout = meta.find((r) => r.key === 'layout')?.value
  const v = layoutVersion(layout)
  if (v === undefined) return { state: 'foreign', location, tables: info, message: `${where}.meta has no layout row ('layout' = '${LAYOUT}'), so MonoRail cannot tell it holds its metadata. Add the row if it does.` }
  if (v > layoutVersion(LAYOUT)) return { state: 'newer', location, tables: info, layout, message: `${where} holds a newer layout (${layout}) than this MonoRail understands. Update MonoRail.` }
  for (const [name, spec] of Object.entries(TABLES)) if (spec.since && spec.since <= v && names.has(name)) await checkTable(name, spec)
  if (problems.length) return mismatch()
  return { state: 'ok', location, tables: info, layout, lineage: !!info.lineage }
}

/** States in which the default dataset is free for MonoRail to set up: not there, or there with no tables. */
const FREE_STATES = new Set(['missing', 'empty'])

/**
 * Inspect the dataset; when it is the default METADATA and free (missing, or
 * there with no tables), make it first: setupSql() as one script job in the
 * billing project at the chosen location. DDL is not billed; the layout
 * row's check reads the empty meta table. Returns { check, created }. Any
 * other dataset, or a default one that holds something, is never touched.
 */
async function ensureDataset(client, config) {
  const { projectId, datasetId, billingProject, location } = config
  const check = await inspectDataset(client, { projectId, datasetId })
  if (datasetId !== DEFAULT_DATASET || !FREE_STATES.has(check.state)) return { check, created: false }
  try {
    await eachQueryPage(client, { projectId: billingProject, location: check.location ?? location, query: setupSql(projectId, datasetId, location) }, () => {})
  } catch (e) {
    throw fail(`Could not create ${projectId}.${datasetId}: ${e.message}${e.status === 403 ? ' Your Google account needs permission to create datasets in that project (BigQuery Data Editor or Admin).' : ''}`, 'create-failed')
  }
  return { check: await inspectDataset(client, { projectId, datasetId }), created: true }
}

/** Every page of a table through tabledata.list (free). */
async function eachTablePage(client, { projectId, datasetId, tableId, selectedFields, maxResults = PAGE_ROWS }, onPage) {
  let pageToken
  do {
    const page = await client.listTableData({ projectId, datasetId, tableId, selectedFields, maxResults, pageToken })
    await onPage(page.rows)
    pageToken = page.pageToken
  } while (pageToken)
}

/** A query's every page, waiting for the job when it runs long. */
async function eachQueryPage(client, req, onPage) {
  let res = await client.runQuery({ ...req, maxResults: 1000, timeoutMs: 20_000 })
  const started = Date.now()
  while (!res.jobComplete) {
    if (Date.now() - started > QUERY_WAIT_MS) throw fail('BigQuery took longer than 10 minutes to answer the sync query.', 'timeout')
    res = await client.getQueryResults({ projectId: res.job.projectId, jobId: res.job.jobId, location: res.job.location, maxResults: 1000, timeoutMs: 20_000 })
  }
  const bytes = res.totalBytesProcessed ?? 0
  const names = res.fields.map((f) => f.name)
  for (;;) {
    await onPage(res.rows.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i]]))))
    if (!res.pageToken) break
    res = await client.getQueryResults({ projectId: res.job.projectId, jobId: res.job.jobId, location: res.job.location, maxResults: 1000, pageToken: res.pageToken, timeoutMs: 20_000 })
  }
  return bytes
}

function parseObject(text) {
  if (typeof text !== 'string') return undefined
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined
  } catch {
    return undefined
  }
}

/** A lineage edge's key: one edge per (from, to) pair, as OpenMetadata keeps one relationship per pair. */
const edgeKey = (fromId, toId) => `${fromId}|${toId}`
const nonEmpty = (v) => typeof v === 'string' && v.length > 0 && v.length <= 4000
const truthy = (v) => v === true || v === 'true'

/** Turn the time-filtered SELECT for one table. `since` is ms. */
function incrementalSql(table, { projectId, datasetId, jsonType, since }) {
  const from = `\`${projectId}.${datasetId}.${table}\``
  const json = jsonType === 'JSON' ? 'TO_JSON_STRING(json)' : 'json'
  const s = Math.floor(since)
  if (table === 'entity') {
    return `SELECT id, type, fqn, name, CAST(version AS FLOAT64) AS version, UNIX_MILLIS(updated_at) AS updated_ms, IFNULL(deleted, FALSE) AS deleted, ${json} AS json
FROM ${from}
WHERE updated_at >= TIMESTAMP_MILLIS(${s})
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC, version DESC) = 1`
  }
  if (table === 'entity_version') {
    return `SELECT id, CAST(version AS FLOAT64) AS version, UNIX_MILLIS(updated_at) AS updated_ms, ${json} AS json
FROM ${from}
WHERE updated_at >= TIMESTAMP_MILLIS(${s})`
  }
  if (table === 'lineage') {
    return `SELECT from_id, from_type, to_id, to_type, UNIX_MILLIS(updated_at) AS updated_ms, IFNULL(deleted, FALSE) AS deleted, ${json} AS json
FROM ${from}
WHERE updated_at >= TIMESTAMP_MILLIS(${s})
QUALIFY ROW_NUMBER() OVER (PARTITION BY from_id, to_id ORDER BY updated_at DESC) = 1`
  }
  return `SELECT kind, owner, key, UNIX_MILLIS(\`at\`) AS at_ms, ${json} AS json
FROM ${from}
WHERE \`at\` >= TIMESTAMP_MILLIS(${s})`
}

/**
 * Bring the copy in step with BigQuery. `store` is an entity store
 * (localdb openDatabase / mirrorDb). Returns what changed. Throws an error
 * with a `code` (the inspectDataset state, 'over-cap', 'timeout') when it
 * cannot.
 */
async function syncMirror({ client, store, config, full = false }) {
  const { projectId, datasetId, billingProject, maxBytes, source } = config
  const { check, created } = await ensureDataset(client, config)
  if (check.state !== 'ok') throw fail(check.message, check.state)
  const out = { mode: full ? 'full' : 'incremental', reason: full ? 'asked' : undefined, created, layout: check.layout, entities: 0, versions: 0, records: 0, lineage: 0, removed: 0, lineageRemoved: 0, skipped: 0, bytesProcessed: 0, remote: { entities: check.tables.entity.rows, bytes: check.tables.entity.bytes, partitioned: check.tables.entity.partitioned, lineage: check.lineage } }

  // bq.layout is the dataset's layout: a dataset moving to a newer layout is copied in full again.
  if (store.getMeta('bq.source') !== source || store.getMeta('bq.layout') !== check.layout) {
    store.clearAll()
    out.mode = 'full'
    out.reason = 'first'
  } else if (store.getMeta('bq.watermark.entity') === undefined) {
    out.mode = 'full'
    out.reason = 'first'
  }

  const tables = Object.keys(TABLES).filter((n) => n !== 'meta' && check.tables[n])
  const marks = {}
  const apply = {
    entity(r, seen) {
      const id = r.id
      const updatedAt = r.updated_ms !== undefined ? Number(r.updated_ms) : microsToMs(r.updated_at)
      const version = Number(r.version)
      const entity = parseObject(r.json)
      if (!nonEmpty(id) || !nonEmpty(r.type) || !nonEmpty(r.fqn) || !Number.isFinite(updatedAt) || !Number.isFinite(version) || !entity) return void out.skipped++
      if (seen) {
        const prev = seen.get(id)
        if (prev !== undefined && prev > updatedAt) return // an older duplicate of a row already copied
        seen.set(id, updatedAt)
      }
      store.putExact({ id, type: r.type, fqn: r.fqn, name: nonEmpty(r.name) ? r.name : r.fqn, version, updatedAt, deleted: truthy(r.deleted), entity })
      marks.entity = Math.max(marks.entity ?? 0, updatedAt)
      out.entities++
    },
    entity_version(r) {
      const updatedAt = r.updated_ms !== undefined ? Number(r.updated_ms) : microsToMs(r.updated_at)
      const version = Number(r.version)
      const entity = parseObject(r.json)
      if (!nonEmpty(r.id) || !Number.isFinite(version) || !Number.isFinite(updatedAt) || !entity) return void out.skipped++
      store.putVersionExact(r.id, version, entity)
      marks.entity_version = Math.max(marks.entity_version ?? 0, updatedAt)
      out.versions++
    },
    record(r) {
      const at = r.at_ms !== undefined ? Number(r.at_ms) : microsToMs(r.at)
      const value = parseObject(r.json)
      if (!nonEmpty(r.kind) || !nonEmpty(r.owner) || !nonEmpty(r.key) || !Number.isFinite(at) || !value) return void out.skipped++
      store.putRecord(r.kind, r.owner, r.key, at, value)
      marks.record = Math.max(marks.record ?? 0, at)
      out.records++
    },
    lineage(r, seen) {
      const updatedAt = r.updated_ms !== undefined ? Number(r.updated_ms) : microsToMs(r.updated_at)
      const edge = parseObject(r.json)
      if (!nonEmpty(r.from_id) || !nonEmpty(r.to_id) || !nonEmpty(r.from_type) || !nonEmpty(r.to_type) || r.from_id === r.to_id || !Number.isFinite(updatedAt) || !edge) return void out.skipped++
      if (seen) {
        const key = edgeKey(r.from_id, r.to_id)
        const prev = seen.get(key)
        if (prev !== undefined && prev > updatedAt) return
        seen.set(key, updatedAt)
      }
      store.putLineageExact({ fromId: r.from_id, fromType: r.from_type, toId: r.to_id, toType: r.to_type, updatedAt, deleted: truthy(r.deleted), edge })
      marks.lineage = Math.max(marks.lineage ?? 0, updatedAt)
      out.lineage++
    },
  }
  const removeEdges = (keep) => {
    const gone = store.lineageKeys().filter((k) => !keep(edgeKey(k.fromId, k.toId)))
    store.transaction(() => gone.forEach((k) => store.removeLineage(k.fromId, k.toId)))
    out.lineageRemoved += gone.length
  }
  // A dataset without a lineage table (layout /1, or the table was dropped) has no lineage.
  if (!check.tables.lineage && store.countLineage() > 0) removeEdges(() => false)

  if (out.mode === 'full') {
    for (const name of tables) {
      const seen = name === 'entity' || name === 'lineage' ? new Map() : undefined
      const fields = check.tables[name].fields
      await eachTablePage(client, { projectId, datasetId, tableId: name }, (rows) => {
        store.transaction(() => {
          for (const r of decodeRows(fields, rows)) apply[name](r, seen)
        })
      })
      if (name === 'entity') {
        const gone = store.ids().filter((id) => !seen.has(id))
        store.transaction(() => gone.forEach((id) => store.remove(id)))
        out.removed += gone.length
      } else if (name === 'lineage') {
        removeEdges((key) => seen.has(key))
      }
    }
  } else {
    const plan = tables.map((name) => {
      const last = Number(store.getMeta(`bq.watermark.${name}`) ?? 0)
      marks[name] = last
      return { name, sql: incrementalSql(name, { projectId, datasetId, jsonType: check.tables[name].jsonType, since: last - OVERLAP_MS }) }
    })
    const req = { projectId: billingProject, location: check.location }
    let estimate = 0
    for (const p of plan) estimate += (await client.runQuery({ ...req, query: p.sql, dryRun: true })).totalBytesProcessed ?? 0
    if (estimate > maxBytes) {
      const gb = (n) => `${(n / 1024 ** 3).toFixed(n < 1024 ** 3 ? 2 : 1)} GB`
      const hint = check.tables.entity.partitioned ? '' : ' Partitioning the tables on their time column (see the setup SQL) makes each sync read only recent rows.'
      throw fail(`A sync would scan ${gb(estimate)} in BigQuery, more than your limit of ${gb(maxBytes)}, so nothing ran.${hint} Raise the limit on Connections, or use Full refresh (free in BigQuery, but downloads everything).`, 'over-cap')
    }
    for (const p of plan) {
      out.bytesProcessed += await eachQueryPage(client, { ...req, query: p.sql, maximumBytesBilled: maxBytes }, (rows) => {
        store.transaction(() => rows.forEach((r) => apply[p.name](r)))
      })
    }
    // Entities removed from BigQuery outright: the copy then has more rows than BigQuery.
    const remote = check.tables.entity.rows + check.tables.entity.streamingRows
    if (store.countAll() > remote) {
      const ids = new Set()
      await eachTablePage(client, { projectId, datasetId, tableId: 'entity', selectedFields: ['id'], maxResults: ID_PAGE_ROWS }, (rows) => {
        for (const r of rows) if (r?.f?.[0]?.v) ids.add(r.f[0].v)
      })
      const gone = store.ids().filter((id) => !ids.has(id))
      store.transaction(() => gone.forEach((id) => store.remove(id)))
      out.removed += gone.length
    }
    // Edges removed outright, the same way: listing only from_id and to_id is free.
    if (check.tables.lineage && store.countLineage() > check.tables.lineage.rows + check.tables.lineage.streamingRows) {
      const keys = new Set()
      await eachTablePage(client, { projectId, datasetId, tableId: 'lineage', selectedFields: ['from_id', 'to_id'], maxResults: ID_PAGE_ROWS }, (rows) => {
        for (const r of rows) if (r?.f?.[0]?.v && r.f[1]?.v) keys.add(edgeKey(r.f[0].v, r.f[1].v))
      })
      removeEdges((key) => keys.has(key))
    }
  }

  store.transaction(() => {
    for (const name of tables) store.setMeta(`bq.watermark.${name}`, String(marks[name] ?? 0))
    store.setMeta('bq.source', source)
    store.setMeta('bq.layout', check.layout)
    store.setMeta('bq.lineage', check.tables.lineage ? 'yes' : 'no')
  })
  return out
}

/**
 * A BigQuery client signed in with the user's own gcloud login (connector
 * `gcloud`). The token stays in memory for 30 minutes; a 401 fetches a new one.
 */
function gcloudClient({ getCredentials, hasConnection, fetch } = {}) {
  const conns = () => require('../connections/index.cjs')
  const has = hasConnection ?? ((k) => conns().hasConnection(k))
  const creds = getCredentials ?? ((k) => conns().getCredentials(k))
  let token
  return createClient({
    fetchImpl: fetch,
    getToken: async ({ refresh }) => {
      if (!(await has('gcloud'))) throw fail('Set up Google Cloud on the Connections page first: MonoRail reads BigQuery with your own gcloud login.', 'no-gcloud')
      if (!refresh && token && Date.now() - token.at < TOKEN_TTL_MS) return token.value
      const c = await creds('gcloud')
      token = { value: c.accessToken, at: Date.now() }
      return token.value
    },
  })
}

module.exports = { LAYOUT, DEFAULT_DATASET, DEFAULT_LOCATION, TABLES, SYNC_EVERY, MAX_SCAN_GB, OVERLAP_MS, configOf, setupSql, inspectDataset, ensureDataset, syncMirror, gcloudClient, incrementalSql, _internal: { decodeRows, layoutVersion } }
