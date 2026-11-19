import type { OmLineageEdge } from '../types'
import { buildIndex, type SpatialIndex } from './spatial'
import { makeTopology, rankTopology, type Topology } from './topology'

export const nodeWidth = 224
export const nodeHeight = 72
const columnPitch = 320
const rowPitch = 96
/** A layer with more assets than this wraps into side-by-side tracks, so the graph keeps a shape a screen can fit. */
const trackRows = 30
const trackPitch = nodeWidth + 40

export interface LayoutRequest {
  nodeIds: string[]
  edges: readonly Pick<OmLineageEdge, 'fromEntity' | 'toEntity'>[]
  previousOrder?: ReadonlyMap<string, number>
}

export interface LineageLayout extends Topology {
  x: Float32Array
  y: Float32Array
  nodeIndex: SpatialIndex
  edgeIndex: SpatialIndex
  left: number
  top: number
  width: number
  height: number
  feedbackEdges: number
}

export function layoutLineage({ nodeIds, edges, previousOrder }: LayoutRequest): LineageLayout {
  const count = nodeIds.length
  const indexes = new Map(nodeIds.map((id, i) => [id, i]))
  const topology = makeTopology(indexes, edges)
  const { from, to, incoming, outgoing } = topology
  const { ranks, backEdge, feedbackEdges } = rankTopology(topology)
  const layers: number[][] = []
  for (let node = 0; node < count; node++) (layers[ranks[node]] ??= []).push(node)

  const row = new Float64Array(count)
  const score = new Float64Array(count)
  const maxRows = layers.reduce((max, layer) => Math.max(max, layer.length), 0)
  for (const layer of layers) {
    if (previousOrder) {
      // Keep the previous relative order as the seed for surviving assets.
      layer.forEach((node, i) => { score[node] = previousOrder.get(nodeIds[node]) ?? (i + 0.5) / layer.length })
      layer.sort((a, b) => score[a] - score[b])
    }
    layer.forEach((node, i) => { row[node] = i + (maxRows - layer.length) / 2 })
  }

  // Two forward/backward barycenter passes. A long edge contributes the same
  // weight as a short edge by using its endpoint directly, with no dummy vertices.
  for (let sweep = 0; sweep < 4; sweep++) {
    const forward = sweep % 2 === 0
    const adjacency = forward ? incoming : outgoing
    const neighbor = forward ? from : to
    for (let step = 0; step < layers.length; step++) {
      const layer = layers[forward ? step : layers.length - 1 - step]
      for (const node of layer) {
        let sum = 0
        let degree = 0
        for (const edge of adjacency[node]) {
          if (backEdge[edge]) continue
          sum += row[neighbor[edge]]
          degree++
        }
        score[node] = degree ? sum / degree : row[node]
      }
      layer.sort((a, b) => score[a] - score[b])
      layer.forEach((node, i) => { row[node] = i + (maxRows - layer.length) / 2 })
    }
  }

  // Each layer fills its tracks top to bottom in barycenter order, then the next track to the right.
  const x = new Float32Array(count)
  const y = new Float32Array(count)
  const tracks = Array.from(layers, (layer) => Math.max(1, Math.ceil((layer?.length ?? 0) / trackRows)))
  const rowsOf = Array.from(layers, (layer, r) => Math.ceil((layer?.length ?? 0) / tracks[r]))
  const tallest = Math.max(0, ...rowsOf)
  let left = 0
  let right = 0
  layers.forEach((layer = [], r) => {
    if (r > 0) left += (tracks[r - 1] - 1) * trackPitch + columnPitch
    layer.forEach((node, i) => {
      const track = Math.floor(i / rowsOf[r])
      const inTrack = Math.min(rowsOf[r], layer.length - track * rowsOf[r])
      x[node] = left + track * trackPitch
      y[node] = (i % rowsOf[r] + (tallest - inTrack) / 2) * rowPitch
    })
    right = left + (tracks[r] - 1) * trackPitch + nodeWidth
  })

  const nodeBounds = new Float32Array(count * 4)
  const edgeBounds = new Float32Array(from.length * 4)
  for (let i = 0; i < count; i++) writeNodeBounds(nodeBounds, x, y, i)
  for (let i = 0; i < from.length; i++) writeEdgeBounds(edgeBounds, x, y, from, to, i)
  return {
    ...topology, x, y,
    nodeIndex: buildIndex(nodeBounds),
    edgeIndex: buildIndex(edgeBounds),
    left: 0,
    top: 0,
    width: count ? right : 0,
    height: count ? (tallest - 1) * rowPitch + nodeHeight : 0,
    feedbackEdges,
  }
}

export function writeNodeBounds(bounds: Float32Array, x: Float32Array, y: Float32Array, node: number) {
  const offset = node * 4
  bounds[offset] = x[node]
  bounds[offset + 1] = y[node]
  bounds[offset + 2] = x[node] + nodeWidth
  bounds[offset + 3] = y[node] + nodeHeight
}

export function writeEdgeBounds(bounds: Float32Array, x: Float32Array, y: Float32Array, from: Uint32Array, to: Uint32Array, edge: number) {
  const offset = edge * 4
  const source = from[edge]
  const target = to[edge]
  // Covers both the card-to-card curve and the overview's centre-to-centre line.
  const x1 = Math.min(x[source], x[target])
  const x2 = Math.max(x[source], x[target]) + nodeWidth
  bounds[offset] = Math.min(x1, x2) - 12
  bounds[offset + 1] = Math.min(y[source], y[target]) + nodeHeight / 2 - 5
  bounds[offset + 2] = Math.max(x1, x2) + 12
  bounds[offset + 3] = Math.max(y[source], y[target]) + nodeHeight / 2 + 5
}
