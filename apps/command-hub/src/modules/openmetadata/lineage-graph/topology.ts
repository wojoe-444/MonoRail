import type { OmLineageEdge } from '../types'

export interface Topology {
  from: Uint32Array
  to: Uint32Array
  incoming: number[][]
  outgoing: number[][]
}

export function makeTopology(indexes: ReadonlyMap<string, number>, edges: readonly Pick<OmLineageEdge, 'fromEntity' | 'toEntity'>[]): Topology {
  const count = indexes.size
  const incoming: number[][] = Array.from({ length: count }, () => [])
  const outgoing: number[][] = Array.from({ length: count }, () => [])
  const fromList: number[] = []
  const toList: number[] = []
  const seen = new Set<number>()
  for (const edge of edges) {
    const from = indexes.get(edge.fromEntity)
    const to = indexes.get(edge.toEntity)
    if (from === undefined || to === undefined || from === to) continue
    const pair = from * count + to
    if (seen.has(pair)) continue
    seen.add(pair)
    const id = fromList.length
    fromList.push(from)
    toList.push(to)
    outgoing[from].push(id)
    incoming[to].push(id)
  }
  return { from: Uint32Array.from(fromList), to: Uint32Array.from(toList), incoming, outgoing }
}

/** Longest-path ranks. Iterative DFS excludes feedback edges from rank assignment. */
export function rankTopology({ from, to, outgoing }: Topology) {
  const count = outgoing.length
  const visiting = new Uint8Array(count)
  const backEdge = new Uint8Array(from.length)
  const order: number[] = []
  const stack: number[] = []
  const cursors: number[] = []
  let feedbackEdges = 0
  for (let start = 0; start < count; start++) {
    if (visiting[start]) continue
    stack.push(start)
    cursors.push(0)
    visiting[start] = 1
    while (stack.length) {
      const depth = stack.length - 1
      const node = stack[depth]
      const next = cursors[depth]++
      if (next >= outgoing[node].length) {
        visiting[node] = 2
        order.push(node)
        stack.pop()
        cursors.pop()
        continue
      }
      const edge = outgoing[node][next]
      const target = to[edge]
      if (visiting[target] === 1) {
        backEdge[edge] = 1
        feedbackEdges++
      } else if (visiting[target] === 0) {
        visiting[target] = 1
        stack.push(target)
        cursors.push(0)
      }
    }
  }

  const ranks = new Uint32Array(count)
  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i]
    for (const edge of outgoing[node]) {
      if (!backEdge[edge]) ranks[to[edge]] = Math.max(ranks[to[edge]], ranks[node] + 1)
    }
  }
  return { ranks, backEdge, feedbackEdges }
}
