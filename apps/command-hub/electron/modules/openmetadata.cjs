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
function createLocalService(deps = {}, { readOnly, describe } = {}) {
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
  const local = createLocalService(deps)
  const bq = deps.bigquery ?? require('./openmetadata-bigquery.cjs').createBigQuerySource(deps.bigqueryDeps)
  const copy = createLocalService(
    { local: () => bq.store() },
    {
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
  _internal: { createService, createServerService, createLocalService, createClient, collectionOf },
}
