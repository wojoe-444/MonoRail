import { nodeHeight, nodeWidth } from './layout'
import { QuadTree } from './quadtree'

const spacingX = nodeWidth + 16
const spacingY = nodeHeight + 16
const localPitch = 1.75
const decay = 0.89
const minAlpha = 0.016

export interface ForceInput {
  from: Uint32Array
  to: Uint32Array
  ranks: Uint32Array
  root: number
}

/** Benchmark controls for comparing the default solver with earlier stages. */
export interface ForceOptions {
  exact?: boolean
  reheatAll?: boolean
  coldStart?: boolean
}

export interface ForceRun {
  revision: number
  visible: Uint32Array
  edges: Uint32Array
  moving: Uint32Array
  parents: Int32Array
  positions: Float32Array
  options?: ForceOptions
}

/** Positions are in units of card width/height, with padding for labels and ports. */
export class ForceSimulation {
  private readonly input: ForceInput
  private readonly x: Float32Array
  private readonly y: Float32Array
  private readonly vx: Float32Array
  private readonly vy: Float32Array
  private readonly targetX: Float32Array
  private readonly targetY: Float32Array
  private readonly degree: Uint32Array
  private readonly pinned: Uint8Array
  private readonly tree: QuadTree
  private readonly stack = new Int32Array(64)
  private readonly weights: Float32Array
  private readonly rank: Uint32Array
  private readonly visible: Uint32Array
  private readonly moving: Uint32Array
  private readonly edges: Uint32Array
  private readonly exact: boolean
  private readonly pitch: number
  private readonly rankStrength: number
  private alpha = 1

  constructor(input: ForceInput, run: ForceRun) {
    this.input = input
    const { ranks, from, to, root } = input
    const count = ranks.length
    const { visible, positions, edges, parents, options } = run
    this.visible = visible
    this.moving = options?.reheatAll ? visible.filter((node) => node !== root) : run.moving
    this.edges = edges
    this.exact = Boolean(options?.exact)
    this.x = new Float32Array(count)
    this.y = new Float32Array(count)
    this.vx = new Float32Array(count)
    this.vy = new Float32Array(count)
    this.targetX = new Float32Array(count)
    this.targetY = new Float32Array(count)
    this.pinned = new Uint8Array(count).fill(1)
    for (const node of this.moving) this.pinned[node] = 0
    this.tree = new QuadTree(count)
    this.rank = ranks
    this.degree = new Uint32Array(count)
    this.weights = new Float32Array(from.length)
    for (const edge of edges) {
      this.degree[from[edge]]++
      this.degree[to[edge]]++
    }
    for (const edge of edges) {
      this.weights[edge] = 1 / Math.sqrt(Math.min(this.degree[from[edge]], this.degree[to[edge]]))
    }

    const rootX = positions[root] / spacingX
    const rootY = positions[root + count] / spacingY
    const rootRank = ranks[root]
    const bulk = this.moving.length >= 256
    const byRank = new Map<number, number[]>()
    for (const node of visible) {
      const anchorX = positions[node] / spacingX
      const anchorY = positions[node + count] / spacingY
      // Break symmetry on the first physics tick. The renderer starts at the exact parent position.
      const angle = node * 2.399963229728653
      this.x[node] = anchorX + (this.pinned[node] ? 0 : Math.cos(angle) * 0.3)
      this.y[node] = anchorY + (this.pinned[node] ? 0 : Math.sin(angle) * 0.3)
      this.targetY[node] = anchorY
      if (!bulk) {
        const parent = parents[node]
        const delta = parent < 0 ? 0 : ranks[node] - ranks[parent]
        const parentX = parent < 0 ? anchorX : positions[parent] / spacingX
        this.targetX[node] = parentX + Math.max(-2, Math.min(2, delta)) * localPitch
        continue
      }
      let band = byRank.get(ranks[node])
      if (!band) byRank.set(ranks[node], band = [])
      band.push(node)
    }
    const tracks = bulk ? Math.max(3, Math.ceil(Math.sqrt(visible.length) / Math.sqrt(byRank.size) / 3)) : 1
    this.pitch = bulk ? tracks * 1.38 + 0.65 : localPitch
    this.rankStrength = bulk ? 0.05 : 0.085
    for (const [rank, band] of byRank) {
      const cx = rootX + (rank - rootRank) * this.pitch
      band.sort((a, b) => a - b)
      for (let i = 0; i < band.length; i++) {
        const node = band[i]
        this.targetX[node] = cx
        if (this.pinned[node]) continue
        const rows = Math.ceil(band.length / tracks)
        const sx = cx + (i % tracks - (tracks - 1) / 2) * 1.28 + Math.sin(i * 3.13 + rank) * 0.18
        const sy = rootY + (Math.floor(i / tracks) - (rows - 1) / 2) * 1.18 + Math.cos(i * 2.39 + rank) * 0.24
        this.targetX[node] = cx * 0.4 + sx * 0.6
        this.targetY[node] = sy
        if (!options?.coldStart) {
          this.x[node] = sx
          this.y[node] = sy
        }
      }
    }
  }

  tick() {
    this.alpha *= decay
    const alpha = this.alpha
    const { x, y, vx, vy, targetX, targetY, visible, moving, pinned, exact, tree } = this
    if (!exact) tree.build(visible, x, y)
    for (const node of moving) {
      vx[node] += (targetX[node] - x[node]) * this.rankStrength * alpha
      vy[node] += (targetY[node] - y[node]) * 0.012 * alpha
      this.repel(node, alpha)
    }
    const { from, to } = this.input
    for (const edge of this.edges) {
      const source = from[edge]
      const target = to[edge]
      if (pinned[source] && pinned[target]) continue
      const rankDelta = this.rank[target] - this.rank[source]
      const preferredX = Math.max(-2, Math.min(2, rankDelta)) * this.pitch
      const dx = Math.max(-6, Math.min(6, x[target] - x[source] - preferredX)) * 0.12
      const dy = Math.max(-6, Math.min(6, y[target] - y[source])) * 0.115
      const gain = this.weights[edge] * alpha
      const total = this.degree[source] + this.degree[target]
      if (!pinned[source]) {
        const share = (pinned[target] ? 1 : this.degree[target] / total) * gain
        vx[source] += dx * share
        vy[source] += dy * share
      }
      if (!pinned[target]) {
        const share = (pinned[source] ? 1 : this.degree[source] / total) * gain
        vx[target] -= dx * share
        vy[target] -= dy * share
      }
    }
    for (const node of moving) {
      vx[node] = Math.max(-2.3, Math.min(2.3, vx[node] * 0.64))
      vy[node] = Math.max(-2.3, Math.min(2.3, vy[node] * 0.64))
      x[node] += vx[node]
      y[node] += vy[node]
    }
    if (alpha > minAlpha) return false
    this.separateCards()
    return true
  }

  private repel(node: number, alpha: number) {
    const { x, y, pinned, tree, stack } = this
    const px = x[node]
    const py = y[node]
    const charge = 0.18 * alpha
    let fx = 0
    let fy = 0

    let size = 1
    stack[0] = 0
    let direct = this.exact ? 0 : -1
    let member = -1
    while (size || member >= 0) {
      if (this.exact) {
        if (direct === this.visible.length) break
        member = this.visible[direct++]
      } else if (member < 0) {
        const quad = stack[--size]
        const weight = tree.mass[quad]
        if (!weight) continue
        const { half, midX, midY, first, centerX, centerY } = tree
        const dx = px - centerX[quad]
        const dy = py - centerY[quad]
        const r2 = dx * dx + dy * dy
        const h = half[quad]
        // Keep collision neighbourhoods exact, and never approximate a quad containing this node.
        if (h * h * 4 < 0.95 * 0.95 * r2 &&
          (Math.abs(px - midX[quad]) > h + 1 || Math.abs(py - midY[quad]) > h + 1)) {
          const gain = weight * charge / (r2 + 0.3)
          fx += dx * gain
          fy += dy * gain
          continue
        }
        const child = first[quad]
        if (child >= 0) {
          stack[size++] = child
          stack[size++] = child + 1
          stack[size++] = child + 2
          stack[size++] = child + 3
          continue
        }
        member = tree.head[quad]
      }
      const other = member
      member = this.exact ? -1 : tree.next[other]
      if (other === node) continue
      const dx = px - x[other]
      const dy = py - y[other]
      const r2 = dx * dx + dy * dy
      const repulsion = charge / (r2 + 0.3)
      fx += dx * repulsion
      fy += dy * repulsion
      const ox = 1 - Math.abs(dx)
      const oy = 1 - Math.abs(dy)
      if (ox > 0 && oy > 0) {
        const gain = pinned[other] ? 1.05 : 0.57
        if (ox < oy) fx += (dx > 0 || (dx === 0 && node > other) ? 1 : -1) * ox * gain
        else fy += (dy > 0 || (dy === 0 && node > other) ? 1 : -1) * oy * gain
      }
    }
    this.vx[node] += fx
    this.vy[node] += fy
  }

  /** Resolve residual intersections after cooling with nearby empty positions. */
  private separateCards() {
    const { x, y, visible, pinned, moving } = this
    const size = 0.99
    const buckets = new Map<string, number[]>()
    function key(col: number, row: number) { return col + ',' + row }
    function place(node: number) {
      const id = key(Math.floor(x[node]), Math.floor(y[node]))
      const bucket = buckets.get(id)
      if (bucket) bucket.push(node)
      else buckets.set(id, [node])
    }
    function free(px: number, py: number) {
      const col = Math.floor(px)
      const row = Math.floor(py)
      for (let j = row - 1; j <= row + 1; j++) {
        for (let i = col - 1; i <= col + 1; i++) {
          const bucket = buckets.get(key(i, j))
          if (!bucket) continue
          for (const other of bucket) {
            if (Math.abs(px - x[other]) < size && Math.abs(py - y[other]) < size) return false
          }
        }
      }
      return true
    }
    for (const node of visible) if (pinned[node]) place(node)
    for (const node of moving) {
      const px = x[node]
      const py = y[node]
      let moved = free(px, py)
      for (let ring = 1; !moved; ring++) {
        for (let i = 0; i < ring * 8; i++) {
          // Start along y (a smaller shift in world space) to preserve rank.
          const angle = Math.PI / 2 + (i + (node & 1) * 4 * ring) * Math.PI / (4 * ring)
          const nx = px + Math.cos(angle) * ring * 0.28
          const ny = py + Math.sin(angle) * ring * 0.28
          if (!free(nx, ny)) continue
          x[node] = nx
          y[node] = ny
          moved = true
          break
        }
      }
      place(node)
    }
  }

  snapshot(positions: Float32Array) {
    for (const node of this.visible) {
      positions[node] = this.x[node] * spacingX
      positions[node + this.x.length] = this.y[node] * spacingY
    }
  }
}
