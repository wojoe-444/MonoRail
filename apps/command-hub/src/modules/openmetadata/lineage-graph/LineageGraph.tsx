import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { LocateFixed, Maximize, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OmLineageEdge, OmRef } from '../types'
import { nodeHeight, nodeWidth, type LayoutRequest, type LineageLayout } from './layout'
import LayoutWorker from './layout.worker?worker&inline'
import type { LayoutResponse } from './layout.worker'
import { ForceView } from './force-view'
import { makeTopology } from './topology'
import { assetLabel, centerCamera, fitCamera, labelledScale, LineageRenderer, readTheme, sizeCanvas, type Camera } from './renderer'

export interface LineageGraphProps {
  /** Include the root entity. Inputs are immutable snapshots. */
  nodes: readonly OmRef[]
  edges: readonly OmLineageEdge[]
  rootId: string
  onOpen: (ref: OmRef) => void
  className?: string
  /** Initial layout. The toolbar can switch either mode. */
  layout?: 'force' | 'layered'
}

interface Graph {
  layout: LineageLayout
  nodes: OmRef[]
  indexes: Map<string, number>
  force?: ForceView
}

interface Gesture {
  id: number
  x: number
  y: number
  start: Camera
  moved: boolean
}

const focusScale = 0.9

export function LineageGraph({ nodes, edges, rootId, onOpen, className, layout = 'force' }: LineageGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<LineageRenderer>(null)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 })
  const size = useRef({ width: 0, height: 0 })
  const frame = useRef(0)
  const gesture = useRef<Gesture>(null)
  const lastLayout = useRef<Graph>(null)
  const lastForce = useRef<{ graph: Graph; rootId: string }>(null)
  const presented = useRef<{ graph: Graph; rootId: string }>(null)
  const selectedId = useRef<string>(null)
  const [layoutChoice, setLayoutChoice] = useState({ prop: layout, mode: layout })
  const mode = layoutChoice.prop === layout ? layoutChoice.mode : layout
  if (layoutChoice.prop !== layout) setLayoutChoice({ prop: layout, mode: layout })
  const [, setVisibility] = useState(0)
  const [graph, setGraph] = useState<Graph>()
  const [selected, setSelected] = useState<OmRef>()
  const [result, setResult] = useState<{ nodes: readonly OmRef[]; edges: readonly OmLineageEdge[]; mode: typeof layout; rootId: string; error?: string }>()
  const current = result?.nodes === nodes && result.edges === edges && result.mode === mode && result.rootId === rootId
  const error = current ? result.error : undefined
  const status = !current ? 'Calculating lineage layout…' : error || (!graph?.nodes.length ? 'No lineage assets to display.' : '')

  const redraw = useCallback(function schedule() {
    if (frame.current) return
    frame.current = requestAnimationFrame((now) => {
      frame.current = 0
      const canvas = canvasRef.current
      const renderer = rendererRef.current
      const { width, height } = size.current
      if (!canvas || !renderer || !width || !height) return

      const force = presented.current?.graph.force
      const moving = force?.advance(now)
      const spawns = force?.spawns
      const dpr = sizeCanvas(canvas, width, height, window.devicePixelRatio, force?.bulkAnimating)
      const ctx = canvas.getContext('2d')
      if (ctx) renderer.draw(ctx, cameraRef.current, width, height, dpr, undefined, spawns)
      const count = String(force?.exploration.visible.length ?? renderer.nodes.length)
      if (canvas.dataset.visibleAssets !== count) canvas.dataset.visibleAssets = count
      if (moving) schedule()
    })
  }, [])

  useEffect(() => {
    const unique = new Map<string, OmRef>()
    for (const node of nodes) if (!unique.has(node.id)) unique.set(node.id, node)
    const refs = [...unique.values()]
    const nodeIds = [...unique.keys()]
    const indexes = new Map(nodeIds.map((id, i) => [id, i]))
    const previous = lastLayout.current
    const previousOrder = previous && new Map(previous.nodes.map((ref, i) =>
      [ref.id, previous.layout.y[i] / Math.max(1, previous.layout.height)]))

    function fail(message: string) {
      setResult({ nodes, edges, mode, rootId, error: message })
    }
    if (mode === 'force') {
      let force: ForceView | undefined
      try {
        const view = new ForceView(makeTopology(indexes, edges), indexes.get(rootId) ?? -1, redraw, fail, () => {
          const next = { layout: view.layout, nodes: refs, indexes, force: view }
          lastForce.current = { graph: next, rootId }
          setGraph(next)
          setResult({ nodes, edges, mode, rootId })
        })
        force = view
        const prior = lastForce.current
        if (prior?.rootId === rootId && prior.graph.force) {
          force.restore(prior.graph.force, Int32Array.from(refs, (ref) => prior.graph.indexes.get(ref.id) ?? -1))
        }
        force.refresh()
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : 'Could not start the lineage simulation.')
      }
      return () => force?.dispose()
    }

    let worker: Worker | undefined
    try {
      worker = new LayoutWorker()
      worker.onmessage = ({ data }: MessageEvent<LayoutResponse>) => {
        worker?.terminate()
        if ('error' in data) {
          fail(data.error)
          return
        }
        const next = { layout: data.layout, nodes: refs, indexes }
        lastLayout.current = next
        setGraph(next)
        setResult({ nodes, edges, mode, rootId })
      }
      worker.onerror = (event) => {
        worker?.terminate()
        fail(event.message || 'Could not start the lineage layout worker.')
      }
      worker.postMessage({
        nodeIds,
        edges: edges.map(({ fromEntity, toEntity }) => ({ fromEntity, toEntity })),
        previousOrder: previousOrder || undefined,
      } satisfies LayoutRequest)
    } catch (cause) {
      worker?.terminate()
      fail(cause instanceof Error ? cause.message : 'Could not start the lineage layout worker.')
    }

    return () => worker?.terminate()
  }, [nodes, edges, mode, rootId, redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !graph) return
    const { layout, indexes } = graph
    const root = graph.force?.exploration.root ?? indexes.get(rootId) ?? -1
    const renderer = new LineageRenderer(layout, graph.nodes, root, readTheme(canvas), graph.force?.exploration.hidden)
    const prior = presented.current
    const { width, height } = size.current
    if (prior?.rootId === rootId && prior.graph.nodes.length && (root < 0 || prior.graph.indexes.has(rootId))) {
      // An expansion can move ranks or rows. Keep the selected asset (or root)
      // at its old screen position while the rest of the graph reflows.
      const selectedIndex = selectedId.current === null ? undefined : indexes.get(selectedId.current)
      const anchor = selectedIndex !== undefined && (!graph.force || graph.force.exploration.has(selectedIndex))
        ? selectedId.current! : rootId
      const oldIndex = prior.graph.indexes.get(anchor)
      const newIndex = indexes.get(anchor)
      if (oldIndex !== undefined && newIndex !== undefined) {
        const camera = cameraRef.current
        const dx = (prior.graph.layout.x[oldIndex] - layout.x[newIndex]) * camera.scale
        const dy = (prior.graph.layout.y[oldIndex] - layout.y[newIndex]) * camera.scale
        cameraRef.current = { ...camera, x: camera.x + dx, y: camera.y + dy }
        const drag = gesture.current
        if (drag) drag.start = { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }
      }
    } else {
      selectedId.current = null
      gesture.current = null
      delete canvas.dataset.dragging
      cameraRef.current = root >= 0
        ? centerCamera(layout, root, width, height, focusScale)
        : fitCamera(layout, width, height)
    }
    let selection = selectedId.current === null ? -1 : indexes.get(selectedId.current) ?? -1
    if (graph.force && !graph.force.exploration.has(selection)) selection = -1
    selectedId.current = graph.nodes[selection]?.id ?? null
    setSelected(graph.nodes[selection])
    renderer.select(selection)
    rendererRef.current = renderer
    presented.current = { graph, rootId }
    redraw()
  }, [graph, rootId, redraw])

  const zoom = useCallback((factor: number, x: number, y: number) => {
    const renderer = rendererRef.current
    if (!renderer) return
    const camera = cameraRef.current
    const { width, height } = size.current
    const minimum = Math.min(0.08, fitCamera(renderer.layout, width, height).scale)
    const scale = Math.min(2, Math.max(minimum, camera.scale * factor))
    const ratio = scale / camera.scale
    cameraRef.current = { x: x - (x - camera.x) * ratio, y: y - (y - camera.y) * ratio, scale }
    redraw()
  }, [redraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const previous = size.current
      if (width && height) {
        const view = cameraRef.current
        cameraRef.current = { ...view, x: view.x + (width - previous.width) / 2, y: view.y + (height - previous.height) / 2 }
        size.current = { width, height }
      }
      redraw()
    }
    const observer = new ResizeObserver(resize)
    resize()
    observer.observe(canvas)
    window.addEventListener('resize', resize)

    const themeObserver = new MutationObserver(() => {
      rendererRef.current?.setTheme(readTheme(canvas))
      redraw()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-palette', 'data-theme'] })

    const wheel = (event: WheelEvent) => {
      // Never scroll the page from inside the graph, even mid-drag.
      event.preventDefault()
      if (!rendererRef.current || gesture.current) return
      const bounds = canvas.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit))
      zoom(Math.exp(-delta * 0.002), event.clientX - bounds.left, event.clientY - bounds.top)
    }
    canvas.addEventListener('wheel', wheel, { passive: false })

    return () => {
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('wheel', wheel)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [redraw, zoom])

  function select(index: number) {
    const renderer = rendererRef.current
    if (!renderer) return
    const ref = renderer.nodes[index]
    selectedId.current = ref?.id ?? null
    renderer.select(index)
    setSelected(ref)
    redraw()
  }

  function changeVisibility(action: 'expand' | 'collapse' | 'all', node = -1) {
    const force = presented.current?.graph.force
    if (!force || mode !== 'force' || !current || error) return false
    const model = force.exploration
    const changed = action === 'all' ? model.expandAll() : model[action](node)
    if (!changed) return false
    force.refresh()
    setVisibility((revision) => revision + 1)
    redraw()
    return true
  }

  function hit(clientX: number, clientY: number) {
    const bounds = canvasRef.current!.getBoundingClientRect()
    return rendererRef.current?.hit(cameraRef.current, clientX - bounds.left, clientY - bounds.top) ?? -1
  }

  function startPointer(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || gesture.current || !rendererRef.current) return
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: cameraRef.current, moved: false }
  }

  function movePointer(event: PointerEvent<HTMLCanvasElement>) {
    const drag = gesture.current
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && dx * dx + dy * dy < 16) return
    drag.moved = true
    event.currentTarget.dataset.dragging = 'true'
    cameraRef.current = { x: drag.start.x + dx, y: drag.start.y + dy, scale: drag.start.scale }
    redraw()
  }

  function endPointer(event: PointerEvent<HTMLCanvasElement>) {
    const drag = gesture.current
    if (!drag || drag.id !== event.pointerId) return
    gesture.current = null
    delete event.currentTarget.dataset.dragging
    if (event.type === 'pointerup' && !drag.moved) {
      const node = hit(event.clientX, event.clientY)
      select(node)
      changeVisibility('expand', node)
    }
  }

  function home(fit: boolean) {
    const renderer = rendererRef.current
    if (!renderer) return
    const { width, height } = size.current
    cameraRef.current = fit || renderer.root < 0
      ? fitCamera(renderer.layout, width, height)
      : centerCamera(renderer.layout, renderer.root, width, height, focusScale)
    redraw()
  }

  function zoomCenter(factor: number) {
    zoom(factor, size.current.width / 2, size.current.height / 2)
  }

  function moveSelection(dx: number, dy: number) {
    const renderer = rendererRef.current
    const current = selectedId.current === null ? -1 : presented.current?.graph.indexes.get(selectedId.current) ?? -1
    if (!renderer || !renderer.nodes.length) return
    const { layout, root } = renderer
    let next = current < 0 ? Math.max(0, root) : -1
    let best = Infinity
    if (current >= 0) {
      const candidates = presented.current?.graph.force?.exploration.visible ?? layout.nodeIndex.items
      for (const i of candidates) {
        const x = layout.x[i] - layout.x[current]
        const y = layout.y[i] - layout.y[current]
        if (x * dx + y * dy <= 0) continue
        const distance = x * x * (dx ? 1 : 4) + y * y * (dy ? 1 : 4)
        if (distance >= best) continue
        best = distance
        next = i
      }
    }
    if (next < 0) return
    const { width, height } = size.current
    const camera = cameraRef.current
    const screenX = (layout.x[next] + nodeWidth / 2) * camera.scale + camera.x
    const screenY = (layout.y[next] + nodeHeight / 2) * camera.scale + camera.y
    if (screenX < 24 || screenX > width - 24 || screenY < 24 || screenY > height - 24 || camera.scale < labelledScale) {
      cameraRef.current = centerCamera(layout, next, width, height, Math.max(focusScale, camera.scale))
    }
    select(next)
  }

  function keyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    switch (event.key) {
      case 'ArrowLeft': moveSelection(-1, 0); break
      case 'ArrowRight': moveSelection(1, 0); break
      case 'ArrowUp': moveSelection(0, -1); break
      case 'ArrowDown': moveSelection(0, 1); break
      case 'Home': home(true); break
      case '+':
      case '=': zoomCenter(1.25); break
      case '-': zoomCenter(0.8); break
      case 'Escape': select(-1); break
      case 'Enter': {
        if (!selected) break
        const index = presented.current?.graph.indexes.get(selected.id) ?? -1
        if (!changeVisibility('expand', index)) onOpen(selected)
        break
      }
      case 'Backspace': {
        if (!selected || mode !== 'force') return
        changeVisibility('collapse', presented.current?.graph.indexes.get(selected.id))
        break
      }
      default: return
    }
    event.preventDefault()
  }

  const exploration = graph?.force?.exploration
  const visibleNodes = exploration?.visible.length ?? graph?.nodes.length ?? 0
  const visibleEdges = exploration?.visibleEdges.length ?? graph?.layout.from.length ?? 0
  const selectedIndex = selected ? graph?.indexes.get(selected.id) ?? -1 : -1
  const canExpand = Boolean(exploration?.hidden[selectedIndex])
  const canCollapse = Boolean(exploration?.children[selectedIndex])
  const ready = current && !error && visibleNodes > 0
  return (
    <section aria-label="Asset lineage" className={cn('flex h-[min(66vh,640px)] min-h-72 flex-col overflow-hidden rounded-xl border bg-background', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <span className="mr-auto text-sm tabular-nums text-muted-foreground">
          {graph ? `${visibleNodes.toLocaleString()}${exploration ? ' of ' + graph.nodes.length.toLocaleString() : ''} assets · ${visibleEdges.toLocaleString()} connections` : 'Lineage'}
        </span>
        <div aria-label="Layout" role="group" className="flex gap-1">
          <Button variant={mode === 'force' ? 'secondary' : 'ghost'} size="sm" aria-pressed={mode === 'force'} onClick={() => setLayoutChoice({ prop: layout, mode: 'force' })}>Force</Button>
          <Button variant={mode === 'layered' ? 'secondary' : 'ghost'} size="sm" aria-pressed={mode === 'layered'} onClick={() => setLayoutChoice({ prop: layout, mode: 'layered' })}>Layered</Button>
        </div>
        {mode === 'force' && <Button variant="outline" size="sm" disabled={!ready || visibleNodes === graph?.nodes.length} onClick={() => changeVisibility('all')}>Expand all</Button>}
        <Button variant="ghost" size="icon" aria-label="Zoom out" title="Zoom out" disabled={!ready} onClick={() => zoomCenter(0.8)}><Minus /></Button>
        <Button variant="ghost" size="icon" aria-label="Zoom in" title="Zoom in" disabled={!ready} onClick={() => zoomCenter(1.25)}><Plus /></Button>
        <Button variant="ghost" size="icon" aria-label="Fit graph" title="Fit graph" disabled={!ready} onClick={() => home(true)}><Maximize /></Button>
        <Button variant="ghost" size="icon" aria-label="Center on root asset" title="Center on root asset" disabled={!graph?.indexes.has(rootId)} onClick={() => home(false)}><LocateFixed /></Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          aria-label={mode === 'force'
            ? 'Lineage graph. Arrow keys select an asset. Enter expands hidden neighbours or opens the asset. Backspace collapses a branch. Plus and minus zoom. Home fits the graph.'
            : 'Lineage graph. Arrow keys select an asset. Enter opens it. Plus and minus zoom. Home fits the graph.'}
          className="block size-full touch-none cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[dragging=true]:cursor-grabbing"
          onPointerDown={startPointer}
          onPointerMove={movePointer}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onLostPointerCapture={endPointer}
          onKeyDown={keyDown}
        />
        {status && (
          <p role={error ? 'alert' : 'status'} className="pointer-events-none absolute inset-x-4 top-4 mx-auto w-fit rounded-lg border bg-card px-4 py-2 text-sm text-card-foreground">
            {status}
          </p>
        )}
      </div>
      {selected && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-card px-4 py-2">
          <div className="mr-auto min-w-0 flex-1" aria-live="polite">
            <p className="truncate text-sm font-medium" title={assetLabel(selected)}>{assetLabel(selected)}</p>
            <p className="truncate text-xs text-muted-foreground" title={selected.fullyQualifiedName}>{selected.fullyQualifiedName ?? selected.type}</p>
          </div>
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-[var(--series-1)]" /> Upstream</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-[var(--series-2)]" /> Downstream</span>
          {mode === 'force' && canExpand && <Button variant="outline" size="sm" onClick={() => changeVisibility('expand', selectedIndex)}>Expand {exploration?.hidden[selectedIndex]}</Button>}
          {mode === 'force' && canCollapse && <Button variant="outline" size="sm" onClick={() => changeVisibility('collapse', selectedIndex)}>Collapse branch</Button>}
          <Button variant="outline" size="sm" onClick={() => onOpen(selected)}>Open asset</Button>
        </div>
      )}
    </section>
  )
}
