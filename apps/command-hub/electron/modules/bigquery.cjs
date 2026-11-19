// Tools > BigQuery (src/modules/bigquery): a BigQuery console in MonoRail.
// Explorer (projects > datasets > tables), SQL editor tabs with dry-run
// estimates, results, job information, execution details and query history.
//
// Optional and opt-in: every method first checks hasConnection('gcloud')
// (reads the saved list only) and runs nothing until the user has added the
// Google Cloud connection. Then it asks that connector for an access token
// from the user's own gcloud login (credentials(): gcloud auth
// print-access-token), keeps it in memory for 30 minutes (a 401 fetches a new
// one) and calls bigquery.googleapis.com only (bigquery-api.cjs). Nothing is
// written to disk: no cache, no results, no history (history is BigQuery's own
// job list). The page keeps its editor tabs in prefs.
//
// Queries run as the user with their own permissions and bill to the chosen
// project, exactly as in the Google Cloud console.

const { createClient } = require('./bigquery-api.cjs')

const TOKEN_TTL_MS = 30 * 60_000

function connectionsApi() {
  return require('../connections/index.cjs')
}

function createService(deps = {}) {
  const has = deps.hasConnection ?? ((kind) => connectionsApi().hasConnection(kind))
  const creds = deps.getCredentials ?? ((kind) => connectionsApi().getCredentials(kind))
  let token // { value, project, at }
  let pending

  async function credentials({ refresh = false } = {}) {
    if (!(await has('gcloud'))) {
      const e = new Error('Set up Google Cloud on the Connections page first.')
      e.code = 'not-set-up'
      throw e
    }
    const now = Date.now()
    if (!refresh && token && now - token.at < TOKEN_TTL_MS) return token
    if (!pending) {
      pending = Promise.resolve(creds('gcloud'))
        .then((c) => (token = { value: c.accessToken, project: c.project, at: Date.now() }))
        .finally(() => (pending = undefined))
    }
    return pending
  }

  const client = createClient({
    getToken: async ({ refresh }) => (await credentials({ refresh })).value,
    fetchImpl: deps.fetch,
  })

  const gated = (fn) => async (_ctx, args) => {
    await credentials()
    return fn(args ?? {})
  }

  return {
    /** Whether the page can work, and the default project. Never throws for "not set up". */
    async status() {
      if (!(await has('gcloud'))) return { state: 'not-set-up' }
      try {
        const c = await credentials()
        return { state: 'ok', defaultProject: c.project }
      } catch (e) {
        return { state: 'error', message: e instanceof Error ? e.message : String(e) }
      }
    },
    methods: {
      listProjects: gated(() => client.listProjects()),
      listDatasets: gated((a) => client.listDatasets(a)),
      getDataset: gated((a) => client.getDataset(a)),
      listTables: gated((a) => client.listTables(a)),
      getTable: gated((a) => client.getTable(a)),
      previewTable: gated((a) => client.previewTable(a)),
      dryRun: gated((a) => client.runQuery({ ...a, dryRun: true })),
      runQuery: gated((a) => client.runQuery({ ...a, dryRun: false })),
      getQueryResults: gated((a) => client.getQueryResults(a)),
      getJob: gated((a) => client.getJob(a)),
      cancelJob: gated((a) => client.cancelJob(a)),
      listJobs: gated((a) => client.listJobs(a)),
    },
  }
}

let service
function svc() {
  return (service ??= createService())
}

module.exports = {
  id: 'bigquery',
  methods: {
    status: () => svc().status(),
    listProjects: (ctx, a) => svc().methods.listProjects(ctx, a),
    listDatasets: (ctx, a) => svc().methods.listDatasets(ctx, a),
    getDataset: (ctx, a) => svc().methods.getDataset(ctx, a),
    listTables: (ctx, a) => svc().methods.listTables(ctx, a),
    getTable: (ctx, a) => svc().methods.getTable(ctx, a),
    previewTable: (ctx, a) => svc().methods.previewTable(ctx, a),
    dryRun: (ctx, a) => svc().methods.dryRun(ctx, a),
    runQuery: (ctx, a) => svc().methods.runQuery(ctx, a),
    getQueryResults: (ctx, a) => svc().methods.getQueryResults(ctx, a),
    getJob: (ctx, a) => svc().methods.getJob(ctx, a),
    cancelJob: (ctx, a) => svc().methods.cancelJob(ctx, a),
    listJobs: (ctx, a) => svc().methods.listJobs(ctx, a),
  },
  _internal: { createService },
}
