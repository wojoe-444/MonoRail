// Files of the Services page's ingestion pipelines, in its data folder
// (modules/ingestion, profile scope; declared in electron/cache/declared.cjs):
//
//   pipelines.json  the pipelines that run on this PC, as OpenMetadata
//                   ingestionPipeline entities (name, pipelineType, service,
//                   sourceConfig, airflowConfig, enabled, deployed, extension)
//   runs.json       per pipeline the newest RUNS_KEPT run statuses in
//                   OpenMetadata's pipelineStatus shape (state, times, step
//                   counts, failures) plus up to LOG_LINES log lines, and the
//                   last scheduled time per pipeline
//   catalog.json    what local pipelines read: databases, schemas, tables,
//                   columns, profiles and dbt lineage per service. Names and
//                   numbers only, never row data.
//
// Writes are atomic and queued one at a time in this process (only the main
// process writes). A damaged file is never read as empty or overwritten: the
// reader throws and the page shows the error. No Electron here.

const path = require('node:path')
const fs = require('node:fs/promises')
const { writeJsonAtomic } = require('../cache/files.cjs')

const PIPELINES_FILE = 'pipelines.json'
const RUNS_FILE = 'runs.json'
const CATALOG_FILE = 'catalog.json'
const VERSION = 1
const RUNS_KEPT = 30
const LOG_LINES = 200

const EMPTY = Object.freeze({
  [PIPELINES_FILE]: () => ({ version: VERSION, pipelines: [] }),
  [RUNS_FILE]: () => ({ version: VERSION, runs: {}, scheduled: {} }),
  [CATALOG_FILE]: () => ({ version: VERSION, services: {} }),
})

const LABELS = { [PIPELINES_FILE]: 'saved pipelines', [RUNS_FILE]: 'pipeline run history', [CATALOG_FILE]: 'local catalog' }

function createStore(dir) {
  let queue = Promise.resolve()

  async function read(name) {
    let text
    try {
      text = await fs.readFile(path.join(dir, name), 'utf8')
    } catch (e) {
      if (e.code === 'ENOENT') return EMPTY[name]()
      throw e
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = undefined
    }
    if (!data || typeof data !== 'object' || data.version !== VERSION) {
      throw new Error(`The ${LABELS[name]} file (${name}) is damaged or from another version, so it was left as it is.`)
    }
    return { ...EMPTY[name](), ...data }
  }

  /** Read, change and write one file, one change at a time. `change` returns the result. */
  function update(name, change) {
    const run = queue.then(async () => {
      const data = await read(name) // throws on a damaged file: never overwrite it
      const result = await change(data)
      await fs.mkdir(dir, { recursive: true })
      await writeJsonAtomic(path.join(dir, name), data)
      return result
    })
    queue = run.catch(() => {})
    return run
  }

  return {
    pipelines: async () => (await read(PIPELINES_FILE)).pipelines,
    updatePipelines: (change) => update(PIPELINES_FILE, (d) => change(d.pipelines)),
    runsFile: () => read(RUNS_FILE),
    /** Add or replace a run status (matched by runId), newest first. */
    saveRun: (pipelineId, status) =>
      update(RUNS_FILE, (d) => {
        const list = (d.runs[pipelineId] ?? []).filter((r) => r.runId !== status.runId)
        const log = Array.isArray(status.log) ? status.log.slice(-LOG_LINES) : undefined
        d.runs[pipelineId] = [{ ...status, log }, ...list].sort((a, b) => b.startDate - a.startDate).slice(0, RUNS_KEPT)
      }),
    setScheduled: (pipelineId, iso) =>
      update(RUNS_FILE, (d) => {
        d.scheduled[pipelineId] = iso
      }),
    forgetRuns: (pipelineId) =>
      update(RUNS_FILE, (d) => {
        delete d.runs[pipelineId]
        delete d.scheduled[pipelineId]
      }),
    catalog: () => read(CATALOG_FILE),
    updateCatalog: (change) => update(CATALOG_FILE, (d) => change(d.services)),
  }
}

module.exports = { createStore, PIPELINES_FILE, RUNS_FILE, CATALOG_FILE, RUNS_KEPT, LOG_LINES }
