import type { OmEntity, OmLineage, OmLineageEdge, OmRef } from './types'

/** Plain helpers the entity and table pages share. */

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isRef = (v: unknown): v is OmRef => isObject(v) && typeof v.id === 'string' && typeof v.type === 'string'

/** Every top-level field holding an entity reference or a list of them. */
export function referencesOf(entity: OmEntity): [string, OmRef[]][] {
  const out: [string, OmRef[]][] = []
  for (const [k, v] of Object.entries(entity)) {
    if (isRef(v)) out.push([k, [v]])
    else if (Array.isArray(v) && v.length && v.every(isRef)) out.push([k, v])
  }
  return out
}

/** One side of the lineage: each entity once, with how many steps away it is and the edge that reached it first. */
export function sideOf(data: OmLineage, upstream: boolean): { ref: OmRef; steps: number; edge: OmLineageEdge }[] {
  const nodes = new Map(data.nodes.map((n) => [n.id, n]))
  const byEnd = new Map<string, OmLineageEdge[]>()
  for (const e of upstream ? data.upstreamEdges : data.downstreamEdges) {
    const at = upstream ? e.toEntity : e.fromEntity
    byEnd.set(at, [...(byEnd.get(at) ?? []), e])
  }
  const out: { ref: OmRef; steps: number; edge: OmLineageEdge }[] = []
  const seen = new Set([data.entity.id])
  let frontier = [data.entity.id]
  for (let steps = 1; frontier.length; steps++) {
    const next: string[] = []
    for (const at of frontier) {
      for (const e of byEnd.get(at) ?? []) {
        const id = upstream ? e.fromEntity : e.toEntity
        if (seen.has(id)) continue
        seen.add(id)
        next.push(id)
        out.push({ ref: nodes.get(id) ?? { id, type: 'unknown', name: id }, steps, edge: e })
      }
    }
    frontier = next
  }
  return out
}

/** What a version changed, in words ("changed description, added tags"). */
export function changeSummary(v: OmEntity): string {
  const ch = v.changeDescription
  const fields = [
    ...(ch?.fieldsAdded ?? []).map((f) => `added ${f.name}`),
    ...(ch?.fieldsUpdated ?? []).map((f) => `changed ${f.name}`),
    ...(ch?.fieldsDeleted ?? []).map((f) => `removed ${f.name}`),
  ]
  return fields.length ? fields.join(', ').replace(/\./g, ' › ') : v.version === 0.1 ? 'Created' : 'No field changes recorded'
}
