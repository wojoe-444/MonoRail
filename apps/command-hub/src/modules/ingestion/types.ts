/** Mirrors electron/modules/ingestion.cjs. Pipelines are OpenMetadata ingestionPipeline entities. */

import type { ConnectionStatus } from '@/modules/connections/types'

export type PipelineType = 'metadata' | 'usage' | 'lineage' | 'profiler' | 'autoClassification' | 'dbt'
export type PipelineState = 'queued' | 'running' | 'success' | 'failed' | 'partialSuccess'

export interface FilterPattern {
  includes?: string[]
  excludes?: string[]
}

export interface SourceConfig {
  type?: string
  databaseFilterPattern?: FilterPattern
  schemaFilterPattern?: FilterPattern
  tableFilterPattern?: FilterPattern
  includeViews?: boolean
  includeTags?: boolean
  markDeletedTables?: boolean
  queryLogDuration?: number
  profileSample?: number
  columnMetricsRowLimit?: number
  dbtUpdateDescriptions?: boolean
}

export interface AirflowConfig {
  scheduleInterval?: string
  retries?: number
  retryDelay?: number
}

/** OpenMetadata's StepSummary. */
export interface StepSummary {
  name: string
  records?: number
  updated_records?: number
  warnings?: number
  errors?: number
  filtered?: number
  failures?: { name?: string; error?: string; message?: string }[]
}

/** OpenMetadata's PipelineStatus; local runs add `log`. */
export interface PipelineStatus {
  runId: string
  pipelineState: PipelineState
  startDate: number
  endDate?: number
  timestamp?: number
  status?: StepSummary[]
  log?: string[]
  extension?: { monorail?: { trigger?: string; attempt?: number } }
}

export interface RunSummary {
  runId: string
  pipelineState: PipelineState
  startDate: number
  endDate?: number
  records: number
  warnings?: number
  errors?: number
  error?: string
}

export type Runner = 'this-pc' | 'server'

export interface Pipeline {
  id: string
  name: string
  displayName?: string
  description?: string
  fullyQualifiedName?: string
  pipelineType: PipelineType
  service?: { id?: string; type: string; name: string; fullyQualifiedName?: string; displayName?: string }
  sourceConfig?: { config: SourceConfig }
  airflowConfig?: AirflowConfig
  loggerLevel?: string
  enabled: boolean
  deployed: boolean
  schedule: string
  nextRun?: string | null
  running?: boolean
  lastRun: RunSummary | null
  recent?: { runId: string; pipelineState: PipelineState; startDate: number; records: number }[]
  extension?: { monorail?: { runner: Runner; serviceKind?: string } }
}

export interface LocalService {
  kind: string
  title: string
  name: string
  displayName: string
  category: string
  serviceType: string
  added: boolean
  status?: ConnectionStatus
  localTypes: PipelineType[]
  /** pipelines: read by ingestion pipelines. connect: the connection is the ingestion; MonoRail keeps a copy (BigQuery metadata). */
  ingestion?: 'pipelines' | 'connect'
  pipelines: number
  catalog?: { databases: number; schemas: number; tables: number; updatedAt?: string }
  /** A connect-only service's copy on this PC. */
  copy?: ServiceCopy
}

export interface ServiceCopy {
  source?: string
  entities: number
  /** The copy holds this dataset (a first sync finished). */
  synced: boolean
  syncEvery?: '15m' | '1h' | '6h' | '24h' | 'manual'
  last?: { at: string; ok: boolean; error?: string; mode?: 'full' | 'incremental'; reason?: 'first' | 'source' | 'asked'; entities?: number; removed?: number }
  running?: boolean
  nextAt?: string
  error?: string
}

export interface Overview {
  services: LocalService[]
  pipelines: Pipeline[]
  serverSetUp: boolean
  catalogError?: string
}

export interface ServerService {
  id: string
  name: string
  fullyQualifiedName: string
  displayName?: string
  description?: string
  category: string
  serviceType?: string
  deleted?: boolean
}

export interface ServerOverview {
  block?: 'not-set-up' | 'rejected' | 'unreachable'
  error?: string
  services?: ServerService[]
  pipelines?: Pipeline[]
  problems?: string[]
  truncated?: boolean
  createTypes?: Record<string, PipelineType[]>
}

export interface TestResult {
  state: ConnectionStatus['state']
  summary: string
  hint?: string
  checkedAt?: string
  steps: { name: string; message?: string; passed: boolean; mandatory: boolean }[]
}

/** The service a detail view or a new pipeline belongs to. */
export type ServiceRef = { where: 'local'; service: LocalService } | { where: 'server'; service: ServerService }
