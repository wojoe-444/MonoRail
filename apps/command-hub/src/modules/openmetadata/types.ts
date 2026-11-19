/** OpenMetadata 2.0.x JSON, the subset the OpenMetadata page reads. Field names are OpenMetadata's. */

export interface OmRef {
  id: string
  type: string
  name?: string
  fullyQualifiedName?: string
  displayName?: string
  description?: string
  deleted?: boolean
}

export interface OmTag {
  tagFQN: string
  source?: 'Classification' | 'Glossary'
  labelType?: string
  state?: string
}

export interface OmColumn {
  name: string
  displayName?: string
  fullyQualifiedName?: string
  dataType?: string
  dataTypeDisplay?: string
  description?: string
  constraint?: string
  tags?: OmTag[]
  children?: OmColumn[]
}

/** Any entity: the fields every type has, plus whatever its own type has. */
export interface OmEntity {
  id: string
  name: string
  fullyQualifiedName?: string
  displayName?: string
  description?: string
  version?: number
  updatedAt?: number
  updatedBy?: string
  deleted?: boolean
  owners?: OmRef[]
  tags?: OmTag[]
  domains?: OmRef[]
  followers?: OmRef[]
  changeDescription?: {
    fieldsAdded?: { name: string }[]
    fieldsUpdated?: { name: string }[]
    fieldsDeleted?: { name: string }[]
  }
  /** On search results only. */
  entityType?: string
  [field: string]: unknown
}

/** A search over the whole catalog: the best matches (summary rows with `entityType`) and how many matched. */
export interface OmSearch {
  data: (OmEntity & { entityType: string })[]
  total: number
}

export interface OmPage {
  data: OmEntity[]
  paging?: { total?: number; after?: string }
}

/** One lineage edge, as OpenMetadata's EntityLineage lists them: the two ends by id. */
export interface OmLineageEdge {
  fromEntity: string
  toEntity: string
  description?: string
  lineageDetails?: {
    source?: string
    sqlQuery?: string
    description?: string
    pipeline?: OmRef
    columnsLineage?: { fromColumns?: string[]; toColumn?: string; function?: string }[]
    [field: string]: unknown
  }
}

/**
 * OpenMetadata's EntityLineage, the same from every source: the entity, the
 * other entities on its lineage, and the edges up- and downstream.
 */
export interface OmLineage {
  entity: OmRef
  nodes: OmRef[]
  upstreamEdges: OmLineageEdge[]
  downstreamEdges: OmLineageEdge[]
  /** The walk stopped at its asset (or, on a server, request) limit before the depth asked for. */
  truncated?: boolean
  /** BigQuery only: the dataset has no lineage table (layout monorail.metadata/1, or /2 without the table). */
  missing?: 'no-lineage-table'
  layout?: string
}

/** Count per entity type; a type the server does not have gets the error. */
export type OmCounts = Record<string, number | { error: string }>

export interface OmStatus {
  /** not-set-up: no connection yet. rejected: the token was refused. unreachable: no answer. local-error: the local database could not be opened. */
  block?: 'not-set-up' | 'rejected' | 'unreachable' | 'local-error'
  /** Which catalog answered: MonoRail's local database, the BigQuery copy, or the OpenMetadata server. */
  source?: 'local' | 'bigquery' | 'server'
  /** Whether an OpenMetadata server is connected (then the page offers it). */
  serverSetUp?: boolean
  /** Whether a BigQuery dataset is the source of truth (then the page offers it, first). */
  bigquerySetUp?: boolean
  /** The BigQuery copy, when source is bigquery. */
  bigquery?: BqStatus
  url?: string
  version?: string
  user?: string
  error?: string
}

/** One sync of the BigQuery copy (electron/localdb/bigquery-mirror.cjs). */
export interface BqSync {
  at: string
  ok: boolean
  error?: string
  /** missing | empty | foreign | mismatch | newer | denied | over-cap | timeout | no-gcloud */
  code?: string
  mode?: 'full' | 'incremental'
  /** Why a sync was full: first copy, a different dataset, or the user asked for a rebuild. */
  reason?: 'first' | 'source' | 'asked'
  /** The second incremental queries asked from (ISO), and tables read whole because SQLite did not hold them yet. */
  since?: string
  seeded?: string[]
  entities?: number
  versions?: number
  records?: number
  /** Lineage edges copied, and removed because BigQuery no longer has them. */
  lineage?: number
  lineageRemoved?: number
  removed?: number
  skipped?: number
  /** The dataset's layout, e.g. monorail.metadata/2. */
  layout?: string
  bytesProcessed?: number
  ms?: number
  remote?: { entities: number; bytes: number; partitioned?: boolean; lineage?: boolean }
}

/** The BigQuery copy: which dataset, whether it has been copied, the last sync and the next. */
export interface BqStatus {
  setUp: boolean
  error?: string
  projectId?: string
  datasetId?: string
  source?: string
  syncEvery?: '15m' | '1h' | '6h' | '24h' | 'manual'
  /** The copy holds this dataset (it has finished a first sync). */
  synced?: boolean
  /** The copied dataset's layout, and whether it has a lineage table. */
  layout?: string
  lineage?: boolean
  last?: BqSync
  running?: { full: boolean; startedAt: string }
  nextAt?: string
}
