/** Shapes returned by electron/modules/bigquery.cjs (bigquery-api.cjs). */

export interface BqField {
  name: string
  type: string
  mode: string
  description?: string
  fields?: BqField[]
}

export type BqCell = string | number | boolean | null | BqCell[] | { [key: string]: BqCell }

export interface BqStatus {
  state: 'ok' | 'not-set-up' | 'error'
  defaultProject?: string
  message?: string
}

export interface BqProject {
  id: string
  name?: string
}

export interface BqDataset {
  id: string
  location?: string
}

export interface BqTableItem {
  id: string
  type?: string
  partitioned?: boolean
}

export interface BqTable {
  projectId: string
  datasetId: string
  tableId: string
  type?: string
  description?: string
  location?: string
  fields: BqField[]
  numRows?: number
  numBytes?: number
  numLongTermBytes?: number
  creationTime?: string
  lastModifiedTime?: string
  expirationTime?: string
  partitioning?: string
  clustering?: string[]
  labels?: Record<string, string>
  viewQuery?: string
}

export interface BqDatasetInfo {
  projectId: string
  datasetId: string
  description?: string
  location?: string
  creationTime?: string
  lastModifiedTime?: string
  defaultTableExpirationMs?: number
  labels?: Record<string, string>
}

export interface BqJobRef {
  projectId: string
  jobId: string
  location?: string
}

export interface BqQueryResult {
  jobComplete: boolean
  job: BqJobRef
  fields: BqField[]
  rows: BqCell[][]
  totalRows?: number
  pageToken?: string
  totalBytesProcessed?: number
  cacheHit: boolean
  numDmlAffectedRows?: number
  errors: string[]
  dryRun?: boolean
  statementType?: string
}

export interface BqStage {
  id: string
  name: string
  status?: string
  waitMsAvg?: number
  readMsAvg?: number
  computeMsAvg?: number
  writeMsAvg?: number
  waitMsMax?: number
  readMsMax?: number
  computeMsMax?: number
  writeMsMax?: number
  recordsRead?: number
  recordsWritten?: number
  shuffleOutputBytes?: number
  slotMs?: number
  startMs?: number
  endMs?: number
  steps: { kind: string; substeps: string[] }[]
}

export interface BqJob {
  projectId: string
  jobId: string
  location?: string
  user?: string
  state?: string
  error?: string
  errors?: string[]
  query?: string
  useLegacySql?: boolean
  jobType?: string
  statementType?: string
  destinationTable?: string
  creationTime?: string
  startTime?: string
  endTime?: string
  totalBytesProcessed?: number
  totalBytesBilled?: number
  totalSlotMs?: number
  cacheHit?: boolean
  numDmlAffectedRows?: number
  stages?: BqStage[]
}

export interface BqPreview {
  fields: BqField[]
  rows: BqCell[][]
  totalRows?: number
  pageToken?: string
  view?: boolean
}

/** Per-query settings (the console's "Query settings"). */
export interface QuerySettings {
  location: string
  maximumBytesBilled: string
  useQueryCache: boolean
  pageSize: number
}

export const DEFAULT_SETTINGS: QuerySettings = { location: '', maximumBytesBilled: '', useQueryCache: true, pageSize: 50 }

/** A tab in the workspace: an editor or a table/dataset view. */
export type WorkTab =
  | { kind: 'query'; id: string; title: string; sql: string; settings?: QuerySettings }
  | { kind: 'table'; id: string; projectId: string; datasetId: string; tableId: string }
  | { kind: 'dataset'; id: string; projectId: string; datasetId: string }
