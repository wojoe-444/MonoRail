// Semantic page backend (Insights > Semantic): a dbt project's semantic layer,
// read from its files and queried with the user's own MetricFlow.
//
// Opt-in twice. Nothing runs until the user adds the MetricFlow connection
// (hasConnection only reads the saved list); until then the page says "not
// set up". Browsing reads files only (semantic-mf.cjs). query and explain run
// the user's `mf` only when the connection's "Run queries with MetricFlow" is
// on. There is no start(): nothing runs while the page is closed. Nothing is
// written to the data folder: results go to the page and are not kept, and the
// parsed manifest is held in memory, keyed by its file's time.

const mfLib = require('./semantic-mf.cjs')

function connectionsApi() {
  return require('../connections/index.cjs')
}

/** The connection's settings, or undefined when it is not added. */
async function settings(deps = {}) {
  if (deps.settings) return deps.settings()
  const api = connectionsApi()
  if (!(await api.hasConnection('metricflow'))) return undefined
  return api.getCredentials('metricflow')
}

async function getProject(deps = {}) {
  const s = await settings(deps)
  if (!s) return { block: 'not-set-up', metrics: [], models: [], dimensions: [], savedQueries: [], metricflow: { canRun: false, found: false }, readAt: new Date().toISOString() }
  const { _internal, ...page } = await mfLib.loadProject(s, deps)
  return page
}

/** Everything a query needs, after the checks. */
async function forQuery(deps = {}) {
  const s = await settings(deps)
  if (!s) throw new Error('Set up MetricFlow on the Connections page first.')
  if (s.run !== 'on') throw new Error('Running queries is off. Turn on “Run queries with MetricFlow” in the MetricFlow connection.')
  const loaded = await mfLib.loadProject(s, deps)
  if (loaded.block === 'no-project') throw new Error('The dbt project folder was not found. Pick it again on Connections.')
  if (loaded.block) throw new Error('The project has no readable semantic manifest. Run dbt parse, then reload.')
  return { projectDir: loaded._internal.project.dir, mf: loaded._internal.mf, manifest: loaded }
}

// A query starts Python and talks to the warehouse: a couple at a time is plenty.
const MAX_RUNNING = 2
let running = 0

async function limited(fn) {
  if (running >= MAX_RUNNING) throw new Error('Two MetricFlow queries are already running. Wait for one to finish.')
  running++
  try {
    return await fn()
  } finally {
    running--
  }
}

module.exports = {
  id: 'semantic',
  methods: {
    getProject: () => getProject(),
    query: async (_ctx, req) => limited(async () => mfLib.runQuery({ ...(await forQuery()), req })),
    explain: async (_ctx, req) => limited(async () => mfLib.explainQuery({ ...(await forQuery()), req })),
  },
  _internal: { getProject, forQuery },
}
