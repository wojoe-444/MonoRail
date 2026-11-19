// Malloy: a subconnector of Google Cloud (`parent: 'gcloud'`).
//
// A folder of Malloy models (*.malloy) that MonoRail compiles with the real
// Malloy compiler and runs on BigQuery, with the user's own gcloud login, for
// the OpenMetadata page's Semantic models, Query builder and Malloy models
// tabs (electron/modules/malloy.cjs, docs/malloy.md).
//
// Opt-in twice, like MetricFlow: nothing is read until the connection is
// added, and running queries is a second switch ("Run queries on BigQuery"),
// off by default. The check reads the folder only (how many models it has)
// and whether Google Cloud is set up; it makes no network call. Queries are
// billed to the project named here (or gcloud's project); each one is
// dry-run first and refused over the scan limit.

const fs = require('node:fs/promises')
const path = require('node:path')

const { listFiles } = require('../../modules/malloy-lib.cjs')

const GB = 1024 ** 3
const SCAN_GB = ['0.1', '1', '5', '10', '50']

function validate({ values }) {
  const dir = String(values?.folder ?? '').trim()
  if (!dir) throw new Error('Enter the folder that holds your .malloy files.')
  if (!path.isAbsolute(dir)) throw new Error('Enter the full path of the models folder, e.g. C:\\Users\\you\\Repos\\analytics\\malloy.')
  const project = String(values?.project ?? '').trim()
  if (project && !/^([\w.-]+:)?[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error('That is not a Google Cloud project id (lowercase letters, digits and dashes).')
}

/** The settings the Malloy backend reads. No secrets here. */
function settingsOf(values = {}) {
  const gb = Number(values.maxScanGb ?? '1')
  return {
    folder: String(values.folder ?? '').trim(),
    project: String(values.project ?? '').trim() || undefined,
    location: String(values.location ?? '').trim() || undefined,
    maxBytes: Math.round((gb > 0 ? gb : 1) * GB),
    run: values.run === 'on' ? 'on' : 'off',
  }
}

async function status(conn, deps = {}) {
  const s = settingsOf(conn?.values)
  const fsp = deps.fs ?? fs
  let root
  try {
    root = await fsp.realpath(s.folder)
    if (!(await fsp.stat(root)).isDirectory()) throw new Error('not a folder')
  } catch {
    return { state: 'error', summary: 'The models folder was not found.', hint: 'Edit the connection and pick the folder with your .malloy files.', details: [{ label: 'Models folder', value: 'Not found', ok: false }] }
  }
  const { files, truncated } = await listFiles(root, fsp)
  const details = [{ label: 'Models folder', value: `${path.basename(root)}: ${files.length}${truncated ? '+' : ''} Malloy file${files.length === 1 ? '' : 's'}`, ok: files.length > 0 || undefined }]
  const has = deps.hasConnection ?? ((k) => require('../index.cjs').hasConnection(k))
  const gcloud = await has('gcloud')
  details.push({ label: 'BigQuery', value: gcloud ? `Your gcloud login, billed to ${s.project ?? 'your gcloud project'}` : 'Google Cloud is not set up', ok: gcloud || undefined })
  details.push({ label: 'Run queries', value: s.run === 'on' ? `On, at most ${Number((s.maxBytes / GB).toFixed(2))} GB scanned per query` : 'Off (compile and show SQL only)' })
  if (!gcloud) {
    return { state: 'needs-setup', summary: 'Set up Google Cloud first: Malloy reads table schemas and runs queries with your own gcloud login.', hint: 'Add the Google Cloud connection above, then check this one again.', details }
  }
  if (!files.length) return { state: 'error', summary: 'The models folder has no .malloy files.', hint: 'Add a model, or pick another folder.', details }
  return { state: 'ok', summary: `${files.length} Malloy model file${files.length === 1 ? '' : 's'}; ${s.run === 'on' ? 'queries run on BigQuery.' : 'queries are off.'}`, details }
}

module.exports = {
  kind: 'malloy',
  parent: 'gcloud',
  title: 'Malloy',
  icon: 'database',
  description: 'A folder of Malloy models. MonoRail compiles them and, if you turn it on, runs their queries on BigQuery with your own gcloud login. Queries are billed to your project.',
  fields: [
    { key: 'folder', label: 'Models folder', type: 'text', placeholder: 'C:\\Users\\you\\Repos\\analytics\\malloy', help: 'The folder with your .malloy files (subfolders too). MonoRail only reads it.' },
    { key: 'project', label: 'Bill queries to', type: 'text', placeholder: 'Your gcloud project', help: 'Optional: the Google Cloud project that pays for queries and resolves two-part table names. Empty uses the project set in gcloud.' },
    { key: 'location', label: 'BigQuery location', type: 'text', placeholder: 'US', help: 'Optional: where your datasets are, such as US, EU or europe-west2.' },
    {
      key: 'run',
      label: 'Run queries on BigQuery',
      type: 'select',
      defaultValue: 'off',
      options: [
        { value: 'off', label: 'Off: compile and show SQL only' },
        { value: 'on', label: 'On: run queries I start' },
      ],
      help: 'When on, a query you run in MonoRail runs in BigQuery and is billed to your project. Compiling reads table schemas only, which is free.',
    },
    {
      key: 'maxScanGb',
      label: 'Most a query may scan',
      type: 'select',
      defaultValue: '1',
      options: SCAN_GB.map((gb) => ({ value: gb, label: `${gb} GB` })),
      help: 'MonoRail dry-runs every query first and does not run one that would scan more. BigQuery enforces it too.',
    },
  ],
  actions: [],
  validate,
  status,
  /** For the Malloy backend: the folder and query settings. No secrets here. */
  credentials: (conn) => settingsOf(conn?.values),
  _internal: { settingsOf, validate },
}
