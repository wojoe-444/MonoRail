import { nodeHeight, nodeWidth } from './layout'
import { QuadTree } from './quadtree'

const spacingX = nodeWidth + 16
const spacingY = nodeHeight + 16
/** Card widths between two tracks of one rank, and the extra gap between ranks (room for the curves). */
const trackPitch = 1.12
const rankGap = 0.33
/** A rank with more assets than this wraps into side-by-side tracks, so a huge rank is not one endless column. */
const trackRows = 30

/**
 * Where each asset sits across, in world pixels from rank 0, and its row slot
 * in its track. Ranks run left to right (upstream always left of downstream),
 * each as wide as it needs: ceil(assets / trackRows) tracks, an asset's track
 * by its order in the rank. Worked out from the whole snapshot, so nothing
 * moves sideways as branches open.
 */
export function rankColumns(ranks: Uint32Array) {
  const count = ranks.length
  let maxRank = 0
  for (let i = 0; i < count; i++) maxRank = Math.max(maxRank, ranks[i])
  const perRank = new Uint32Array(maxRank + 1)
  for (let i = 0; i < count; i++) perRank[ranks[i]]++
  const tracks = Array.from(perRank, (n) => Math.max(1, Math.ceil(n / trackRows)))
  const start = new Float64Array(maxRank + 1)
  for (let r = 1; r <= maxRank; r++) start[r] = start[r - 1] + tracks[r - 1] * trackPitch + rankGap
  const seen = new Uint32Array(maxRank + 1)
  const x = new Float32Array(count)
  const slot = new Float32Array(count)
  const rows = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = ranks[i]
    const ordinal = seen[r]++
    const t = tracks[r]
    x[i] = (start[r] + (ordinal % t) * trackPitch) * spacingX
    slot[i] = Math.floor(ordinal / t)
    rows[i] = Math.ceil(perRank[r] / t)
  }
  return { x, slot, rows }
}
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
  private readonly visible: Uint32Array
  private readonly moving: Uint32Array
  private readonly edges: Uint32Array
  private readonly exact: boolean
  private alpha = 1

  constructor(input: ForceInput, run: ForceRun) {
    this.input = input
    const { ranks, from, to, root } = input
    const count = ranks.length
    const { visible, positions, edges, options } = run
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
    const columns = rankColumns(ranks)
    const bulk = this.moving.length >= 256
    const byRank = new Map<number, number[]>()
    for (const node of visible) {
      const anchorX = positions[node] / spacingX
      const anchorY = positions[node + count] / spacingY
      // x is fixed to the rank's column, so lineage always reads left to right.
      // Only y is simulated. A settled (pinned) asset keeps where it is.
      const column = rootX + (columns.x[node] - columns.x[root]) / spacingX
      this.targetX[node] = this.pinned[node] ? anchorX : column
      this.x[node] = this.targetX[node]
      // Break symmetry on the first physics tick. The renderer starts at the exact parent position.
      const angle = node * 2.399963229728653
      this.y[node] = anchorY + (this.pinned[node] ? 0 : Math.sin(angle) * 0.3)
      this.targetY[node] = anchorY
      if (!bulk || this.pinned[node]) continue
      let band = byRank.get(ranks[node])
      if (!band) byRank.set(ranks[node], band = [])
      band.push(node)
    }
    // A large reveal starts each track as an evenly spaced stack around the
    // root's row, so thousands of coincident seeds do not overwhelm collision.
    for (const band of byRank.values()) {
      for (const node of band) {
        const sy = rootY + (columns.slot[node] - (columns.rows[node] - 1) / 2) * 1.12
        this.targetY[node] = sy
        if (!options?.coldStart) this.y[node] = sy
      }
    }
  }

  tick() {
    this.alpha *= decay
    const alpha = this.alpha
    const { x, y, vx, vy, targetX, targetY, visible, moving, pinned, exact, tree } = this
    if (!exact) tree.build(visible, x, y)
    for (const node of moving) {
      vy[node] += (targetY[node] - y[node]) * 0.012 * alpha
      this.repel(node, alpha)
    }
    const { from, to } = this.input
    for (const edge of this.edges) {
      const source = from[edge]
      const target = to[edge]
      if (pinned[source] && pinned[target]) continue
      // Connected assets pull toward the same row, which keeps edges short and flat.
      const dy = Math.max(-6, Math.min(6, y[target] - y[source])) * 0.115
      const gain = this.weights[edge] * alpha
      const total = this.degree[source] + this.degree[target]
      if (!pinned[source]) vy[source] += dy * (pinned[target] ? 1 : this.degree[target] / total) * gain
      if (!pinned[target]) vy[target] -= dy * (pinned[source] ? 1 : this.degree[source] / total) * gain
    }
    for (const node of moving) {
      vx[node] = 0
      vy[node] = Math.max(-2.3, Math.min(2.3, vy[node] * 0.64))
      x[node] = targetX[node]
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
      // Only along y: an asset never leaves its rank's column.
      for (let ring = 1; !moved; ring++) {
        for (const side of node & 1 ? [1, -1] : [-1, 1]) {
          const ny = py + side * ring * 0.28
          if (!free(px, ny)) continue
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
