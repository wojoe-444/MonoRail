// Fictional sample data for the browser dev server (no backend). Nothing here
// describes a real database, server or person.

import type { Overview, Pipeline, PipelineStatus, ServerOverview, TestResult } from './types'

const HOUR = 3_600_000
const t0 = Date.now()

const notesMeta: Pipeline = {
  id: '6f1d3c2a-0000-4000-8000-000000000001',
  name: 'field_notes_metadata',
  pipelineType: 'metadata',
  service: { type: 'databaseService', name: 'local_sqlite', fullyQualifiedName: 'local_sqlite', displayName: 'field-notes.sqlite3' },
  sourceConfig: { config: { type: 'DatabaseMetadata', includeViews: true, includeTags: true, markDeletedTables: true, tableFilterPattern: { excludes: ['.*_tmp'] } } },
  airflowConfig: { scheduleInterval: '0 */6 * * *', retries: 1, retryDelay: 300 },
  loggerLevel: 'INFO',
  enabled: true,
  deployed: true,
  schedule: 'Every 6 hours',
  nextRun: new Date(t0 + 2 * HOUR).toISOString(),
  lastRun: { runId: 'r1', pipelineState: 'success', startDate: t0 - 4 * HOUR, endDate: t0 - 4 * HOUR + 2100, records: 14, warnings: 0, errors: 0 },
  recent: [1, 2, 3, 4, 5, 6].map((i) => ({ runId: `r${i}`, pipelineState: 'success' as const, startDate: t0 - i * 6 * HOUR, records: 14 })),
  extension: { monorail: { runner: 'this-pc', serviceKind: 'sqlite' } },
}

const notesProfiler: Pipeline = {
  ...notesMeta,
  id: '6f1d3c2a-0000-4000-8000-000000000002',
  name: 'field_notes_profiler',
  pipelineType: 'profiler',
  sourceConfig: { config: { type: 'Profiler' } },
  airflowConfig: { retries: 0, retryDelay: 300 },
  deployed: false,
  schedule: 'Manual only',
  nextRun: null,
  lastRun: null,
  recent: [],
}

const shopDbt: Pipeline = {
  ...notesMeta,
  id: '6f1d3c2a-0000-4000-8000-000000000003',
  name: 'jaffle_dbt',
  pipelineType: 'dbt',
  service: { type: 'databaseService', name: 'local_dbt', fullyQualifiedName: 'local_dbt', displayName: 'jaffle_shop' },
  sourceConfig: { config: { type: 'DBT', dbtConfigSource: { dbtConfigType: 'local' }, dbtUpdateDescriptions: true } as never },
  airflowConfig: { scheduleInterval: '15 */6 * * *', retries: 0, retryDelay: 300 },
  schedule: '15 */6 * * *',
  lastRun: { runId: 'd1', pipelineState: 'failed', startDate: t0 - 38 * 60_000, endDate: t0 - 38 * 60_000 + 400, records: 0, warnings: 0, errors: 1, error: 'manifest.json not found. Run "dbt parse" (or any dbt command) in the project folder, then run this pipeline again.' },
  recent: [
    { runId: 'd1', pipelineState: 'failed', startDate: t0 - 1 * HOUR, records: 0 },
    { runId: 'd2', pipelineState: 'success', startDate: t0 - 7 * HOUR, records: 41 },
  ],
  extension: { monorail: { runner: 'this-pc', serviceKind: 'metricflow' } },
}

export const sampleOverview: Overview = {
  serverSetUp: true,
  pipelines: [notesMeta, notesProfiler, shopDbt],
  services: [
    { kind: 'metricflow', title: 'MetricFlow', name: 'local_dbt', displayName: 'jaffle_shop', category: 'databaseService', serviceType: 'dbt', added: true, localTypes: ['dbt'], pipelines: 1, catalog: { databases: 2, schemas: 3, tables: 12 }, status: { state: 'ok', summary: 'dbt project jaffle_shop with 6 metrics.', details: [], added: true } },
    { kind: 'sqlite', title: 'SQLite', name: 'local_sqlite', displayName: 'field-notes.sqlite3', category: 'databaseService', serviceType: 'SQLite', added: true, localTypes: ['metadata', 'profiler'], pipelines: 2, catalog: { databases: 1, schemas: 1, tables: 14 }, status: { state: 'ok', summary: 'Database is readable (12 tables).', details: [], added: true } },
    {
      kind: 'bigquery-metadata',
      title: 'BigQuery metadata',
      name: 'bigquery_metadata',
      displayName: 'orbit-analytics.METADATA',
      category: 'metadataService',
      serviceType: 'BigQuery',
      added: true,
      localTypes: [],
      ingestion: 'connect',
      pipelines: 0,
      copy: { source: 'orbit-analytics.METADATA', entities: 1842, synced: true, syncEvery: '1h', last: { at: new Date(t0 - HOUR / 3).toISOString(), ok: true, mode: 'incremental', entities: 6 }, nextAt: new Date(t0 + (2 * HOUR) / 3).toISOString() },
      status: { state: 'ok', summary: "orbit-analytics.METADATA holds MonoRail's metadata (1,842 entities). It is the source of truth.", details: [], added: true },
    },
  ],
}

const SERVICE_ID = '9a0b8c7d-0000-4000-8000-000000000010'
export const sampleServer: ServerOverview = {
  services: [
    { id: SERVICE_ID, name: 'orbit_warehouse', fullyQualifiedName: 'orbit_warehouse', displayName: 'Orbit Warehouse', category: 'databaseService', serviceType: 'Snowflake' },
    { id: '9a0b8c7d-0000-4000-8000-000000000011', name: 'nightly_airflow', fullyQualifiedName: 'nightly_airflow', category: 'pipelineService', serviceType: 'Airflow' },
  ],
  pipelines: [
    { id: '9a0b8c7d-0000-4000-8000-000000000020', name: 'orbit_metadata', fullyQualifiedName: 'orbit_warehouse.orbit_metadata', pipelineType: 'metadata', service: { id: SERVICE_ID, type: 'databaseService', name: 'orbit_warehouse' }, airflowConfig: { scheduleInterval: '0 */6 * * *' }, schedule: 'Every 6 hours', enabled: true, deployed: true, lastRun: { runId: 's1', pipelineState: 'success', startDate: t0 - 2 * HOUR, records: 1284 }, extension: { monorail: { runner: 'server' } } },
    { id: '9a0b8c7d-0000-4000-8000-000000000021', name: 'orbit_usage', fullyQualifiedName: 'orbit_warehouse.orbit_usage', pipelineType: 'usage', service: { id: SERVICE_ID, type: 'databaseService', name: 'orbit_warehouse' }, airflowConfig: { scheduleInterval: '0 2 * * *' }, schedule: 'Daily at 02:00', enabled: true, deployed: true, lastRun: { runId: 's2', pipelineState: 'partialSuccess', startDate: t0 - 11 * HOUR, records: 612, warnings: 3 }, extension: { monorail: { runner: 'server' } } },
    { id: '9a0b8c7d-0000-4000-8000-000000000022', name: 'orbit_profiler', fullyQualifiedName: 'orbit_warehouse.orbit_profiler', pipelineType: 'profiler', service: { id: SERVICE_ID, type: 'databaseService', name: 'orbit_warehouse' }, airflowConfig: {}, schedule: 'Manual only', enabled: false, deployed: false, lastRun: null, extension: { monorail: { runner: 'server' } } },
  ],
  createTypes: { databaseService: ['metadata', 'usage', 'lineage', 'profiler', 'autoClassification'], pipelineService: ['metadata'] },
}

const sampleRun: PipelineStatus = {
  runId: 'r1',
  pipelineState: 'success',
  startDate: t0 - 4 * HOUR,
  endDate: t0 - 4 * HOUR + 2100,
  status: [
    { name: 'SQLite source', records: 14, updated_records: 0, warnings: 0, errors: 0, filtered: 2, failures: [] },
    { name: 'Local catalog sink', records: 14, updated_records: 3, warnings: 0, errors: 0, filtered: 0, failures: [] },
  ],
  log: ['10:00:00 INFO  Starting field_notes_metadata (metadata, schedule)', '10:00:00 INFO  Reading field-notes.sqlite3 (read-only)', '10:00:01 INFO  Found 16 tables and views, 2 filtered', '10:00:02 INFO  Catalog: 0 new, 3 changed', '10:00:02 INFO  Finished with status success'],
}

const sampleTest: TestResult = {
  state: 'ok',
  summary: 'Database is readable (12 tables).',
  steps: [
    { name: 'Database', message: 'field-notes.sqlite3', passed: true, mandatory: true },
    { name: 'Access', message: 'Read-only check', passed: true, mandatory: true },
  ],
}

export async function sampleInvoke<T>(method: string): Promise<T> {
  const answers: Record<string, unknown> = {
    overview: sampleOverview,
    listPipelines: sampleOverview.pipelines,
    serverOverview: sampleServer,
    runs: [sampleRun],
    serverRuns: [sampleRun],
    serverLogs: { lines: sampleRun.log, truncated: false },
    testConnection: sampleTest,
  }
  if (method in answers) return answers[method] as T
  throw new Error('This is sample data. Pipelines run in the desktop app.')
}
