// OpenMetadata page backend: browse every entity type, the way OpenMetadata
// stores them, from one of three sources (createService at the bottom):
//
//   local    MonoRail's local database (electron/localdb): entities kept on
//            this PC in OpenMetadata's JSON shape. The default until an
//            OpenMetadata server or BigQuery metadata is connected, and
//            always available.
//   bigquery a BigQuery dataset the user made the source of truth
//            (docs/bigquery-metadata.md), read from its copy on this PC
//            (localdb mirrorDb(), openmetadata-bigquery.cjs). Read-only. The
//            default whenever it is set up.
//   server   an OpenMetadata 2.0 or 2.1 server through its REST API.
//
// Opt-in for the server: no request is made until the user adds the
// OpenMetadata connection (hasConnection only reads the saved list); asking
// for the server before that answers { block: 'not-set-up' } or refuses.
// start() only runs the BigQuery copy's schedule, and only once that
// connection is set up; nothing else runs while the page is closed. Requests go
// only to the server in the connection, with its token; the page never sees it.
//
// Lineage (getLineage) has one shape for every source, OpenMetadata's
// EntityLineage: { entity, nodes, upstreamEdges, downstreamEdges }. The server
// answers GET /api/v1/lineage/{entityType}/{id}; the local database and the
// BigQuery copy read their lineage table (electron/localdb).
//
// The page names an entity type (from TYPES below), never a URL or path: the
// backend builds every request itself. Reads only, except one write: a new
// description (PATCH /<collection>/<id> with one JSON Patch op on
// /description), which OpenMetadata records as a new version.

const connector = require('../connections/connectors/openmetadata.cjs')

/**
 * Every OpenMetadata 2.1 entity type that has a REST collection, and that
 * collection under /api/v1. They are the MonoRail standard's OpenMetadata
 * types (src/standard/standard.json, `basePath` without /v1/): a test checks
 * this list names every one with the same path, and the page's
 * src/modules/openmetadata/catalog.ts lists the same types. A server older
 * than a type answers 404 for it, and the page shows the type greyed out.
 */
const TYPES = Object.freeze({
  // Data assets
  table: 'tables',
  database: 'databases',
  databaseSchema: 'databaseSchemas',
  storedProcedure: 'storedProcedures',
  query: 'queries',
  metric: 'metrics',
  dashboard: 'dashboards',
  chart: 'charts',
  dashboardDataModel: 'dashboard/datamodels',
  pipeline: 'pipelines',
  topic: 'topics',
  mlmodel: 'mlmodels',
  container: 'containers',
  searchIndex: 'searchIndexes',
  apiCollection: 'apiCollections',
  apiEndpoint: 'apiEndpoints',
  directory: 'drives/directories',
  file: 'drives/files',
  spreadsheet: 'drives/spreadsheets',
  worksheet: 'drives/worksheets',
  report: 'reports',
  metricGroup: 'metricGroups',
  // AI assets
  llmModel: 'llmModels',
  aiApplication: 'aiApplications',
  mcpServer: 'mcpServers',
  promptTemplate: 'promptTemplates',
  aiGovernanceFramework: 'aiGovernanceFrameworks',
  aiFrameworkControl: 'aiFrameworkControls',
  aiGovernancePolicy: 'aiGovernancePolicies',
  auditReport: 'auditReports',
  // Services
  databaseService: 'services/databaseServices',
  dashboardService: 'services/dashboardServices',
  messagingService: 'services/messagingServices',
  pipelineService: 'services/pipelineServices',
  mlmodelService: 'services/mlmodelServices',
  storageService: 'services/storageServices',
  searchService: 'services/searchServices',
  apiService: 'services/apiServices',
  metadataService: 'services/metadataServices',
  securityService: 'services/securityServices',
  driveService: 'services/driveServices',
  llmService: 'services/llmServices',
  mcpService: 'services/mcpServices',
  ingestionPipeline: 'services/ingestionPipelines',
  // Governance
  glossary: 'glossaries',
  glossaryTerm: 'glossaryTerms',
  classification: 'classifications',
  tag: 'tags',
  domain: 'domains',
  dataProduct: 'dataProducts',
  dataContract: 'dataContracts',
  workflowDefinition: 'governance/workflowDefinitions',
  intakeForm: 'governance/intakeForms',
  // Ontology
  ontology: 'ontologies',
  ontologyConcept: 'ontologyConcepts',
  ontologyProperty: 'ontologyProperties',
  ontologyAxiom: 'ontologyAxioms',
  ontologyChangeSet: 'ontologyChangeSets',
  ontologyRelease: 'ontologyReleases',
  relationshipType: 'relationshipTypes',
  // Data quality
  testDefinition: 'dataQuality/testDefinitions',
  testSuite: 'dataQuality/testSuites',
  testCase: 'dataQuality/testCases',
  dataQualityDimension: 'dataQuality/dimensions',
  // Teams and access
  user: 'users',
  team: 'teams',
  role: 'roles',
  policy: 'policies',
  persona: 'personas',
  bot: 'bots',
  // Collaboration and context
  task: 'tasks',
  taskFormSchema: 'taskFormSchemas',
  announcement: 'announcements',
  page: 'contextCenter/pages',
  learningResource: 'learning/resources',
  folder: 'contextCenter/drive/folders',
  contextFile: 'contextCenter/drive/files',
  contextMemory: 'contextCenter/memories',
  // Platform
  eventsubscription: 'events/subscriptions',
  app: 'apps',
  kpi: 'kpi',
  type: 'metadata/types',
  workflow: 'automations/workflows',
  appMarketPlaceDefinition: 'apps/marketplace',
  notificationTemplate: 'notificationTemplates',
  testConnectionDefinition: 'services/testConnectionDefinitions',
  document: 'docStore',
  dataInsightChart: 'analytics/dataInsights/charts',
  dataInsightCustomChart: 'analytics/dataInsights/system/charts',
  webAnalyticEvent: 'analytics/web/events',
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMEOUT_MS = 30_000
/** Concurrent requests for counts: enough to fill the page quickly, few enough not to load the server. */
const COUNT_CONCURRENCY = 6
/** The widest field lists first; OpenMetadata answers 400 for a field a collection lacks. */
const LIST_FIELDS = ['owners,tags', 'owners']

function collectionOf(type) {
  const c = typeof type === 'string' && Object.hasOwn(TYPES, type) ? TYPES[type] : undefined
  if (!c) throw new Error(`OpenMetadata has no entity type "${type}" here.`)
  return c
}

function checkId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give an entity id.')
  return id
}

/**
 * A lineage depth from the page: a whole number of levels (1 by default), or
 * 'all' (Infinity) to follow the graph to its ends.
 */
const lineageDepth = (v) => {
  if (v === 'all' || v === Infinity) return Infinity
  const n = v === undefined || v === null ? 1 : Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(0, n) : 1
}

/** OpenMetadata's lineage API takes 0 to 3 levels each way (@Max(3) on upstreamDepth/downstreamDepth). */
const SERVER_LINEAGE_STEP = 3
/** A deeper server read walks on from the assets at the edge, one request each; it stops here and says so. */
const SERVER_LINEAGE_MAX_REQUESTS = 120
const SERVER_LINEAGE_MAX_ASSETS = 10_000

/**
 * Lineage from the server past its 3-level limit: the first request reads up
 * to 3 levels each way, then every asset exactly at the edge of what is known
 * is asked for its next 3 levels on that side, until the depth is reached, the
 * graph ends, or the request/asset limits stop it (`truncated: true`).
 * `fetchOne(type, id, up, down)` returns one normalized reply.
 */
async function deepLineage(fetchOne, { type, id, upstreamDepth, downstreamDepth }) {
  const first = await fetchOne(type, id, Math.min(SERVER_LINEAGE_STEP, upstreamDepth), Math.min(SERVER_LINEAGE_STEP, downstreamDepth))
  if (upstreamDepth <= SERVER_LINEAGE_STEP && downstreamDepth <= SERVER_LINEAGE_STEP) return first
  const nodes = new Map(first.nodes.map((n) => [n.id, n]))
  const sides = {
    up: new Map(first.upstreamEdges.map((e) => [`${e.fromEntity}>${e.toEntity}`, e])),
    down: new Map(first.downstreamEdges.map((e) => [`${e.fromEntity}>${e.toEntity}`, e])),
  }
  let requests = 1
  let truncated = false
  for (const side of ['up', 'down']) {
    const depth = side === 'up' ? upstreamDepth : downstreamDepth
    const edges = sides[side]
    const asked = new Set([first.entity.id])
    let reached = Math.min(SERVER_LINEAGE_STEP, depth)
    while (reached < depth) {
      // Steps from the asset along this side's edges, over everything known so far.
      const dist = new Map([[first.entity.id, 0]])
      let frontier = [first.entity.id]
      const next = new Map()
      for (const e of edges.values()) {
        const [at, far] = side === 'up' ? [e.toEntity, e.fromEntity] : [e.fromEntity, e.toEntity]
        next.set(at, [...(next.get(at) ?? []), far])
      }
      for (let d = 1; frontier.length; d++) {
        const after = []
        for (const at of frontier) for (const far of next.get(at) ?? []) if (!dist.has(far)) { dist.set(far, d); after.push(far) }
        frontier = after
      }
      const edge = [...dist].filter(([nid, d]) => d === reached && !asked.has(nid)).map(([nid]) => nid)
      if (!edge.length) break
      const step = Math.min(SERVER_LINEAGE_STEP, depth - reached)
      for (let i = 0; i < edge.length; i += 4) {
        if (requests >= SERVER_LINEAGE_MAX_REQUESTS || nodes.size >= SERVER_LINEAGE_MAX_ASSETS) {
          truncated = true
          break
        }
        const batch = edge.slice(i, i + Math.min(4, SERVER_LINEAGE_MAX_REQUESTS - requests))
        requests += batch.length
        const replies = await Promise.all(batch.map((nid) => {
          asked.add(nid)
          const ref = nodes.get(nid)
          if (!ref?.type || !Object.hasOwn(TYPES, ref.type)) return null
          return fetchOne(ref.type, nid, side === 'up' ? step : 0, side === 'down' ? step : 0).catch(() => null)
        }))
        for (const r of replies) {
          if (!r) continue
          for (const n of r.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n)
          if (!nodes.has(r.entity.id) && r.entity.id !== first.entity.id) nodes.set(r.entity.id, r.entity)
          for (const e of side === 'up' ? r.upstreamEdges : r.downstreamEdges) edges.set(`${e.fromEntity}>${e.toEntity}`, e)
        }
      }
      if (truncated) break
      reached += step
    }
  }
  nodes.delete(first.entity.id)
  const out = { entity: first.entity, nodes: [...nodes.values()], upstreamEdges: [...sides.up.values()], downstreamEdges: [...sides.down.values()] }
  return truncated ? { ...out, truncated } : out
}

const isRefLike = (r) => r && typeof r === 'object' && typeof r.id === 'string' && typeof r.type === 'string'
const refFields = (r) => Object.fromEntries(['id', 'type', 'name', 'fullyQualifiedName', 'displayName', 'description', 'deleted'].filter((k) => r[k] !== undefined).map((k) => [k, r[k]]))

/**
 * An EntityLineage as the page reads it, from whatever the source answered.
 * Edges carry ids (OpenMetadata 2.x answers UUIDs; an EntityReference is
 * accepted too), nodes are EntityReferences without the entity itself.
 */
function normalizeLineage(res, { type, id }) {
  const idOf = (v) => (typeof v === 'string' ? v : typeof v?.id === 'string' ? v.id : undefined)
  const edges = (list) =>
    (Array.isArray(list) ? list : [])
      .map((e) => {
        const out = { fromEntity: idOf(e?.fromEntity), toEntity: idOf(e?.toEntity) }
        if (e?.lineageDetails && typeof e.lineageDetails === 'object') out.lineageDetails = e.lineageDetails
        if (typeof e?.description === 'string') out.description = e.description
        return out
      })
      .filter((e) => e.fromEntity && e.toEntity)
  const entity = isRefLike(res?.entity) ? refFields(res.entity) : { id, type }
  const nodes = (Array.isArray(res?.nodes) ? res.nodes : []).filter((n) => isRefLike(n) && n.id !== entity.id).map(refFields)
  return { entity, nodes, upstreamEdges: edges(res?.upstreamEdges), downstreamEdges: edges(res?.downstreamEdges) }
}

/** The most matches one search returns; the page says how many more there are. */
const SEARCH_LIMIT = 500

/** What a search result carries: enough for a row (name, owners, tags, service), not columns or definitions. */
const SEARCH_FIELDS = ['id', 'name', 'displayName', 'fullyQualifiedName', 'description', 'owners', 'tags', 'domains', 'service', 'serviceType', 'tableType', 'updatedAt', 'updatedBy', 'deleted', 'entityType']
const searchRow = (e) => Object.fromEntries(SEARCH_FIELDS.filter((k) => e[k] !== undefined).map((k) => [k, k === 'description' && typeof e[k] === 'string' ? e[k].slice(0, 500) : e[k]]))

/** A search's arguments, checked: text (at most 200 characters), known types, a limit. */
function searchArgs({ q, types, limit, deleted } = {}) {
  if (q !== undefined && q !== null && (typeof q !== 'string' || q.length > 200)) throw new Error('Give a search of at most 200 characters.')
  const wanted = types === undefined || types === null ? Object.keys(TYPES) : Array.isArray(types) ? types.filter((t) => typeof t === 'string' && Object.hasOwn(TYPES, t)) : []
  if (!wanted.length) throw new Error('Give at least one entity type to search.')
  return { q: (q ?? '').trim(), types: wanted, limit: Math.max(1, Math.min(SEARCH_LIMIT, Number(limit) || 50)), deleted: deleted === true }
}

/** Elasticsearch query_string text for OpenMetadata's search: every word, anywhere in a field. */
function serverQuery(q) {
  const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, (c) => `\\${c}`))
  return words.length ? words.map((w) => '*' + w + '*').join(' AND ') : '*'
}

function text(v, name, max = 2000) {
  if (typeof v !== 'string' || !v || v.length > max) throw new Error(`Give a ${name}.`)
  return v
}

function query(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

class OmError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * A client for the connection's server. deps.credentials and deps.fetch are
 * for tests; by default they come from Connections and the global fetch.
 */
function createClient(deps = {}) {
  const fetchImpl = deps.fetch ?? fetch
  let login
  // Field lists a collection refused (400), so they are not asked for again.
  const refused = new Set()

  async function creds() {
    if (deps.credentials) return deps.credentials()
    return require('../connections/index.cjs').getCredentials('openmetadata')
  }

  function loginFor(c) {
    if (login?.url === c.url && login.email === c.email && login.password === c.password) return login
    const entry = { url: c.url, email: c.email, password: c.password, token: connector.accessToken(c, fetchImpl) }
    login = entry
    return entry
  }

  async function request(method, apiPath, { body, contentType, retried = false } = {}) {
    const c = await creds()
    const entry = c.auth === 'login' ? loginFor(c) : undefined
    if (!entry) login = undefined
    let token
    try {
      token = await (entry?.token ?? connector.accessToken(c, fetchImpl))
    } catch (e) {
      if (login === entry) login = undefined
      throw e
    }
    let res
    try {
      res = await fetchImpl(`${c.url}/api/v1${apiPath}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': contentType ?? 'application/json' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      throw new OmError(0, `Could not reach ${c.url}: ${e.cause?.code ?? e.message}`)
    }
    // A login's token runs out: sign in again once.
    if (res.status === 401 && entry && !retried) {
      if (login === entry) login = undefined
      return request(method, apiPath, { body, contentType, retried: true })
    }
    const raw = await res.text()
    let json
    try {
      json = raw ? JSON.parse(raw) : undefined
    } catch {
      json = undefined
    }
    if (!res.ok) {
      const msg = json && typeof json.message === 'string' ? json.message : `${res.status} ${res.statusText}`
      if (res.status === 401) throw new OmError(401, 'OpenMetadata rejected the token. Update it on the Connections page.')
      throw new OmError(res.status, `OpenMetadata: ${msg}`)
    }
    return json
  }

  /** Try each field list in turn, then none. */
  async function withFields(key, options, call) {
    for (const fields of options) {
      if (refused.has(`${key}|${fields}`)) continue
      try {
        return await call(fields)
      } catch (e) {
        if (e.status !== 400) throw e
        refused.add(`${key}|${fields}`)
      }
    }
    return call(undefined)
  }

  return {
    get: (apiPath) => request('GET', apiPath),
    /** Used by the Services page's server pipelines (electron/modules/ingestion.cjs). */
    post: (apiPath, body) => request('POST', apiPath, { body }),
    patch: (apiPath, ops) => request('PATCH', apiPath, { body: ops, contentType: 'application/json-patch+json' }),
    withFields,
  }
}

async function isSetUp(deps) {
  if (deps.isSetUp) return deps.isSetUp()
  return require('../connections/index.cjs').hasConnection('openmetadata')
}

const NOT_SET_UP = { block: 'not-set-up' }

function createServerService(deps = {}) {
  let client
  const om = () => (client ??= createClient(deps))

  async function guard() {
    if (!(await isSetUp(deps))) throw new Error('Set up OpenMetadata on the Connections page first.')
    return om()
  }

  return {
    /** The server, its version and who MonoRail signs in as. Runs nothing until set up. */
    async status() {
      if (!(await isSetUp(deps))) return NOT_SET_UP
      const c = om()
      const creds = deps.credentials ? await deps.credentials() : await require('../connections/index.cjs').getCredentials('openmetadata')
      try {
        const [version, me] = await Promise.all([c.get('/system/version'), c.get('/users/loggedInUser')])
        return { url: creds.url, version: version?.version, user: me?.displayName || me?.name }
      } catch (e) {
        return { url: creds.url, error: e.message, block: e.status === 401 ? 'rejected' : 'unreachable' }
      }
    },

    /** How many entities of each type, from a one-row list's paging.total. A type the server lacks gets { error }. */
    async counts({ types } = {}) {
      const c = await guard()
      const wanted = Array.isArray(types) ? types.filter((t) => Object.hasOwn(TYPES, t)) : Object.keys(TYPES)
      const out = {}
      let next = 0
      async function worker() {
        while (next < wanted.length) {
          const type = wanted[next++]
          try {
            const res = await c.get(`/${TYPES[type]}${query({ limit: 1 })}`)
            out[type] = res?.paging?.total ?? res?.data?.length ?? 0
          } catch (e) {
            out[type] = { error: e.message }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(COUNT_CONCURRENCY, wanted.length) }, worker))
      return out
    },

    /** One page of a type's entities, with owners and tags where the type has them. */
    async list({ type, after, deleted = false, limit = 50 } = {}) {
      const c = await guard()
      const path = collectionOf(type)
      const n = Math.max(1, Math.min(100, Number(limit) || 50))
      const cursor = after === undefined || after === null || after === '' ? undefined : text(after, 'page cursor', 500)
      return c.withFields(path, LIST_FIELDS, (fields) =>
        c.get(`/${path}${query({ limit: n, after: cursor, fields, include: deleted ? 'all' : undefined })}`),
      )
    },

    /** One entity by fully qualified name, with every field its type has. */
    async get({ type, fqn } = {}) {
      const c = await guard()
      const path = collectionOf(type)
      const name = text(fqn, 'name')
      return c.withFields(path, ['*'], (fields) => c.get(`/${path}/name/${encodeURIComponent(name)}${query({ fields })}`))
    },

    /** Every version of an entity, newest first, as OpenMetadata keeps them. */
    async versions({ type, id } = {}) {
      const c = await guard()
      const path = collectionOf(type)
      if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give an entity id.')
      const res = await c.get(`/${path}/${id}/versions`)
      const list = Array.isArray(res?.versions) ? res.versions : []
      return list.map((v) => (typeof v === 'string' ? JSON.parse(v) : v))
    },

    /** The latest changes across every searchable type (OpenMetadata's `all` search index). */
    async recent({ size = 30 } = {}) {
      const c = await guard()
      const n = Math.max(1, Math.min(50, Number(size) || 30))
      const res = await c.get(
        `/search/query${query({ q: '*', index: 'all', from: 0, size: n, sort_field: 'updatedAt', sort_order: 'desc', deleted: false })}`,
      )
      return (res?.hits?.hits ?? []).map((h) => h._source).filter((s) => s && Object.hasOwn(TYPES, s.entityType))
    },

    /**
     * Search the whole catalog (OpenMetadata's `all` search index), not a
     * loaded page. Returns { data: [{ ...entity, entityType }], total }.
     */
    async search(args = {}) {
      const c = await guard()
      const { q, types, limit, deleted } = searchArgs(args)
      const filter = JSON.stringify({ query: { bool: { filter: [{ terms: { entityType: types } }] } } })
      const ask = (withFilter) =>
        c.get(`/search/query${query({ q: serverQuery(q), index: 'all', from: 0, size: limit, deleted, query_filter: withFilter ? filter : undefined })}`)
      let res
      try {
        res = await ask(true)
      } catch (e) {
        if (e.status !== 400) throw e
        res = await ask(false)
      }
      const hits = (res?.hits?.hits ?? []).map((h) => h._source).filter((s) => s && types.includes(s.entityType))
      const t = res?.hits?.total
      const total = typeof t === 'number' ? t : typeof t?.value === 'number' ? t.value : hits.length
      return { data: hits.map(searchRow), total: Math.max(total, hits.length) }
    },

    /**
     * Upstream and downstream assets: GET /lineage/{entityType}/{id}?upstreamDepth=&downstreamDepth=.
     * The server answers 0 to 3 levels each; deeper (or 'all') walks on from the edge (deepLineage).
     */
    async getLineage({ type, id, upstreamDepth, downstreamDepth } = {}) {
      const c = await guard()
      collectionOf(type)
      checkId(id)
      const fetchOne = async (t, i, up, down) =>
        normalizeLineage(await c.get(`/lineage/${encodeURIComponent(t)}/${i}${query({ upstreamDepth: up, downstreamDepth: down })}`), { type: t, id: i })
      return deepLineage(fetchOne, { type, id, upstreamDepth: lineageDepth(upstreamDepth), downstreamDepth: lineageDepth(downstreamDepth) })
    },

    /** Set an entity's description. The one write: OpenMetadata keeps the old text as a version. */
    async setDescription({ type, id, description } = {}) {
      const c = await guard()
      const path = collectionOf(type)
      if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give an entity id.')
      if (typeof description !== 'string' || description.length > 100_000) throw new Error('Give the new description.')
      return c.patch(`/${path}/${id}`, [{ op: 'add', path: '/description', value: description }])
    },
  }
}

/**
 * The same methods over MonoRail's local database (electron/localdb), which
 * keeps entities in OpenMetadata's JSON shape. deps.local is for tests.
 */
function createLocalService(deps = {}, { readOnly, describe, lineageNote, legacyLineage } = {}) {
  const db = () => (deps.local ? deps.local() : require('../localdb/index.cjs').localDb())
  const withProfile = (type, e) => {
    if (!e || type !== 'table') return e
    const [profile] = db().records('tableProfile', e.id, 1)
    return profile ? { ...e, profile } : e
  }
  return {
    async status() {
      try {
        db()
        if (describe) return await describe()
        return { source: 'local', url: 'MonoRail local database (this PC)', version: undefined, user: undefined }
      } catch (e) {
        return { source: describe ? 'bigquery' : 'local', block: 'local-error', error: e.message }
      }
    },
    async counts({ types } = {}) {
      const c = db().counts()
      const wanted = Array.isArray(types) ? types.filter((t) => Object.hasOwn(TYPES, t)) : Object.keys(TYPES)
      return Object.fromEntries(wanted.map((t) => [t, c[t] ?? 0]))
    },
    async list({ type, after, deleted = false, limit = 50 } = {}) {
      collectionOf(type)
      const cursor = after === undefined || after === null || after === '' ? undefined : text(after, 'page cursor', 2000)
      return db().list(type, { after: cursor, deleted, limit })
    },
    async get({ type, fqn } = {}) {
      collectionOf(type)
      const name = text(fqn, 'name')
      const e = db().get(type, name)
      if (!e) throw new Error(`There is no ${type} named ${name} in the local database.`)
      return withProfile(type, e)
    },
    async versions({ type, id } = {}) {
      collectionOf(type)
      if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give an entity id.')
      return db().versions(id)
    },
    async recent({ size = 30 } = {}) {
      return db().recent(Math.max(1, Math.min(50, Number(size) || 30))).filter((e) => Object.hasOwn(TYPES, e.entityType))
    },
    /** Search the whole database (localdb search), not a loaded page. */
    async search(args = {}) {
      const { q, types, limit, deleted } = searchArgs(args)
      // A search (the command palette's too) never creates the local database.
      if (!deps.local && !require('../localdb/index.cjs').localDbExists()) return { data: [], total: 0 }
      const res = db().search({ q, types, limit, deleted })
      return { data: res.data.map(searchRow), total: res.total }
    },
    /** The lineage table's edges around an entity, in the server's EntityLineage shape. */
    async getLineage({ type, id, upstreamDepth, downstreamDepth } = {}) {
      collectionOf(type)
      checkId(id)
      const store = db()
      const res = store.lineageOf(id, { upstreamDepth: lineageDepth(upstreamDepth), downstreamDepth: lineageDepth(downstreamDepth), extra: legacyLineage ? legacyLineage(store) : [] })
      if (!res) throw new Error('That entity is not in the local database.')
      const out = normalizeLineage(res, { type, id })
      const note = lineageNote ? lineageNote(store) : undefined
      return note ? { ...out, ...note } : out
    },
    async setDescription({ type, id, description } = {}) {
      if (readOnly) throw new Error(readOnly)
      collectionOf(type)
      if (typeof id !== 'string' || !UUID_RE.test(id)) throw new Error('Give an entity id.')
      if (typeof description !== 'string' || description.length > 100_000) throw new Error('Give the new description.')
      const store = db()
      const e = store.byId(id)
      if (!e || store.get(type, e.fullyQualifiedName)?.id !== id) throw new Error('That entity is not in the local database.')
      return store.put(type, { ...e, description })
    },
  }
}

/**
 * The page's backend: the local database, the BigQuery copy or the
 * OpenMetadata server, per call. `source: 'local' | 'bigquery' | 'server'`
 * picks one. Without it, or when BigQuery is asked for but no longer set up,
 * BigQuery is used while it is set up (it is the source of truth), then the
 * server once its connection is set up, then the local database.
 */
function createService(deps = {}) {
  const server = createServerService(deps)
  // Lineage older ingestion runs kept in a service field is read too, until the next run moves it to the lineage table.
  const local = createLocalService(deps, { legacyLineage: (store) => require('./ingestion-store.cjs').legacyLineage(store) })
  const bq = deps.bigquery ?? require('./openmetadata-bigquery.cjs').createBigQuerySource(deps.bigqueryDeps)
  const copy = createLocalService(
    { local: () => bq.store() },
    {
      // A dataset in layout /1 (or /2 without the optional table) has no lineage table.
      lineageNote: (store) => {
        const flag = store.getMeta('bq.lineage')
        const layout = store.getMeta('bq.layout')
        return flag === 'no' || (flag === undefined && layout === 'monorail.metadata/1') ? { missing: 'no-lineage-table', layout } : undefined
      },
      readOnly: 'BigQuery is the source of truth here, and MonoRail does not write to it yet. Change the description in BigQuery; the next sync brings it here.',
      describe: async () => {
        const s = await bq.status()
        return { source: 'bigquery', url: s.source ? `BigQuery ${s.source}` : 'BigQuery', version: undefined, user: undefined, bigquery: s }
      },
    },
  )
  async function pick(args) {
    const [setUp, bqSetUp] = await Promise.all([isSetUp(deps), bq.isSetUp()])
    const fallback = bqSetUp ? copy : setUp ? server : local
    if (args?.source === 'server') return { impl: setUp ? server : undefined, setUp, bqSetUp }
    if (args?.source === 'bigquery') return { impl: bqSetUp ? copy : fallback, setUp, bqSetUp }
    if (args?.source === 'local') return { impl: local, setUp, bqSetUp }
    return { impl: fallback, setUp, bqSetUp }
  }
  const nameOf = (impl) => (impl === local ? 'local' : impl === copy ? 'bigquery' : 'server')
  const route = (method) => async (args = {}) => {
    const { impl } = await pick(args)
    if (!impl) throw new Error('Set up OpenMetadata on the Connections page first.')
    return impl[method](args)
  }
  return {
    async status(args = {}) {
      const { impl, setUp, bqSetUp } = await pick(args)
      if (!impl) return { ...NOT_SET_UP, source: 'server', serverSetUp: false, bigquerySetUp: bqSetUp }
      const s = await impl.status(args)
      return { source: nameOf(impl), ...s, serverSetUp: setUp, bigquerySetUp: bqSetUp }
    },
    counts: route('counts'),
    list: route('list'),
    get: route('get'),
    versions: route('versions'),
    recent: route('recent'),
    search: route('search'),
    getLineage: route('getLineage'),
    setDescription: route('setDescription'),
    /** Sync the BigQuery copy now (`full`: download everything again, free in BigQuery). */
    syncBigQuery: (args = {}) => bq.sync({ full: args.full === true }),
    /** SQL that creates the layout in the connection's dataset; text for the user to run. */
    bigquerySetupSql: () => bq.setupSql(),
    /** For Explore: the BigQuery copy's entities, when BigQuery metadata is set up and synced. */
    explore: () => bq.exploreEntities(),
    bigquery: bq,
  }
}

let service
const svc = () => (service ??= createService())

module.exports = {
  id: 'openmetadata',
  methods: {
    status: (_ctx, args) => svc().status(args),
    counts: (_ctx, args) => svc().counts(args),
    list: (_ctx, args) => svc().list(args),
    get: (_ctx, args) => svc().get(args),
    versions: (_ctx, args) => svc().versions(args),
    recent: (_ctx, args) => svc().recent(args),
    search: (_ctx, args) => svc().search(args),
    getLineage: (_ctx, args) => svc().getLineage(args),
    setDescription: (_ctx, args) => svc().setDescription(args),
    syncBigQuery: (_ctx, args) => svc().syncBigQuery(args),
    bigquerySetupSql: () => svc().bigquerySetupSql(),
    explore: () => svc().explore(),
  },
  /** The BigQuery copy (one per app), for the Services page. */
  bigquerySource: () => svc().bigquery,
  /** Only the BigQuery copy's schedule; it does nothing until that connection is set up. */
  start() {
    const bq = svc().bigquery
    require('../scheduled/in-app.cjs').registerProvider({
      id: 'openmetadata',
      list: () => bq.inAppRows(),
      run: () => bq.sync().then(() => undefined),
    })
    const { TICK_MS } = require('./openmetadata-bigquery.cjs')
    setTimeout(() => void bq.tick(), 30_000).unref?.()
    setInterval(() => void bq.tick(), TICK_MS).unref?.()
  },
  TYPES,
  _internal: { searchArgs, serverQuery, createService, createServerService, createLocalService, createClient, collectionOf, normalizeLineage },
}
