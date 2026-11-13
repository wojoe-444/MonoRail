// MetricFlow connector: a dbt project's semantic layer and the user's own
// MetricFlow (`mf`), for the Semantic page (Insights > Semantic).
//
// Optional, like every connector: nothing here runs until the user adds the
// connection, and MonoRail never installs Python, dbt or MetricFlow. Two
// settings: the dbt project folder, and "Run queries with MetricFlow" (off by
// default). The check runs no program: it reads dbt_project.yml, the semantic
// manifest, the start of target/manifest.json (dbt's version) and the
// dist-info folder names next to mf (versions), and only looks for
// profiles.yml, which it never opens.
//
// Action: Validate project (mf validate-configs --skip-dw), only while running
// queries is on.

const path = require('node:path')

const mfLib = require('../../modules/semantic-mf.cjs')

const runOn = (conn) => conn?.values?.run === 'on'

function validate({ values }) {
  const dir = String(values?.project ?? '').trim()
  if (!dir) throw new Error('Enter the dbt project folder (the one with dbt_project.yml).')
  if (!path.isAbsolute(dir)) throw new Error('Enter the full path of the dbt project folder, e.g. C:\\Users\\you\\Repos\\analytics.')
}

/** Fold what was read into one status. Exported for tests. */
function summarize({ project, manifest, meta, mf, versions, profiles, run }) {
  if (!project || project.error) {
    return {
      state: 'error',
      summary: 'The folder has no dbt_project.yml.',
      hint: 'Pick the folder that holds dbt_project.yml (edit the connection).',
      details: [{ label: 'dbt project', value: 'Not found', ok: false }],
    }
  }
  const details = [{ label: 'dbt project', value: `${project.name} (${project.folderName})`, ok: true }]
  const mfDetail = mf
    ? { label: 'mf', value: mf.shim ? 'Found on PATH as a script, not mf.exe' : `${versions.metricflow ?? 'Found'}, in ${mf.where}`, ok: !mf.shim || undefined }
    : { label: 'mf', value: 'Not found in .venv, venv or on PATH' }
  if (manifest.error) {
    details.push({ label: 'Semantic manifest', value: manifest.error === 'no-manifest' ? 'Not found (run dbt parse)' : manifest.detail ?? 'Could not be read', ok: false })
    details.push(mfDetail)
    if (versions.dbt) details.push({ label: 'dbt', value: versions.dbt })
    return {
      state: 'error',
      summary: manifest.error === 'no-manifest' ? `dbt project ${project.name} has no semantic manifest yet.` : `The semantic manifest of ${project.name} could not be read.`,
      hint: 'Run "dbt parse" in the project folder (it writes target/semantic_manifest.json), then check again.',
      details,
    }
  }
  const when = meta.generatedAt ?? manifest.mtime
  details.push({ label: 'Semantic manifest', value: `${manifest.metrics.length} metrics, ${manifest.models.length} semantic models${when ? `, parsed ${new Date(when).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}`, ok: true })
  details.push(mfDetail)
  if (versions.dbt || meta.dbtVersion) details.push({ label: 'dbt', value: versions.dbt ?? `dbt ${meta.dbtVersion}` })
  details.push({ label: 'profiles.yml', value: profiles ? `Found in ${profiles} (not read)` : 'Not found' })
  details.push({ label: 'Run queries', value: run ? 'On' : 'Off (browse only)' })
  const canRun = run && mf && !mf.shim
  return {
    state: 'ok',
    summary: `dbt project ${project.name} with ${manifest.metrics.length} metrics.${mf && !mf.shim ? ` MetricFlow ${versions.metricflow ?? ''} found`.replace('  ', ' ') + (run ? '; queries are on.' : '; queries are off.') : ' mf not found: browse only.'}`,
    hint: run && !canRun ? 'Queries are on but mf.exe was not found. Install MetricFlow into the project’s .venv (pip install dbt-metricflow) yourself.' : undefined,
    details,
    actions: canRun ? ['validate'] : [],
  }
}

async function status(conn, deps = {}) {
  const project = await mfLib.readProject(conn?.values?.project?.trim(), deps)
  if (project.error) return summarize({ project })
  const [manifest, meta, mf, profiles] = await Promise.all([
    mfLib.readManifest(project.targetDir, deps),
    mfLib.manifestMeta(project.targetDir, deps),
    mfLib.findMf(project.dir, deps),
    mfLib.findProfiles(project.dir, deps),
  ])
  const versions = mf ? mfLib.summarizeVersions(await mfLib.packageVersions(mf.file, deps)) : {}
  return summarize({ project, manifest, meta, mf, versions, profiles, run: runOn(conn) })
}

async function validateProject(conn, job, deps = {}) {
  if (!runOn(conn)) throw new Error('Running MetricFlow is off for this connection. Turn on "Run queries with MetricFlow" first.')
  const project = await mfLib.readProject(conn?.values?.project?.trim(), deps)
  if (project.error) throw new Error('The dbt project folder was not found.')
  const mf = await mfLib.findMf(project.dir, deps)
  const r = await mfLib.validateConfigs({ projectDir: project.dir, mf }, deps)
  job.appendOutput?.(r.output)
  if (!r.ok) throw new Error(r.error)
  job.note = 'MetricFlow found no problems in the project.'
}

module.exports = {
  kind: 'metricflow',
  title: 'MetricFlow',
  description: 'Your dbt project’s semantic layer and your own MetricFlow (mf). The Semantic page under Insights reads it. Optional: MonoRail never installs Python, dbt or MetricFlow.',
  icon: 'database',
  fields: [
    { key: 'project', label: 'dbt project folder', type: 'text', placeholder: 'C:\\Users\\you\\Repos\\analytics', help: 'The folder with dbt_project.yml. MonoRail reads target/semantic_manifest.json from it.' },
    {
      key: 'run',
      label: 'Run queries with MetricFlow',
      type: 'select',
      options: [
        { value: 'off', label: 'Off: only browse the project' },
        { value: 'on', label: 'On: run my mf command for queries' },
      ],
      defaultValue: 'off',
      help: 'When on, the Semantic page runs your own mf (Python) in the project folder for each query you start. It connects to your warehouse with your dbt profile.',
    },
  ],
  validate,
  actions: [
    { id: 'validate', label: 'Validate project', description: 'Runs mf validate-configs in the project folder (only when queries are on).', showWhen: ['ok', 'error'], run: (conn, job, deps) => validateProject(conn, job, deps) },
  ],
  status,
  /** For the Semantic page backend: the two settings, nothing secret. */
  credentials: (conn) => ({ project: conn?.values?.project?.trim(), run: runOn(conn) ? 'on' : 'off' }),
  _internal: { summarize, validate },
}
