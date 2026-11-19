import { Exploration, hiddenNode } from './exploration'
import { rankColumns, type ForceOptions, type ForceRun } from './force'
import ForceWorker from './force.worker?worker&inline'
import type { ForceRequest, ForceResponse, ForceTiming } from './force.worker'
import { writeEdgeBounds, writeNodeBounds, type LineageLayout } from './layout'
import { buildIndex, refitIndex } from './spatial'
import { rankTopology, type Topology } from './topology'

/** Visible topology and interpolated geometry, shared by the component and the benchmark. */
export class ForceView {
  readonly exploration: Exploration
  readonly layout: LineageLayout
  private readonly worker: Worker
  private readonly columns: Float32Array
  private readonly x: Float32Array
  private readonly y: Float32Array
  private readonly spawnOrigins: Uint32Array
  private readonly known: Uint8Array
  private readonly settled: Uint8Array
  private readonly target: Float32Array
  private readonly nodeBounds: Float32Array
  private readonly edgeBounds: Float32Array
  private revision = 0
  private showSpawns = false
  private hasTarget = false
  private lastFrame = 0
  private finalAt = 0
  private moving = new Uint32Array(0)
  timing?: ForceTiming
  running = false

  constructor(topology: Topology, root: number, redraw: () => void, error: (message: string) => void, ready?: () => void) {
    const count = topology.incoming.length
    const { ranks, feedbackEdges } = rankTopology(topology)
    this.columns = rankColumns(ranks).x
    this.exploration = new Exploration(topology, root)
    this.x = new Float32Array(count)
    this.y = new Float32Array(count)
    this.spawnOrigins = new Uint32Array(count)
    this.known = new Uint8Array(count)
    this.settled = new Uint8Array(count)
    this.target = new Float32Array(count * 2)
    this.nodeBounds = new Float32Array(count * 4)
    this.edgeBounds = new Float32Array(topology.from.length * 4)
    this.layout = {
      ...topology, x: this.x, y: this.y, feedbackEdges,
      left: 0, top: 0, width: 0, height: 0,
      nodeIndex: buildIndex(this.nodeBounds, []),
      edgeIndex: buildIndex(this.edgeBounds, []),
    }
    this.worker = new ForceWorker()
    this.worker.onmessage = ({ data }: MessageEvent<ForceResponse>) => {
      if ('ready' in data) {
        ready?.()
        return
      }
      if ('error' in data) {
        this.running = false
        error(data.error)
        return
      }
      if (data.revision === this.revision) {
        this.target.set(data.positions)
        this.hasTarget = true
        if (data.timing) {
          this.timing = data.timing
          this.finalAt = performance.now()
        }
        redraw()
      }
      this.worker.postMessage({ type: 'release', positions: data.positions } satisfies ForceRequest, [data.positions.buffer])
    }
    this.worker.onerror = (event) => {
      this.running = false
      error(event.message || 'Could not start the lineage simulation.')
    }
    const from = topology.from.slice()
    const to = topology.to.slice()
    this.worker.postMessage({
      type: 'init', input: { from, to, ranks, root: this.exploration.root },
    } satisfies ForceRequest, [from.buffer, to.buffer])
  }

  restore(previous: ForceView, previousIds: Int32Array) {
    this.exploration.restore(previous.exploration, previousIds)
    for (const node of this.exploration.visible) {
      const old = previousIds[node]
      if (!previous.exploration.has(old)) continue
      this.known[node] = 1
      this.settled[node] = previous.settled[old]
      this.x[node] = previous.x[old]
      this.y[node] = previous.y[old]
    }
    // A new snapshot (another depth) can change ranks: an asset no longer in
    // its rank's column moves again, so lineage keeps reading left to right.
    const root = this.exploration.root
    if (root < 0 || !this.known[root]) return
    for (const node of this.exploration.visible) {
      const column = this.x[root] + this.columns[node] - this.columns[root]
      if (this.known[node] && Math.abs(this.x[node] - column) > 1) this.settled[node] = 0
    }
  }

  refresh(options?: ForceOptions) {
    const { owner, visible, visibleEdges, root } = this.exploration
    const count = owner.length
    const { x, y } = this
    const moving: number[] = []
    for (let node = 0; node < count; node++) {
      if (owner[node] !== hiddenNode) continue
      this.known[node] = 0
      this.settled[node] = 0
    }
    for (const node of visible) {
      const parent = owner[node]
      this.spawnOrigins[node] = node
      if (!this.known[node]) {
        if (parent >= 0) this.spawnOrigins[node] = this.spawnOrigins[parent]
        x[node] = parent < 0 ? 0 : x[parent]
        y[node] = parent < 0 ? 0 : y[parent]
        this.known[node] = 1
      }
      if (node !== root && (!this.settled[node] || options?.reheatAll)) moving.push(node)
    }
    if (root >= 0) this.settled[root] = 1
    this.updateBounds(true)
    this.revision++
    this.showSpawns = moving.length > 0
    this.hasTarget = false
    this.lastFrame = 0
    this.finalAt = 0
    this.timing = undefined
    this.running = moving.length > 0
    this.moving = Uint32Array.from(moving)
    const positions = new Float32Array(count * 2)
    positions.set(x)
    positions.set(y, count)
    const run: ForceRun = {
      revision: this.revision, visible: Uint32Array.from(visible), edges: visibleEdges.slice(),
      moving: this.moving.slice(), parents: owner.slice(), positions, options,
    }
    this.worker.postMessage({ type: 'run', run } satisfies ForceRequest, [
      run.visible.buffer, run.edges.buffer, run.moving.buffer, run.parents.buffer, positions.buffer,
    ])
  }

  get spawns() {
    return this.running && !this.lastFrame ? this.spawnOrigins : undefined
  }

  get bulkAnimating() {
    return this.running && this.moving.length >= 256
  }

  // Return whether another frame is needed. Worker messages request frames while idle.
  advance(now: number, rebuildIndex = false) {
    if (this.showSpawns) {
      this.showSpawns = false
      return this.hasTarget
    }
    if (!this.hasTarget) return false
    const { target, x, y, moving } = this
    const done = this.finalAt > 0 && now >= this.finalAt + 60
    const blend = done ? 1 : 1 - Math.exp(-Math.max(1, this.lastFrame ? now - this.lastFrame : 16.7) / 25)
    this.lastFrame = now
    let changed = false
    for (const node of moving) {
      const dx = target[node] - x[node]
      const dy = target[node + x.length] - y[node]
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && !done) continue
      x[node] += dx * blend
      y[node] += dy * blend
      changed = true
    }
    if (changed || done) this.updateBounds(rebuildIndex || done)
    if (done) {
      for (const node of moving) this.settled[node] = 1
      this.running = false
      this.hasTarget = false
    }
    return !done && (changed || this.finalAt > 0)
  }

  private updateBounds(rebuild: boolean) {
    const { layout, nodeBounds, edgeBounds, x, y } = this
    const { visible, visibleEdges } = this.exploration
    for (const node of visible) writeNodeBounds(nodeBounds, x, y, node)
    for (const edge of visibleEdges) writeEdgeBounds(edgeBounds, x, y, layout.from, layout.to, edge)
    if (rebuild) {
      layout.nodeIndex = buildIndex(nodeBounds, visible)
      layout.edgeIndex = buildIndex(edgeBounds, visibleEdges)
    } else {
      refitIndex(layout.nodeIndex)
      refitIndex(layout.edgeIndex)
    }
    const bounds = layout.nodeIndex.bounds
    layout.left = bounds[0] ?? 0
    layout.top = bounds[1] ?? 0
    layout.width = (bounds[2] ?? 0) - layout.left
    layout.height = (bounds[3] ?? 0) - layout.top
  }

  dispose() {
    this.running = false
    this.hasTarget = false
    this.worker.terminate()
  }
}
