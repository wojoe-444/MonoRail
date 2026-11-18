// OpenMetadata page backend: browse every entity type of an OpenMetadata
// 2.0.x server through its REST API, the way OpenMetadata stores them.
//
// Opt-in: nothing runs until the user adds the OpenMetadata connection
// (hasConnection only reads the saved list); until then every method answers
// { block: 'not-set-up' } or refuses. There is no start(): nothing runs while
// the page is closed. Nothing is written to the data folder. Requests go only
// to the server in the connection, with its token; the page never sees it.
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

function createService(deps = {}) {
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

let service
const svc = () => (service ??= createService())

module.exports = {
  id: 'openmetadata',
  methods: {
    status: () => svc().status(),
    counts: (_ctx, args) => svc().counts(args),
    list: (_ctx, args) => svc().list(args),
    get: (_ctx, args) => svc().get(args),
    versions: (_ctx, args) => svc().versions(args),
    recent: (_ctx, args) => svc().recent(args),
    setDescription: (_ctx, args) => svc().setDescription(args),
  },
  TYPES,
  _internal: { createService, createClient, collectionOf },
}
