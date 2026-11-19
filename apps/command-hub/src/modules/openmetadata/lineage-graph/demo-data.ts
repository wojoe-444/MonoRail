import type { OmLineageEdge, OmRef } from '../types'

const stages = [
  { schema: 'intake', type: 'table', count: 560 },
  { schema: 'cleansed', type: 'table', count: 560 },
  { schema: 'conformed', type: 'table', count: 560 },
  { schema: 'core', type: 'table', count: 560 },
  { schema: 'enriched', type: 'table', count: 520 },
  { schema: 'curated', type: 'table', count: 480 },
  { schema: 'marts', type: 'table', count: 440 },
  { schema: 'views', type: 'view', count: 400 },
  { schema: 'jobs', type: 'pipeline', count: 360 },
  { schema: 'features', type: 'table', count: 280 },
  { schema: 'models', type: 'mlmodel', count: 160 },
  { schema: 'reports', type: 'dashboard', count: 120 },
]

const domains = ['orbital_freight', 'tidal_power', 'lunar_market', 'cloud_harbor', 'garden_transit', 'comet_weather']
const subjects = ['shipments', 'forecast', 'inventory', 'sensors', 'routes', 'demand', 'stations', 'incidents']

/** Seeded fictional assets, for demos and repeatable benchmarks. */
export function generateLineage(seed = 42): { nodes: OmRef[]; edges: OmLineageEdge[]; rootId: string } {
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const layers = stages.map(({ schema, type, count }, rank) => Array.from({ length: count }, (_, i): OmRef => {
    const domain = domains[Math.floor(i * domains.length / count)]
    const name = `${subjects[i % subjects.length]}_${String(i + 1).padStart(3, '0')}`
    return {
      id: `00000000-0000-4000-8000-${String(rank * 1000 + i).padStart(12, '0')}`,
      type,
      name,
      fullyQualifiedName: `fictional_yard.${domain}.${schema}.${name}`,
    }
  }))
  const edges: OmLineageEdge[] = []
  const seen = new Map<string, Set<string>>()
  const connect = (from: OmRef, to: OmRef) => {
    let targets = seen.get(from.id)
    if (!targets) seen.set(from.id, targets = new Set())
    if (targets.has(to.id)) return
    targets.add(to.id)
    edges.push({ fromEntity: from.id, toEntity: to.id })
  }
  for (let rank = 1; rank < layers.length; rank++) {
    const previous = layers[rank - 1]
    const layer = layers[rank]
    // Cover both sides of each stage. The nearest normalized row keeps most dependencies within a domain.
    if (previous.length >= layer.length) {
      previous.forEach((from, i) => connect(from, layer[Math.floor(i * layer.length / previous.length)]))
    } else {
      layer.forEach((to, i) => connect(previous[Math.floor(i * previous.length / layer.length)], to))
    }
  }
  while (edges.length < 7000) {
    const rank = 1 + Math.floor(random() * (layers.length - 1))
    const layer = layers[rank]
    const previous = layers[random() < 0.16 && rank > 1 ? rank - 2 : rank - 1]
    const target = Math.floor(random() * layer.length)
    const center = Math.floor(target * previous.length / layer.length)
    // A few shared sources fan out broadly. Most joins use neighboring assets.
    const source = random() < 0.15
      ? Math.floor(random() * domains.length) * Math.floor(previous.length / domains.length)
      : Math.max(0, Math.min(previous.length - 1, center + Math.round((random() - 0.5) * 42)))
    connect(previous[source], layer[target])
  }
  return { nodes: layers.flat(), edges, rootId: layers[5][layers[5].length >>> 1].id }
}
