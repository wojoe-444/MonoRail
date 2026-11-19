import { openTab } from '../../tabs'

/** A query to start the Query builder with: from a metric, a measure or a saved query. */
export interface QueryDraft {
  /** Changes on every handoff so the builder remounts with it. */
  key?: number
  metrics: string[]
  groupBy: string[]
  where?: string[]
}

let pending: QueryDraft | undefined

/** Open the Query builder tab with this query filled in (not run). Kept in memory only. */
export function openInQuery(draft: QueryDraft) {
  pending = { ...draft, key: Date.now() }
  openTab('query')
}

/** The Query builder's side: the draft another tab handed over, once. */
export function takeQueryDraft(): QueryDraft | undefined {
  const d = pending
  pending = undefined
  return d
}

let pendingModel: string | undefined
let pendingMetric: string | undefined

/** Open one semantic model in the Semantic models tab. */
export function openSemanticModel(name: string) {
  pendingModel = name
  openTab('semantic-models')
}

export function takeSemanticModel(): string | undefined {
  const m = pendingModel
  pendingModel = undefined
  return m
}

/** Open one metric in the Metrics tab. */
export function openMetric(name: string) {
  pendingMetric = name
  openTab('metrics')
}

export function takeMetric(): string | undefined {
  const m = pendingMetric
  pendingMetric = undefined
  return m
}
