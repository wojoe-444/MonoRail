import { openTab } from '../../tabs'
import { setSemanticEngine } from './engine'

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
  setSemanticEngine('metricflow')
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
  setSemanticEngine('metricflow')
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

/** A Malloy query to start the Query builder with: a model file and one of its sources, optionally a view. */
export interface MalloyDraft {
  /** Changes on every handoff so the builder remounts with it. */
  key?: number
  /** The model file, relative to the models folder. */
  path: string
  source: string
  view?: string
}

let pendingMalloy: MalloyDraft | undefined

/** Open the Query builder on the Malloy engine with this source picked (nothing runs). */
export function openInMalloyQuery(draft: MalloyDraft) {
  pendingMalloy = { ...draft, key: Date.now() }
  setSemanticEngine('malloy')
  openTab('query')
}

export function takeMalloyDraft(): MalloyDraft | undefined {
  const d = pendingMalloy
  pendingMalloy = undefined
  return d
}

let pendingMalloySource: { path: string; source: string } | undefined

/** Open one Malloy source in the Semantic models tab. */
export function openMalloySource(path: string, source: string) {
  pendingMalloySource = { path, source }
  setSemanticEngine('malloy')
  openTab('semantic-models')
}

export function takeMalloySource(): { path: string; source: string } | undefined {
  const s = pendingMalloySource
  pendingMalloySource = undefined
  return s
}
