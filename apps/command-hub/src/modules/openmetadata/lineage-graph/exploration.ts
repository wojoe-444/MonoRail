import type { Topology } from './topology'

export const hiddenNode = -2
const seed = -1

/** Each reveal owns the nodes it brought in. Every edge between visible nodes is drawn. */
export class Exploration {
  readonly root: number
  readonly owner: Int32Array
  readonly hidden: Uint32Array
  readonly children: Uint32Array
  visible: number[] = []
  visibleEdges = new Uint32Array(0)
  private expandedAll = false
  private rootCollapsed = false
  private readonly topology: Topology
  private readonly neighbours: number[][]

  constructor(topology: Topology, root: number) {
    this.topology = topology
    const { incoming, outgoing, from, to } = topology
    this.root = root >= 0 ? root : incoming.length ? 0 : -1
    this.owner = new Int32Array(incoming.length).fill(hiddenNode)
    this.hidden = new Uint32Array(incoming.length)
    this.children = new Uint32Array(incoming.length)
    this.neighbours = incoming.map((edges, node) => [
      ...new Set([...edges.map((edge) => from[edge]), ...outgoing[node].map((edge) => to[edge])]),
    ])
    if (this.root < 0) return
    this.add(this.root, seed)
    this.reveal(this.root)
    this.update()
  }

  private add(node: number, parent: number) {
    this.owner[node] = parent
    this.visible.push(node)
  }

  private reveal(node: number) {
    for (const neighbour of this.neighbours[node]) {
      if (this.owner[neighbour] === hiddenNode) this.add(neighbour, node)
    }
  }

  expand(node: number) {
    if (!this.hidden[node] || !this.has(node)) return false
    if (node === this.root) this.rootCollapsed = false
    this.reveal(node)
    this.update()
    return true
  }

  expandAll() {
    if (this.visible.length === this.owner.length) return false
    this.expandedAll = true
    this.rootCollapsed = false
    // Multi-source BFS gives each new node a nearby, previously visible ancestor.
    let head = 0
    const revealConnected = () => {
      while (head < this.visible.length) this.reveal(this.visible[head++])
    }
    revealConnected()
    for (let node = 0; node < this.owner.length; node++) {
      if (this.has(node)) continue
      this.add(node, this.root)
      revealConnected()
    }
    this.update()
    return true
  }

  collapse(node: number) {
    if (!this.children[node]) return false
    this.expandedAll = false
    if (node === this.root) this.rootCollapsed = true
    // Parents precede children. Keep the branch origin and all other branches.
    this.visible = this.visible.filter((asset) => {
      const parent = this.owner[asset]
      if (parent !== node && (parent < 0 || this.has(parent))) return true
      this.owner[asset] = hiddenNode
      return false
    })
    this.update()
    return true
  }

  restore(previous: Exploration, previousIds: Int32Array) {
    if (this.root < 0 || previous.root < 0) return
    if (previous.expandedAll) {
      this.expandAll()
      return
    }
    this.owner.fill(hiddenNode)
    this.visible = []
    this.add(this.root, seed)
    this.rootCollapsed = previous.rootCollapsed
    const newIds = new Map<number, number>()
    previousIds.forEach((old, node) => { if (old >= 0) newIds.set(old, node) })
    for (const old of previous.visible) {
      const node = newIds.get(old)
      const parent = newIds.get(previous.owner[old])
      if (node !== undefined && node !== this.root && parent !== undefined && this.has(parent)) {
        this.add(node, parent)
      }
    }
    if (!this.rootCollapsed) this.reveal(this.root)
    this.update()
  }

  has(node: number) {
    return node >= 0 && node < this.owner.length && this.owner[node] !== hiddenNode
  }

  private update() {
    const { from, to } = this.topology
    const edges: number[] = []
    this.children.fill(0)
    for (const node of this.visible) {
      const parent = this.owner[node]
      if (parent >= 0) this.children[parent]++
      let count = 0
      for (const neighbour of this.neighbours[node]) if (!this.has(neighbour)) count++
      this.hidden[node] = count
    }
    for (let edge = 0; edge < from.length; edge++) {
      if (this.has(from[edge]) && this.has(to[edge])) edges.push(edge)
    }
    this.visibleEdges = Uint32Array.from(edges)
  }
}
