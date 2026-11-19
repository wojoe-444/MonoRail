import type { OmRef } from '../types'
import { nodeHeight, nodeWidth, type LineageLayout } from './layout'
import { queryIndex, type Bounds } from './spatial'

export interface Camera {
  x: number
  y: number
  scale: number
}

export interface RenderOptions {
  batch: boolean
  cull: boolean
  lod: boolean
  cacheHighlight: boolean
}

const optimized: RenderOptions = { batch: true, cull: true, lod: true, cacheHighlight: true }
export const labelledScale = 0.4
const cardScale = 0.85

const colorTokens = {
  background: '--background',
  edge: '--muted-foreground',
  card: '--card',
  text: '--card-foreground',
  dot: '--muted-foreground',
  border: '--border',
  root: '--primary',
  selected: '--foreground',
  upstream: '--series-1',
  downstream: '--series-2',
  badge: '--primary-soft',
  badgeText: '--primary-soft-foreground',
}
type Theme = Record<keyof typeof colorTokens | 'font', string>

export function readTheme(container: HTMLElement): Theme {
  const style = getComputedStyle(container)
  return Object.fromEntries([
    ...Object.entries(colorTokens).map(([name, token]) => [name, style.getPropertyValue(token).trim()]),
    ['font', style.fontFamily],
  ]) as Theme
}

export function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number, deviceDpr: number, bulkAnimating = false) {
  // Limit the backing store during a bulk reveal. The final frame restores native detail.
  const dpr = Math.min(deviceDpr || 1, bulkAnimating ? 1 : 2)
  const pixelsWide = Math.round(width * dpr)
  const pixelsHigh = Math.round(height * dpr)
  if (canvas.width !== pixelsWide) canvas.width = pixelsWide
  if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh
  return dpr
}

export const assetLabel = (ref: OmRef) => ref.displayName || ref.name || ref.fullyQualifiedName || ref.id

export function fitCamera(layout: LineageLayout, width: number, height: number): Camera {
  const scale = Math.min(Math.max(1, width - 48) / Math.max(1, layout.width),
    Math.max(1, height - 48) / Math.max(1, layout.height), 1)
  return { x: (width - layout.width * scale) / 2 - layout.left * scale, y: (height - layout.height * scale) / 2 - layout.top * scale, scale }
}

export function centerCamera(layout: LineageLayout, node: number, width: number, height: number, scale: number): Camera {
  return { x: width / 2 - (layout.x[node] + nodeWidth / 2) * scale, y: height / 2 - (layout.y[node] + nodeHeight / 2) * scale, scale }
}

interface Highlight {
  nodes: Uint8Array
  edges: Uint8Array
}

function trace(layout: LineageLayout, selected: number): Highlight {
  const nodes = new Uint8Array(layout.x.length)
  const edges = new Uint8Array(layout.from.length)
  for (const direction of [1, 2]) {
    const adjacency = direction === 1 ? layout.incoming : layout.outgoing
    const endpoints = direction === 1 ? layout.from : layout.to
    const queue = [selected]
    nodes[selected] |= direction
    for (let i = 0; i < queue.length; i++) {
      for (const edge of adjacency[queue[i]]) {
        edges[edge] |= direction
        const node = endpoints[edge]
        if (nodes[node] & direction) continue
        nodes[node] |= direction
        queue.push(node)
      }
    }
  }
  return { nodes, edges }
}

export class LineageRenderer {
  readonly layout: LineageLayout
  readonly nodes: readonly OmRef[]
  readonly root: number
  private readonly hidden?: Uint32Array
  private theme: Theme
  private selection = -1
  private highlight?: Highlight
  private readonly highlights = new Map<number, Highlight>()
  private readonly visibleNodes: number[] = []
  private readonly visibleEdges: number[] = []
  private readonly hits: number[] = []
  private readonly stack: number[] = []
  private spawns?: Uint32Array
  private readonly coincidentEdges = new Set<number>()
  private readonly edgeGroups: number[][] = [[], [], []]
  private readonly badges = new Map<number, { label: string; width: number }>()
  private readonly labels = new Map<number, { width: number; name: string; compact: string; qualified: string; type: string }>()

  constructor(layout: LineageLayout, nodes: readonly OmRef[], root: number, theme: Theme, hidden?: Uint32Array) {
    this.hidden = hidden
    this.layout = layout
    this.nodes = nodes
    this.root = root
    this.theme = theme
  }

  setTheme(theme: Theme) {
    if (theme.font !== this.theme.font) {
      this.labels.clear()
      this.badges.clear()
    }
    this.theme = theme
  }

  select(node: number) {
    if (this.selection === node) return
    this.selection = node
    this.highlight = undefined
    if (node < 0) return
    let highlight = this.highlights.get(node)
    if (!highlight) highlight = trace(this.layout, node)
    // Bound the cache while supporting repeated selections across expansions.
    this.highlights.delete(node)
    if (this.highlights.size >= 16) this.highlights.delete(this.highlights.keys().next().value!)
    this.highlights.set(node, highlight)
    this.highlight = highlight
  }

  hit(camera: Camera, screenX: number, screenY: number) {
    const { scale } = camera
    const x = (screenX - camera.x) / scale
    const y = (screenY - camera.y) / scale
    const justDots = scale < labelledScale
    const radius = justDots ? 7 / scale : 0
    queryIndex(this.layout.nodeIndex, [x - radius, y - radius, x + radius, y + radius], this.hits, this.stack)
    if (!justDots) {
      return this.hits.findLast((node) => !this.spawns || this.spawns[node] === node) ?? -1
    }

    let result = -1
    let best = radius * radius
    for (const node of this.hits) {
      if (this.spawns && this.spawns[node] !== node) continue
      const dx = x - this.layout.x[node] - nodeWidth / 2
      const dy = y - this.layout.y[node] - nodeHeight / 2
      const distance = dx * dx + dy * dy
      if (distance > best) continue
      best = distance
      result = node
    }
    return result
  }

  private edgePath(ctx: CanvasRenderingContext2D, edge: number, detail: number) {
    const { x, y, from, to } = this.layout
    const source = from[edge]
    const target = to[edge]
    const y1 = y[source] + nodeHeight / 2
    const y2 = y[target] + nodeHeight / 2
    if (detail === 0) {
      // Overview zoom draws each asset as a dot at its card's centre: join the dots.
      ctx.moveTo(x[source] + nodeWidth / 2, y1)
      ctx.lineTo(x[target] + nodeWidth / 2, y2)
      return
    }
    const forward = x[source] < x[target]
    const x1 = x[source] + (forward ? nodeWidth : 0)
    const x2 = x[target] + (forward ? 0 : nodeWidth)
    ctx.moveTo(x1, y1)
    const mid = (x1 + x2) / 2
    ctx.bezierCurveTo(mid, y1, mid, y2, x2, y2)
    {
      const tip = x2 + (forward ? -2 : 2)
      const tail = tip + (forward ? -8 : 8)
      ctx.moveTo(tail, y2 - 4)
      ctx.lineTo(tip, y2)
      ctx.lineTo(tail, y2 + 4)
    }
  }

  private drawEdges(ctx: CanvasRenderingContext2D, ids: readonly number[] | Uint32Array, scale: number, detail: number, batch: boolean) {
    const groups = this.edgeGroups
    for (const group of groups) group.length = 0
    const { spawns, coincidentEdges } = this
    if (spawns) coincidentEdges.clear()
    const { from, to } = this.layout
    for (const edge of ids) {
      const mask = this.highlight?.edges[edge] ?? 0
      const style = mask & 1 ? 1 : mask & 2 ? 2 : 0
      if (spawns) {
        const source = spawns[from[edge]]
        const target = spawns[to[edge]]
        if (source === target) continue
        const key = (source * this.nodes.length + target) * 3 + style
        if (coincidentEdges.has(key)) continue
        coincidentEdges.add(key)
      }
      groups[style].push(edge)
    }
    for (let style = 0; style < groups.length; style++) {
      const group = groups[style]
      if (!group.length) continue
      ctx.strokeStyle = style === 0 ? this.theme.edge : style === 1 ? this.theme.upstream : this.theme.downstream
      ctx.globalAlpha = style === 0 ? (this.highlight ? 0.16 : 0.38) : 0.94
      ctx.lineWidth = (style === 0 ? 0.8 : 1.65) / scale
      ctx.beginPath()
      for (const edge of group) {
        this.edgePath(ctx, edge, detail)
        if (!batch) {
          ctx.stroke()
          ctx.beginPath()
        }
      }
      if (batch) ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private badgeFor(ctx: CanvasRenderingContext2D, hidden: number) {
    if (!hidden) return
    const cached = this.badges.get(hidden)
    if (cached) return cached
    const label = '+' + hidden
    ctx.font = `600 20px ${this.theme.font}`
    const badge = { label, width: Math.max(34, 14 + ctx.measureText(label).width) }
    this.badges.set(hidden, badge)
    return badge
  }

  private textFor(ctx: CanvasRenderingContext2D, node: number, width: number) {
    const cached = this.labels.get(node)
    if (cached?.width === width) return cached

    const { font } = this.theme
    function clip(value: string, width: number) {
      if (value.length <= 96 && ctx.measureText(value).width <= width) return value
      const characters = Array.from(value.slice(0, 96))
      let lo = 0
      let hi = characters.length
      while (lo < hi) {
        const middle = Math.ceil((lo + hi) / 2)
        if (ctx.measureText(characters.slice(0, middle).join('') + '…').width <= width) lo = middle
        else hi = middle - 1
      }
      return characters.slice(0, lo).join('') + '…'
    }

    const ref = this.nodes[node]
    ctx.font = `600 17px ${font}`
    const name = clip(assetLabel(ref), width)
    ctx.font = `600 23px ${font}`
    const compact = clip(assetLabel(ref), width)
    ctx.font = `12px ${font}`
    const qualified = clip(ref.fullyQualifiedName || ref.description || '', nodeWidth - 32)
    const type = clip(ref.type, nodeWidth - 32)
    const labels = { width, name, compact, qualified, type }
    this.labels.set(node, labels)
    return labels
  }

  private drawNodes(ctx: CanvasRenderingContext2D, ids: readonly number[] | Uint32Array, scale: number, detail: number) {
    const { x, y } = this.layout
    const { dot, root, selected, border, card, text, edge, upstream, downstream, font } = this.theme
    for (const node of ids) {
      // A new card shares its parent's pixels on the first frame of a reveal.
      if (this.spawns && this.spawns[node] !== node) continue
      const isSelected = node === this.selection
      const mask = this.highlight?.nodes[node] ?? 0
      const accent = isSelected ? selected : node === this.root ? root : mask & 1 ? upstream : mask & 2 ? downstream : ''
      const left = x[node]
      const top = y[node]
      if (!detail) {
        const size = Math.min(8, Math.max(accent ? 4 : 1.25, scale * 20)) / scale
        ctx.fillStyle = accent || dot
        ctx.globalAlpha = accent ? 1 : this.highlight ? 0.3 : 0.72
        ctx.fillRect(left + (nodeWidth - size) / 2, top + (nodeHeight - size) / 2, size, size)
        continue
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = card
      ctx.strokeStyle = accent || border
      ctx.lineWidth = (accent ? 2 : 1) / scale
      ctx.beginPath()
      ctx.roundRect(left, top, nodeWidth, nodeHeight, 10)
      ctx.fill()
      ctx.stroke()
      const badge = this.badgeFor(ctx, this.hidden?.[node] ?? 0)
      const labels = this.textFor(ctx, node, nodeWidth - 32 - (badge?.width ?? 0))
      ctx.fillStyle = text
      ctx.textBaseline = 'middle'
      if (detail === 1) {
        ctx.font = `600 23px ${font}`
        ctx.fillText(labels.compact, left + 16, top + 36)
      } else {
        ctx.font = `600 17px ${font}`
        ctx.fillText(labels.name, left + 16, top + 37)
        ctx.fillStyle = edge
        ctx.font = `12px ${font}`
        ctx.fillText(labels.type, left + 16, top + 16)
        ctx.fillText(labels.qualified, left + 16, top + 56)
      }
      if (badge) {
        const { label, width } = badge
        ctx.font = `600 20px ${font}`
        const x = left + nodeWidth - width - 8
        ctx.fillStyle = this.theme.badge
        ctx.beginPath()
        ctx.roundRect(x, top + 23, width, 26, 8)
        ctx.fill()
        ctx.fillStyle = this.theme.badgeText
        ctx.fillText(label, x + 7, top + 37)
      }
    }
    ctx.globalAlpha = 1
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, width: number, height: number, dpr: number, options = optimized, spawns?: Uint32Array) {
    this.spawns = spawns
    if (!options.cacheHighlight && this.selection >= 0) this.highlight = trace(this.layout, this.selection)
    // Glass palettes have transparent backgrounds. Painting over the previous
    // frame would leave trails as cards move, pan, or zoom.
    ctx.resetTransform()
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = this.theme.background
    ctx.fillRect(0, 0, width, height)

    const { x, y, scale } = camera
    const detail = !options.lod || scale >= cardScale ? 2 : scale >= labelledScale ? 1 : 0
    let nodes: number[] | Uint32Array = this.layout.nodeIndex.items
    let edges: number[] | Uint32Array = this.layout.edgeIndex.items
    if (options.cull) {
      const area: Bounds = [(-x - 10) / scale, (-y - 10) / scale, (width - x + 10) / scale, (height - y + 10) / scale]
      queryIndex(this.layout.nodeIndex, area, this.visibleNodes, this.stack)
      queryIndex(this.layout.edgeIndex, area, this.visibleEdges, this.stack)
      nodes = this.visibleNodes
      edges = this.visibleEdges
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, x * dpr, y * dpr)
    this.drawEdges(ctx, edges, scale, detail, options.batch)
    this.drawNodes(ctx, nodes, scale, detail)
    if (!detail) this.drawDotLabels(ctx, camera, dpr)
  }

  /** At overview zoom only dots are drawn: still name the root and the selection, in screen pixels. */
  private drawDotLabels(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number) {
    const { x, y } = this.layout
    const marked = [this.root, this.selection].filter((node, i, all) => node >= 0 && node < x.length && all.indexOf(node) === i)
    if (!marked.length || (this.spawns && marked.some((node) => this.spawns![node] !== node))) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `600 12px ${this.theme.font}`
    ctx.textBaseline = 'middle'
    for (const node of marked) {
      const label = assetLabel(this.nodes[node])
      const text = label.length > 48 ? label.slice(0, 47) + '…' : label
      const width = ctx.measureText(text).width + 12
      const sx = (x[node] + nodeWidth / 2) * camera.scale + camera.x + 8
      const sy = (y[node] + nodeHeight / 2) * camera.scale + camera.y
      ctx.globalAlpha = 0.92
      ctx.fillStyle = this.theme.card
      ctx.strokeStyle = node === this.selection ? this.theme.selected : this.theme.root
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(sx, sy - 10, width, 20, 6)
      ctx.fill()
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = this.theme.text
      ctx.fillText(text, sx + 6, sy + 0.5)
    }
  }
}
