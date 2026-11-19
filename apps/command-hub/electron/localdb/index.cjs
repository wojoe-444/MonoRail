// MonoRail's local database: one SQLite file per profile
// (<profile data folder>\databases\local.sqlite3), the home for in-app data
// kept in OpenMetadata's shape. docs/local-database.md.
//
// It holds OpenMetadata entities (any type of the MonoRail standard, stored as
// OpenMetadata JSON with OpenMetadata's id, fullyQualifiedName, version and
// updatedAt), every version of each entity, lineage edges between entities
// (kept apart from entity JSON, as OpenMetadata keeps them), and small records
// that are not entities (pipeline run statuses). The OpenMetadata page reads it when no
// OpenMetadata server is connected, and local ingestion pipelines write it.
//
// SQLite is the engine built into the Node runtime inside Electron
// (`node:sqlite`), so nothing is bundled. The file is created on first use in
// MonoRail's own data folder; it never leaves the PC. WAL mode lets the app and
// other MonoRail processes read while one writes. A file that is not a
// database, or one made by a newer MonoRail, is never overwritten: opening
// throws and the page shows the error. No Electron here, so tests and the MCP
// server can use it.

const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')

const DB_FILE = 'local.sqlite3'
const FOLDER = 'databases'
/** Bump with a new step in MIGRATIONS. */
const SCHEMA_VERSION = 2
/** OpenMetadata's lineage API answers at most 3 levels each way; local reads keep the same limit. */
const MAX_LINEAGE_DEPTH = 3
/** The most matches one search returns; the page says how many more there are. */
const SEARCH_MAX = 500

const MIGRATIONS = [
  // 1: entities, their versions, records
  `CREATE TABLE entity (
     id TEXT PRIMARY KEY,
     type TEXT NOT NULL,
     fqn TEXT NOT NULL,
     name TEXT NOT NULL,
     version REAL NOT NULL,
     updated_at INTEGER NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     json TEXT NOT NULL,
     UNIQUE (type, fqn)
   );
   CREATE INDEX entity_updated ON entity (updated_at);
   CREATE TABLE entity_version (
     id TEXT NOT NULL,
     version REAL NOT NULL,
     json TEXT NOT NULL,
     PRIMARY KEY (id, version)
   );
   CREATE TABLE record (
     kind TEXT NOT NULL,
     owner TEXT NOT NULL,
     key TEXT NOT NULL,
     at INTEGER NOT NULL,
     json TEXT NOT NULL,
     PRIMARY KEY (kind, owner, key)
   );
   CREATE INDEX record_at ON record (kind, owner, at);
   CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  // 2: lineage edges, one per (from id, to id); json is OpenMetadata's
  //    EntitiesEdge ({ fromEntity, toEntity, lineageDetails }, EntityReferences)
  `CREATE TABLE lineage (
     from_id TEXT NOT NULL,
     from_type TEXT NOT NULL,
     to_id TEXT NOT NULL,
     to_type TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     deleted INTEGER NOT NULL DEFAULT 0,
     json TEXT NOT NULL,
     PRIMARY KEY (from_id, to_id)
   );
   CREATE INDEX lineage_to ON lineage (to_id);`,
]

/** OpenMetadata quotes a name that holds a dot inside a fully qualified name. */
function fqnPart(name) {
  const s = String(name)
  return s.includes('.') ? `"${s.replace(/"/g, '')}"` : s
}
const fqnOf = (...parts) => parts.map(fqnPart).join('.')

/** Open (and create or upgrade) the database in `dir`. Throws a readable message when it cannot be used. */
function openDatabase(dir, { file = DB_FILE } = {}) {
  const { DatabaseSync } = require('node:sqlite')
  fs.mkdirSync(dir, { recursive: true })
  const where = path.join(dir, file)
  let db
  try {
    db = new DatabaseSync(where, { timeout: 5000 })
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    const current = db.prepare('PRAGMA user_version').get().user_version
    if (current > SCHEMA_VERSION) throw new Error(`MonoRail's local database was made by a newer version of MonoRail (schema ${current}). Update MonoRail to use it; it was left as it is.`)
    for (let v = current; v < SCHEMA_VERSION; v++) {
      db.exec('BEGIN')
      try {
        db.exec(MIGRATIONS[v])
        db.exec(`PRAGMA user_version = ${v + 1}`)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    }
  } catch (e) {
    try {
      db?.close()
    } catch {
      // already closed
    }
    const msg = String(e?.message ?? e)
    if (/not a database|malformed|file is encrypted/i.test(msg)) throw new Error("MonoRail's local database file is damaged, so it was left as it is. Move it out of the databases folder to start a new one.")
    throw e
  }
  return createEntityStore(db)
}

const round1 = (n) => Math.round(n * 10) / 10
const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
const clampDepth = (n) => Math.max(0, Math.min(MAX_LINEAGE_DEPTH, Math.floor(Number(n)) || 0))

/** An EntityReference for a stored entity, as OpenMetadata's lineage API lists nodes. */
const refOf = (type, e) => strip({ id: e.id, type, name: e.name, fullyQualifiedName: e.fullyQualifiedName, displayName: e.displayName, description: e.description, deleted: e.deleted || undefined })

/** Both ends of an edge, checked: each needs an id and a type, and they differ. */
function edgeEnds(edge) {
  const end = (r, what) => {
    if (!r || typeof r.id !== 'string' || !r.id || typeof r.type !== 'string' || !r.type) throw new Error(`A lineage edge needs ${what} with an id and a type.`)
    return strip({ id: r.id, type: r.type, name: r.name, fullyQualifiedName: r.fullyQualifiedName, displayName: r.displayName })
  }
  const from = end(edge?.fromEntity, 'fromEntity')
  const to = end(edge?.toEntity, 'toEntity')
  if (from.id === to.id) throw new Error('A lineage edge cannot point at itself.')
  return { from, to }
}

const edgeRow = (r) => ({ fromId: r.from_id, toId: r.to_id, edge: JSON.parse(r.json) })

/** JSON with object keys sorted and undefined dropped, so the same content always compares equal. */
function stableStringify(value) {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, v[k]])) : v))
}

/** What counts as a change: everything but the bookkeeping fields. */
const comparable = (e) => {
  const { version: _v, updatedAt: _u, updatedBy: _b, changeDescription: _c, href: _h, ...rest } = e
  return stableStringify(rest)
}

function createEntityStore(db) {
  const q = (sql) => db.prepare(sql)
  const s = {
    byId: q('SELECT json FROM entity WHERE id = ?'),
    byFqn: q('SELECT json FROM entity WHERE type = ? AND fqn = ?'),
    insert: q('INSERT INTO entity (id, type, fqn, name, version, updated_at, deleted, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    update: q('UPDATE entity SET type = ?, fqn = ?, name = ?, version = ?, updated_at = ?, deleted = ?, json = ? WHERE id = ?'),
    version: q('INSERT OR REPLACE INTO entity_version (id, version, json) VALUES (?, ?, ?)'),
    versions: q('SELECT json FROM entity_version WHERE id = ? ORDER BY version DESC'),
    remove: q('DELETE FROM entity WHERE id = ?'),
    removeVersions: q('DELETE FROM entity_version WHERE id = ?'),
    counts: q('SELECT type, count(*) AS n FROM entity WHERE deleted = 0 GROUP BY type'),
    recent: q('SELECT type, json FROM entity WHERE deleted = 0 ORDER BY updated_at DESC LIMIT ?'),
    everything: q('SELECT type, json FROM entity WHERE deleted = 0 ORDER BY type, fqn LIMIT ?'),
    countLive: q('SELECT count(*) AS n FROM entity WHERE deleted = 0'),
    all: q('SELECT json FROM entity WHERE type = ? ORDER BY fqn'),
    putRecord: q('INSERT OR REPLACE INTO record (kind, owner, key, at, json) VALUES (?, ?, ?, ?, ?)'),
    records: q('SELECT json FROM record WHERE kind = ? AND owner = ? ORDER BY at DESC LIMIT ?'),
    recordsOfKind: q('SELECT owner, json FROM record WHERE kind = ? ORDER BY owner, at DESC'),
    deleteRecords: q('DELETE FROM record WHERE kind = ? AND owner = ?'),
    prune: q('DELETE FROM record WHERE kind = ? AND owner = ? AND key NOT IN (SELECT key FROM record WHERE kind = ? AND owner = ? ORDER BY at DESC LIMIT ?)'),
    getMeta: q('SELECT value FROM meta WHERE key = ?'),
    setMeta: q('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)'),
    // A copy of another store (localdb/bigquery-mirror.cjs): rows go in exactly as the source has them.
    stamp: q('SELECT updated_at FROM entity WHERE id = ?'),
    sameName: q('SELECT id FROM entity WHERE type = ? AND fqn = ? AND id <> ?'),
    upsertExact: q(
      `INSERT INTO entity (id, type, fqn, name, version, updated_at, deleted, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET type = excluded.type, fqn = excluded.fqn, name = excluded.name, version = excluded.version,
         updated_at = excluded.updated_at, deleted = excluded.deleted, json = excluded.json`,
    ),
    ids: q('SELECT id FROM entity'),
    countAll: q('SELECT count(*) AS n FROM entity'),
    typeOf: q('SELECT type, json FROM entity WHERE id = ?'),
    // Lineage edges
    edge: q('SELECT json, deleted FROM lineage WHERE from_id = ? AND to_id = ?'),
    upsertEdge: q(
      `INSERT INTO lineage (from_id, from_type, to_id, to_type, updated_at, deleted, json) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (from_id, to_id) DO UPDATE SET from_type = excluded.from_type, to_type = excluded.to_type,
         updated_at = excluded.updated_at, deleted = excluded.deleted, json = excluded.json`,
    ),
    removeEdge: q('DELETE FROM lineage WHERE from_id = ? AND to_id = ?'),
    removeEdgesOf: q('DELETE FROM lineage WHERE from_id = ? OR to_id = ?'),
    edgesInto: q('SELECT from_id, to_id, json FROM lineage WHERE to_id = ? AND deleted = 0'),
    edgesFrom: q('SELECT from_id, to_id, json FROM lineage WHERE from_id = ? AND deleted = 0'),
    edgeKeys: q('SELECT from_id, to_id FROM lineage'),
    countEdges: q('SELECT count(*) AS n FROM lineage'),
  }
  const parse = (row) => (row ? JSON.parse(row.json) : undefined)
  let depth = 0

  const store = {
    /** Run `fn` in one transaction (nested calls join the outer one). */
    transaction(fn) {
      if (depth > 0) return fn()
      depth++
      db.exec('BEGIN IMMEDIATE')
      try {
        const out = fn()
        db.exec('COMMIT')
        return out
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      } finally {
        depth--
      }
    },

    get: (type, fqn) => parse(s.byFqn.get(type, fqn)),
    byId: (id) => parse(s.byId.get(id)),
    /** Every entity of a type, by full name (small types only: pipelines, local catalog). */
    all: (type) => s.all.all(type).map(parse),

    /**
     * Add or update an entity, as OpenMetadata does: matched by id, then by
     * type and full name; the version goes up by 0.1 on a real change and the
     * old JSON stays in the version history. Returns the stored entity.
     */
    put(type, entity, { by = 'monorail', now = Date.now() } = {}) {
      if (!entity || typeof entity.name !== 'string' || !entity.name) throw new Error('An entity needs a name.')
      const fqn = entity.fullyQualifiedName || fqnPart(entity.name)
      return store.transaction(() => {
        const prev = (entity.id && store.byId(entity.id)) || store.get(type, fqn)
        if (prev) {
          const next = { ...entity, id: prev.id, fullyQualifiedName: fqn }
          if (comparable(next) === comparable({ ...prev, fullyQualifiedName: fqn })) return prev
          const stored = { ...next, version: round1((prev.version ?? 0.1) + 0.1), updatedAt: now, updatedBy: by }
          s.update.run(type, fqn, entity.name, stored.version, now, stored.deleted ? 1 : 0, JSON.stringify(stored), prev.id)
          s.version.run(prev.id, stored.version, JSON.stringify(stored))
          return stored
        }
        const stored = { ...entity, id: entity.id || randomUUID(), fullyQualifiedName: fqn, version: 0.1, updatedAt: now, updatedBy: by }
        s.insert.run(stored.id, type, fqn, entity.name, stored.version, now, stored.deleted ? 1 : 0, JSON.stringify(stored))
        s.version.run(stored.id, stored.version, JSON.stringify(stored))
        return stored
      })
    },

    /** Remove an entity and its history for good. */
    remove(id) {
      store.transaction(() => {
        s.remove.run(id)
        s.removeVersions.run(id)
      })
    },

    /** One page of a type, OpenMetadata's list shape: { data, paging: { total, after } }. Paged by full name. */
    list(type, { after, limit = 50, deleted = false } = {}) {
      const n = Math.max(1, Math.min(100, Number(limit) || 50))
      const where = `type = ?${deleted ? '' : ' AND deleted = 0'}`
      const total = db.prepare(`SELECT count(*) AS n FROM entity WHERE ${where}`).get(type).n
      const rows = after
        ? db.prepare(`SELECT json, fqn FROM entity WHERE ${where} AND fqn > ? ORDER BY fqn LIMIT ?`).all(type, String(after), n + 1)
        : db.prepare(`SELECT json, fqn FROM entity WHERE ${where} ORDER BY fqn LIMIT ?`).all(type, n + 1)
      const page = rows.slice(0, n)
      return { data: page.map(parse), paging: { total, after: rows.length > n ? page[page.length - 1].fqn : undefined } }
    },

    /**
     * Search every entity of `types` (all types when none) in the whole
     * database, not a loaded page: each word must appear in the name, display
     * name, full name, description, owners or tags (case ignored). The best
     * `limit` matches come first: exact name, then name starting with the
     * text, then name containing it, then the rest; shorter names first.
     * Returns { data: [{ ...entity, entityType }], total } with total the
     * number of matches.
     */
    search({ q = '', types, limit = 50, deleted = false } = {}) {
      const n = Math.max(1, Math.min(SEARCH_MAX, Number(limit) || 50))
      const text = String(q ?? '').trim().toLowerCase().slice(0, 200)
      const words = [...new Set(text.split(/\s+/).filter(Boolean))].slice(0, 8)
      const where = []
      const params = []
      if (!deleted) where.push('deleted = 0')
      const wanted = Array.isArray(types) ? types.filter((t) => typeof t === 'string' && t) : []
      if (wanted.length) {
        where.push(`type IN (${wanted.map(() => '?').join(', ')})`)
        params.push(...wanted)
      }
      // instr, not LIKE: a word with % or _ in it is matched as typed.
      const hay = `lower(fqn || ' ' || name || ' ' || ifnull(json_extract(json, '$.displayName'), '') || ' ' || ifnull(json_extract(json, '$.description'), '') || ' ' || ifnull(json_extract(json, '$.owners'), '') || ' ' || ifnull(json_extract(json, '$.tags'), ''))`
      for (const w of words) {
        where.push(`instr(${hay}, ?) > 0`)
        params.push(w)
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
      const total = db.prepare(`SELECT count(*) AS n FROM entity ${clause}`).get(...params).n
      // Rank on the name: a display name counts as the name when there is one.
      const names = `(lower(name) || char(10) || lower(ifnull(json_extract(json, '$.displayName'), '')))`
      const rank = text
        ? `CASE WHEN lower(name) = ? OR lower(ifnull(json_extract(json, '$.displayName'), '')) = ? THEN 0
                WHEN instr(char(10) || ${names}, char(10) || ?) > 0 THEN 1
                WHEN instr(${names}, ?) > 0 THEN 2
                WHEN instr(lower(fqn), ?) > 0 THEN 3 ELSE 4 END`
        : '0'
      const rankParams = text ? [text, text, text, text, text] : []
      const rows = db.prepare(`SELECT type, json FROM entity ${clause} ORDER BY ${rank}, length(name), fqn LIMIT ${n}`).all(...params, ...rankParams)
      return { data: rows.map((r) => ({ ...JSON.parse(r.json), entityType: r.type })), total }
    },

    /** Entities per type (not deleted). */
    counts: () => Object.fromEntries(s.counts.all().map((r) => [r.type, r.n])),
    /** Every version of an entity, newest first. */
    versions: (id) => s.versions.all(id).map(parse),
    /** Latest changes across every type, with `entityType` as on OpenMetadata's search results. */
    recent: (n = 30) => s.recent.all(Math.max(1, Math.min(100, n))).map((r) => ({ ...JSON.parse(r.json), entityType: r.type })),
    /** Every entity that is not deleted, by type and full name, at most `limit`, with `entityType`; and how many there are. */
    everything(limit = 5000) {
      const n = Math.max(1, Math.min(20_000, Number(limit) || 5000))
      return { entities: s.everything.all(n).map((r) => ({ ...JSON.parse(r.json), entityType: r.type })), total: s.countLive.get().n }
    },

    // Records: small JSON documents that are not entities, newest first by `at`.
    putRecord: (kind, owner, key, at, value) => void s.putRecord.run(kind, owner, key, at, JSON.stringify(value)),
    records: (kind, owner, limit = 100) => s.records.all(kind, owner, limit).map(parse),
    /** owner -> records, newest first. */
    recordsByOwner(kind) {
      const out = {}
      for (const r of s.recordsOfKind.all(kind)) (out[r.owner] ??= []).push(JSON.parse(r.json))
      return out
    },
    deleteRecords: (kind, owner) => void s.deleteRecords.run(kind, owner),
    pruneRecords: (kind, owner, keep) => void s.prune.run(kind, owner, kind, owner, keep),

    getMeta: (key) => s.getMeta.get(key)?.value,
    setMeta: (key, value) => void s.setMeta.run(key, String(value)),

    // ---- A copy of another store: no version bump, the source's id, version and time are kept.

    /** updated_at (ms) of an entity, or undefined. */
    stampOf: (id) => s.stamp.get(id)?.updated_at,
    /**
     * Store an entity exactly as the source has it. A different entity with
     * the same type and full name (the source renamed one) gives way, with
     * its versions. `entity` is the parsed OpenMetadata JSON; the columns win.
     */
    putExact({ id, type, fqn, name, version, updatedAt, deleted, entity }) {
      store.transaction(() => {
        for (const other of s.sameName.all(type, fqn, id)) store.remove(other.id)
        const json = { ...entity, id, fullyQualifiedName: fqn, version, updatedAt, ...(deleted || entity.deleted !== undefined ? { deleted: !!deleted } : {}) }
        s.upsertExact.run(id, type, fqn, name, version, updatedAt, deleted ? 1 : 0, JSON.stringify(json))
      })
    },
    putVersionExact: (id, version, entity) => void s.version.run(id, version, JSON.stringify(entity)),
    /** Every entity id (deleted ones too). */
    ids: () => s.ids.all().map((r) => r.id),
    /** Every entity, deleted ones too. */
    countAll: () => s.countAll.get().n,
    /** Empty every table (a copy whose source changed). */
    clearAll() {
      store.transaction(() => db.exec('DELETE FROM entity; DELETE FROM entity_version; DELETE FROM record; DELETE FROM lineage; DELETE FROM meta;'))
    },

    // ---- Lineage: edges between entities, kept apart from their JSON as OpenMetadata keeps them.
    // One edge per (from id, to id). Its JSON is OpenMetadata's EntitiesEdge:
    // { fromEntity, toEntity, lineageDetails?, description? }, both ends EntityReferences.

    /** Add or update an edge; unchanged content keeps its time. Both ends need an id and a type. */
    putLineage(edge, { now = Date.now() } = {}) {
      const { from, to } = edgeEnds(edge)
      const json = { ...edge, fromEntity: from, toEntity: to }
      const prev = s.edge.get(from.id, to.id)
      if (prev && !prev.deleted && stableStringify(JSON.parse(prev.json)) === stableStringify(json)) return json
      s.upsertEdge.run(from.id, from.type, to.id, to.type, now, 0, JSON.stringify(json))
      return json
    },
    /** Store an edge exactly as a source (the BigQuery copy) has it; the columns win over the JSON. */
    putLineageExact({ fromId, fromType, toId, toType, updatedAt, deleted, edge }) {
      const json = { ...edge, fromEntity: { ...edge?.fromEntity, id: fromId, type: fromType }, toEntity: { ...edge?.toEntity, id: toId, type: toType } }
      s.upsertEdge.run(fromId, fromType, toId, toType, updatedAt, deleted ? 1 : 0, JSON.stringify(json))
    },
    removeLineage: (fromId, toId) => void s.removeEdge.run(fromId, toId),
    /** Remove every edge into or out of an entity. */
    removeLineageOf: (id) => void s.removeEdgesOf.run(id, id),
    /** Edges into an entity (its upstream), not deleted: [{ fromId, toId, edge }]. */
    lineageInto: (id) => s.edgesInto.all(id).map(edgeRow),
    /** Edges out of an entity (its downstream), not deleted. */
    lineageFrom: (id) => s.edgesFrom.all(id).map(edgeRow),
    /** Every edge's key, deleted ones too: [{ fromId, toId }]. */
    lineageKeys: () => s.edgeKeys.all().map((r) => ({ fromId: r.from_id, toId: r.to_id })),
    countLineage: () => s.countEdges.get().n,

    /**
     * An entity's lineage in OpenMetadata's EntityLineage shape:
     * { entity, nodes, upstreamEdges, downstreamEdges }, edges as
     * { fromEntity: id, toEntity: id, lineageDetails? }, up to
     * MAX_LINEAGE_DEPTH levels each way. Undefined when the entity is not here.
     * `extra` edges ([{ fromId, toId, edge }], e.g. from an older field) are
     * walked too; the table's own edge wins for the same pair.
     */
    lineageOf(id, { upstreamDepth = 1, downstreamDepth = 1, extra = [] } = {}) {
      const center = s.typeOf.get(id)
      if (!center) return undefined
      const refs = new Map()
      const note = (ref) => {
        if (!ref?.id || refs.has(ref.id)) return
        const row = s.typeOf.get(ref.id)
        // An end that is not stored here keeps the reference the edge carries.
        refs.set(ref.id, row ? refOf(row.type, JSON.parse(row.json)) : strip({ id: ref.id, type: ref.type, name: ref.name, fullyQualifiedName: ref.fullyQualifiedName, displayName: ref.displayName }))
      }
      const walk = (depth, next, far) => {
        const edges = []
        const seen = new Set()
        const visited = new Set([id])
        let frontier = [id]
        for (let d = 0; d < clampDepth(depth) && frontier.length; d++) {
          const after = []
          for (const at of frontier) {
            for (const e of next(at)) {
              const key = `${e.fromId}|${e.toId}`
              if (seen.has(key)) continue
              seen.add(key)
              edges.push(strip({ fromEntity: e.fromId, toEntity: e.toId, lineageDetails: e.edge.lineageDetails, description: e.edge.description }))
              const otherId = far === 'fromEntity' ? e.fromId : e.toId
              note({ ...e.edge[far], id: otherId })
              if (!visited.has(otherId)) {
                visited.add(otherId)
                after.push(otherId)
              }
            }
          }
          frontier = after
        }
        return edges
      }
      const into = extra.length ? (at) => [...store.lineageInto(at), ...extra.filter((e) => e.toId === at)] : store.lineageInto
      const from = extra.length ? (at) => [...store.lineageFrom(at), ...extra.filter((e) => e.fromId === at)] : store.lineageFrom
      const upstreamEdges = walk(upstreamDepth, into, 'fromEntity')
      const downstreamEdges = walk(downstreamDepth, from, 'toEntity')
      refs.delete(id)
      return { entity: refOf(center.type, JSON.parse(center.json)), nodes: [...refs.values()], upstreamEdges, downstreamEdges }
    },

    close: () => db.close(),
  }
  return store
}

// ---------------------------------------------------------------- the app's instance

let instance
let failure
/**
 * The active profile's local database (main process). Opened on first use;
 * throws the same readable error on every call while it cannot be opened.
 */
function localDb() {
  if (instance) return instance
  if (failure) throw failure
  try {
    instance = openDatabase(require('../profiles/index.cjs').appLayout().folder(FOLDER))
    return instance
  } catch (e) {
    failure = e
    throw e
  }
}

/** Whether the active profile's database file exists yet. Opens nothing, creates nothing. */
function localDbExists() {
  if (instance) return true
  try {
    return fs.existsSync(path.join(require('../profiles/index.cjs').appLayout().folder(FOLDER), DB_FILE))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- the BigQuery copy

/**
 * The local copy of a BigQuery metadata dataset (docs/bigquery-metadata.md):
 * the same schema in its own file next to the local database, so the two
 * never mix. It holds only what came from BigQuery and is refilled from there.
 */
const MIRROR_FILE = 'bigquery.sqlite3'
let mirror
let mirrorFailure
function mirrorDb() {
  if (mirror) return mirror
  if (mirrorFailure) throw mirrorFailure
  try {
    mirror = openDatabase(require('../profiles/index.cjs').appLayout().folder(FOLDER), { file: MIRROR_FILE })
    return mirror
  } catch (e) {
    mirrorFailure = e
    throw e
  }
}

/** Whether the BigQuery copy exists yet. Opens nothing, creates nothing. */
function mirrorDbExists() {
  if (mirror) return true
  try {
    return fs.existsSync(path.join(require('../profiles/index.cjs').appLayout().folder(FOLDER), MIRROR_FILE))
  } catch {
    return false
  }
}

module.exports = { openDatabase, localDb, localDbExists, mirrorDb, mirrorDbExists, fqnOf, fqnPart, stableStringify, DB_FILE, MIRROR_FILE, FOLDER, SCHEMA_VERSION, MAX_LINEAGE_DEPTH, SEARCH_MAX }
