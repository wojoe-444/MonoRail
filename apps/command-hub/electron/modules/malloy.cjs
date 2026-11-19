// Malloy backend, for the OpenMetadata page's Semantic models, Query builder
// and Malloy models tabs (src/modules/openmetadata/tabs/). The work is in
// malloy-lib.cjs; this file wires it to the connections.
//
// Opt-in: nothing runs until the user adds the Malloy connection
// (hasConnection only reads the saved list). BigQuery is reached with the
// Google Cloud connection's access token (gcloud auth print-access-token),
// kept in memory 30 minutes, never stored. No start(): nothing runs while the
// page is closed, and nothing is written to the data folder.

const { createMalloy } = require('./malloy-lib.cjs')

function connectionsApi() {
  return require('../connections/index.cjs')
}

const service = createMalloy({
  settings: async () => {
    const api = connectionsApi()
    if (!(await api.hasConnection('malloy'))) return undefined
    return api.getCredentials('malloy')
  },
  credentials: async () => {
    const api = connectionsApi()
    if (!(await api.hasConnection('gcloud'))) return undefined
    return api.getCredentials('gcloud')
  },
})

module.exports = {
  id: 'malloy',
  methods: {
    status: () => service.status(),
    listModels: () => service.listModels(),
    compile: (_ctx, args) => service.compile(args),
    sql: (_ctx, args) => service.sql(args),
    run: (_ctx, args) => service.run(args),
  },
}
