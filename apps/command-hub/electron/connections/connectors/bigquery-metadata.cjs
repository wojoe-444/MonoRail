// BigQuery metadata: a subconnector of Google Cloud (`parent: 'gcloud'`).
//
// Makes a BigQuery dataset that holds MonoRail's metadata layout the source
// of truth for the OpenMetadata page (docs/bigquery-metadata.md). MonoRail
// only connects and reads: something else keeps the dataset up to date.
// While this connection is set up, MonoRail keeps a copy of the dataset on
// this PC (localdb/bigquery-mirror.cjs, run by modules/openmetadata-bigquery.cjs)
// and the page reads that copy.
//
// The check reads metadata only (the dataset, its table list and schemas,
// and the small meta table through tabledata.list): no query, nothing
// billed. It signs in with the user's own gcloud login, so Google Cloud must
// be set up first. Removing the connection empties the copy on this PC; the
// BigQuery dataset is never touched.

const mirror = require('../../localdb/bigquery-mirror.cjs')

const KIND = 'bigquery-metadata'

function validate({ values }) {
  mirror.configOf(values)
}

const EVERY_TEXT = { '15m': 'every 15 minutes', '1h': 'every hour', '6h': 'every 6 hours', '24h': 'once a day', manual: 'only when you press Sync now' }

async function status(conn, deps = {}) {
  let config
  try {
    config = mirror.configOf(conn?.values)
  } catch (e) {
    return { state: 'needs-setup', summary: e.message, details: [] }
  }
  const has = deps.hasConnection ?? ((k) => require('../index.cjs').hasConnection(k))
  if (!(await has('gcloud'))) {
    return {
      state: 'needs-setup',
      summary: 'Set up Google Cloud first: MonoRail reads BigQuery with your own gcloud login.',
      hint: 'Add the Google Cloud connection above, then check this one again.',
      details: [{ label: 'Dataset', value: config.source }],
    }
  }
  const details = [{ label: 'Dataset', value: config.source }]
  let check
  try {
    const client = deps.bigqueryClient ?? mirror.gcloudClient({ hasConnection: has, getCredentials: deps.getCredentials })
    check = await mirror.inspectDataset(client, config)
  } catch (e) {
    if (e.status === 401 || e.code === 'no-gcloud') return { state: 'expired', summary: e.message, hint: 'Use Sign in again on the Google Cloud connection.', details }
    return { state: 'error', summary: `Could not read ${config.source}: ${e.message}`, details }
  }
  if (check.location) details.push({ label: 'Location', value: check.location })
  if (check.state !== 'ok') {
    details.push({ label: 'Layout', value: check.message, ok: false })
    return {
      state: check.state === 'empty' || check.state === 'missing' ? 'needs-setup' : 'error',
      summary: check.message,
      hint: check.state === 'denied' ? 'Ask for BigQuery Data Viewer on the dataset.' : 'The OpenMetadata page shows the setup SQL (BigQuery > Setup SQL).',
      details,
    }
  }
  const e = check.tables.entity
  details.push({ label: 'Layout', value: check.layout, ok: true })
  details.push({ label: 'Entities', value: `${e.rows.toLocaleString('en-US')} rows` })
  details.push({ label: 'Partitioned on updated_at', value: e.partitioned ? 'Yes' : 'No: each sync reads the whole table', ok: e.partitioned || undefined })
  for (const t of ['entity_version', 'record']) details.push({ label: `Table ${t}`, value: check.tables[t] ? `${check.tables[t].rows.toLocaleString('en-US')} rows` : 'Not there (optional)' })
  details.push({ label: 'Copy on this PC', value: `Refreshed ${EVERY_TEXT[config.syncEvery]}` })
  if (config.billingProject !== config.projectId) details.push({ label: 'Sync queries billed to', value: config.billingProject })
  return { state: 'ok', summary: `${config.source} holds MonoRail's metadata (${e.rows.toLocaleString('en-US')} entities). It is the source of truth.`, details }
}

module.exports = {
  kind: KIND,
  parent: 'gcloud',
  // A data source on the Services page, whose ingestion is the connection
  // itself (ingestion.cjs LOCAL_SERVICES, ingestion: 'connect'). A metadata
  // store, so a metadataService. `BigQuery` is a metadataServiceType value
  // MonoRail adds to OpenMetadata's list (standard.json `enums`, rule 5 in
  // docs/standard/README.md); an OpenMetadata server does not know it.
  service: { category: 'metadataService', serviceType: 'BigQuery' },
  title: 'BigQuery metadata',
  icon: 'database',
  description: "Make a BigQuery dataset the source of truth for MonoRail's metadata. MonoRail reads it and keeps a copy on this PC; it never writes to it.",
  fields: [
    { key: 'project', label: 'Project', type: 'text', placeholder: 'my-project', help: 'The Google Cloud project that holds the dataset.' },
    { key: 'dataset', label: 'Dataset', type: 'text', defaultValue: mirror.DEFAULT_DATASET, placeholder: mirror.DEFAULT_DATASET, help: "The dataset with MonoRail's tables (entity, meta, and optionally entity_version and record). Names are case-sensitive." },
    { key: 'billingProject', label: 'Bill sync queries to', type: 'text', placeholder: 'Same project', help: 'Optional: a project where you may run queries, when the data project does not let you.' },
    {
      key: 'syncEvery',
      label: 'Refresh the copy',
      type: 'select',
      defaultValue: '1h',
      options: [
        { value: '15m', label: 'Every 15 minutes' },
        { value: '1h', label: 'Every hour' },
        { value: '6h', label: 'Every 6 hours' },
        { value: '24h', label: 'Once a day' },
        { value: 'manual', label: 'Only when I press Sync now' },
      ],
      help: 'Only while MonoRail is open. Each refresh reads only what changed since the last one.',
    },
    {
      key: 'maxScanGb',
      label: 'Most a refresh may scan',
      type: 'select',
      defaultValue: '1',
      options: mirror.MAX_SCAN_GB.map((gb) => ({ value: gb, label: `${gb} GB` })),
      help: 'A refresh that would scan more in BigQuery does not run. A full refresh is free in BigQuery and has no limit.',
    },
  ],
  actions: [],
  validate,
  status,
  /** For other backends in the main process: the dataset and sync settings. No secrets here. */
  credentials: (conn) => mirror.configOf(conn?.values),
  /** Empty the copy on this PC. The BigQuery dataset is never touched. */
  afterRemove() {
    const localdb = require('../../localdb/index.cjs')
    if (localdb.mirrorDbExists()) localdb.mirrorDb().clearAll()
  },
}
