import type { OmLineage, OmRef } from './types'
import { displayName } from './util'

/** How many steps of lineage to follow; 'all' follows the graph to its ends. */
export type LineageDepth = '0' | '1' | '2' | '3' | '5' | '10' | 'all'

export const LINEAGE_DEPTHS: { value: LineageDepth; label: string }[] = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: 'all', label: 'All' },
]

/** The value getLineage takes: a number of levels, or 'all'. */
export const depthArg = (d: LineageDepth): number | 'all' => (d === 'all' ? 'all' : Number(d))

/**
 * Types people look at or call rather than build on: listed first among the
 * end products, in this order.
 */
const PRODUCT_ORDER = ['dashboard', 'chart', 'dashboardDataModel', 'mlmodel', 'apiEndpoint', 'metric', 'searchIndex', 'topic', 'container', 'pipeline', 'storedProcedure', 'table']
const rank = (type: string) => {
  const i = PRODUCT_ORDER.indexOf(type)
  return i < 0 ? PRODUCT_ORDER.length : i
}

export interface EndProduct {
  ref: OmRef
  /** Fewest steps from the asset. */
  steps: number
}

/**
 * The end products downstream of the asset: every asset reached downstream
 * that nothing further is made from (no downstream edge of its own), sorted
 * products first (dashboards, charts, models, ...), then by name. `total` is
 * every asset downstream.
 */
export function endProducts(data: OmLineage): { products: EndProduct[]; total: number } {
  const refs = new Map(data.nodes.map((n) => [n.id, n]))
  const out = new Map<string, string[]>()
  for (const e of data.downstreamEdges) out.set(e.fromEntity, [...(out.get(e.fromEntity) ?? []), e.toEntity])
  const steps = new Map<string, number>([[data.entity.id, 0]])
  let frontier = [data.entity.id]
  for (let d = 1; frontier.length; d++) {
    const next: string[] = []
    for (const at of frontier)
      for (const to of out.get(at) ?? []) {
        if (steps.has(to)) continue
        steps.set(to, d)
        next.push(to)
      }
    frontier = next
  }
  steps.delete(data.entity.id)
  const products: EndProduct[] = []
  for (const [id, d] of steps) {
    // A loop back into the asset or its chain still counts as "made from it", not as an end.
    if ((out.get(id) ?? []).length) continue
    products.push({ ref: refs.get(id) ?? { id, type: 'unknown', name: id }, steps: d })
  }
  products.sort((a, b) => rank(a.ref.type) - rank(b.ref.type) || displayName(a.ref).localeCompare(displayName(b.ref)))
  return { products, total: steps.size }
}
