/**
 * What the Semantic page shows. The backend (electron/modules/semantic.cjs)
 * reads the dbt project's `target/semantic_manifest.json` into this shape
 * without running anything; only a query runs MetricFlow (`mf`).
 */

export type MetricType = 'simple' | 'ratio' | 'cumulative' | 'derived' | 'conversion'
export type TimeGrain = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface SemanticMetric {
  name: string
  label?: string
  description?: string
  type: MetricType
  /** How it is worked out, in words built from the manifest, e.g. "sum of order_total". */
  definition: string
  /** A Jinja where filter on the metric itself, as written. */
  filter?: string
  /** Measures it reads, directly or through its input metrics. */
  measures: string[]
  /** Metrics it is built from (ratio, derived, cumulative over another metric). */
  inputMetrics: string[]
  semanticModels: string[]
  /** Group-by names it can be split by, e.g. `customer__region`. Time dimensions are listed without a grain. */
  dimensions: string[]
}

export interface ModelDimension {
  name: string
  type: 'categorical' | 'time'
  grain?: TimeGrain
  description?: string
}

export interface ModelEntity {
  name: string
  type: 'primary' | 'foreign' | 'unique' | 'natural'
}

export interface ModelMeasure {
  name: string
  agg: string
  description?: string
}

export interface SemanticModel {
  name: string
  description?: string
  /** The dbt model it is defined on, e.g. `fct_orders`. */
  model?: string
  defaultTimeDimension?: string
  primaryEntity?: string
  entities: ModelEntity[]
  dimensions: ModelDimension[]
  measures: ModelMeasure[]
}

export interface SavedQuery {
  name: string
  description?: string
  metrics: string[]
  groupBy: string[]
  where: string[]
}

/** One dimension anyone can group by, with where it comes from. */
export interface GroupByDimension {
  name: string
  type: 'categorical' | 'time'
  grain?: TimeGrain
  semanticModel: string
  description?: string
}

export type SemanticBlock = 'not-set-up' | 'no-project' | 'no-manifest' | 'bad-manifest'

export interface SemanticProject {
  block?: SemanticBlock
  blockDetail?: string
  project?: {
    name: string
    /** The folder's own name only, never its full path. */
    folderName: string
    dbtVersion?: string
    /** When dbt wrote the manifest. */
    manifestAt?: string
  }
  metricflow: {
    /** The user turned on "Run queries with MetricFlow" in the connection. */
    canRun: boolean
    found: boolean
    version?: string
  }
  metrics: SemanticMetric[]
  models: SemanticModel[]
  dimensions: GroupByDimension[]
  savedQueries: SavedQuery[]
  readAt: string
}

export interface QueryRequest {
  metrics: string[]
  /** e.g. `metric_time__week`, `order__channel`. */
  groupBy: string[]
  where: string[]
  start?: string
  end?: string
  /** Group-by or metric names; a leading `-` sorts descending. */
  orderBy: string[]
  limit?: number
}

export interface QueryResult {
  columns: string[]
  rows: (string | number | null)[][]
  ms: number
  /** More rows came back than the page keeps. */
  truncated?: boolean
}

export interface ExplainResult {
  sql: string
}
