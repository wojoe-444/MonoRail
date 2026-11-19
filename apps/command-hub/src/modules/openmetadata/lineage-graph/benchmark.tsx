import { createRoot } from 'react-dom/client'
import { findPalette, tokens } from '@/lib/palettes'
import '../../../index.css'
import { LineageGraph } from './LineageGraph'
import { generateLineage } from './demo-data'
import { nodeHeight, nodeWidth, type LayoutRequest } from './layout'
import { ForceView } from './force-view'
import type { ForceOptions } from './force'
import { makeTopology } from './topology'
import LayoutWorker from './layout.worker?worker&inline'
import type { LayoutResponse } from './layout.worker'
import { centerCamera, fitCamera, LineageRenderer, readTheme, sizeCanvas, type RenderOptions } from './renderer'

const host = document.getElementById('root')!
const generationStart = performance.now()
const data = generateLineage()
const generationMs = performance.now() - generationStart
const waitFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))

async function until(condition: () => boolean, failure: string) {
  const deadline = performance.now() + 4000
  while (!condition()) {
    if (performance.now() > deadline) throw new Error(failure)
    await waitFrame()
  }
}

async function checkComponent() {
  const seed = {
    rootId: 'manifest',
    nodes: [
      { id: 'source', type: 'table', name: 'orbital_shipments' },
      { id: 'manifest', type: 'table', name: 'freight_manifest' },
      { id: 'report', type: 'dashboard', name: 'freight_report' },
      { id: 'alert', type: 'table', name: 'delay_alerts' },
      { id: 'island', type: 'table', name: 'tidal_stations' },
    ],
    edges: [
      { fromEntity: 'source', toEntity: 'manifest' },
      { fromEntity: 'manifest', toEntity: 'report' },
      { fromEntity: 'report', toEntity: 'alert' },
    ],
  }
  let opened: string | undefined
  const onOpen = (ref: { id: string }) => { opened = ref.id }
  const root = createRoot(host)
  root.render(<LineageGraph {...seed} onOpen={onOpen} />)
  const painted = (count: number) => host.querySelector('canvas')?.dataset.visibleAssets === String(count)
  const button = (text: string) => [...host.querySelectorAll('button')].find((node) => node.textContent === text)
  await until(() => painted(3), 'Force mode did not start with the root and its direct neighbours')
  const canvas = host.querySelector('canvas')!
  const ctx = canvas.getContext('2d')!
  const backgroundPixel = () => [...ctx.getImageData(0, 0, 1, 1).data].join(',')
  const light = backgroundPixel()
  const page = document.documentElement
  page.classList.add('dark')
  await until(() => backgroundPixel() !== light, 'Dark tokens did not repaint the canvas')
  const dark = backgroundPixel()
  page.classList.remove('dark')
  const indigo = tokens(findPalette('indigo-ink'), false)
  for (const [key, value] of Object.entries(indigo)) page.style.setProperty('--' + key, value)
  await until(() => backgroundPixel() !== dark && backgroundPixel() !== light, 'Indigo Ink tokens did not repaint the canvas')
  for (const key of Object.keys(indigo)) page.style.removeProperty('--' + key)

  const press = (key: string) => canvas.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  press('ArrowRight')
  await until(() => !!button('Open asset'), 'Keyboard selection did not appear')
  button('Open asset')!.click()
  if (opened !== seed.rootId) throw new Error('Root selection did not invoke onOpen')
  press('ArrowRight')
  await until(() => !!button('Expand 1'), 'Downstream asset or expansion button is missing')
  press('Enter')
  await until(() => painted(4), 'Enter did not expand the downstream asset')
  await until(() => !!button('Collapse branch'), 'Branch collapse is missing')
  button('Collapse branch')!.click()
  await until(() => painted(3) && !!button('Expand 1'), 'The branch did not collapse')

  const branchClickToDrawMs = await measureClick(canvas, button('Expand 1')!, 4)
  button('Expand all')!.click()
  await until(() => painted(5) && button('Expand all')?.disabled === true, 'Expand all missed the disconnected asset')
  button('Layered')!.click()
  await until(() => button('Layered')?.getAttribute('aria-pressed') === 'true' &&
    !host.querySelector('[role="status"]') && !button('Expand all'), 'Layered mode did not load')
  press('Enter')
  if (opened !== 'report') throw new Error('Layered selection was lost on mode switch')
  button('Force')!.click()
  await until(() => !host.querySelector('[role="status"]') && button('Expand all')?.disabled === true, 'Force exploration was lost on mode switch')

  const extra = { id: 'fictional-extra', type: 'dashboard', name: 'orbital_freight_overview' }
  root.render(<LineageGraph {...seed} nodes={[...seed.nodes, extra]}
    edges={[...seed.edges, { fromEntity: seed.rootId, toEntity: extra.id }]} onOpen={onOpen} />)
  await until(() => painted(6), 'Updated snapshot was not drawn')
  button('Open asset')!.click()
  if (opened !== 'report') throw new Error('Selection did not survive a snapshot update')
  root.unmount()

  const largeRoot = createRoot(host)
  largeRoot.render(<LineageGraph {...data} onOpen={onOpen} />)
  await until(() => !!button('Expand all') && !button('Expand all')!.disabled &&
    !!host.querySelector('canvas')?.dataset.visibleAssets, 'Large fixture did not load')
  const bulkClickToDrawMs = await measureClick(host.querySelector('canvas')!, button('Expand all')!, 5000)
  largeRoot.unmount()
  return { branchClickToDrawMs, bulkClickToDrawMs }
}

async function measureClick(canvas: HTMLCanvasElement, control: HTMLButtonElement, count: number) {
  let drawn: number | undefined
  const observer = new MutationObserver(() => {
    if (canvas.dataset.visibleAssets === String(count)) drawn = performance.now()
  })
  observer.observe(canvas, { attributeFilter: ['data-visible-assets'] })
  const clicked = performance.now()
  try {
    control.click()
    await until(() => drawn !== undefined, 'Click did not draw ' + count + ' assets')
    return drawn! - clicked
  } finally {
    observer.disconnect()
  }
}

async function workerLayout(request: LayoutRequest) {
  const start = performance.now()
  const worker = new LayoutWorker()
  try {
    const data = await new Promise<LayoutResponse>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<LayoutResponse>) => resolve(event.data)
      worker.onerror = (event) => reject(new Error(event.message || 'Layout worker did not start'))
      worker.postMessage(request)
    })
    if ('error' in data) throw new Error(data.error)
    return { ...data, roundTrip: performance.now() - start }
  } finally {
    worker.terminate()
  }
}

function summarize(values: number[]) {
  const order = [...values].sort((a, b) => a - b)
  const percentile = (p: number) => order[Math.ceil(order.length * p) - 1]
  return { p50: percentile(0.5), p95: percentile(0.95), max: order[order.length - 1] }
}

const stages: [name: string, options: RenderOptions][] = [
  ['Full cards, every item, individual edge strokes', { batch: false, cull: false, lod: false, cacheHighlight: false }],
  ['+ Batched edge strokes', { batch: true, cull: false, lod: false, cacheHighlight: false }],
  ['+ Level of detail', { batch: true, cull: false, lod: true, cacheHighlight: false }],
  ['+ Spatial culling', { batch: true, cull: true, lod: true, cacheHighlight: false }],
  ['+ Cached selection', { batch: true, cull: true, lod: true, cacheHighlight: true }],
]

const forceStages: { name: string; options?: ForceOptions; rebuildIndex?: boolean; mergeSpawns?: boolean; capRaster?: boolean }[] = [
  { name: 'Exact repulsion, parent seeds, rebuild indexes', options: { exact: true, coldStart: true }, rebuildIndex: true },
  { name: '+ Barnes–Hut repulsion', options: { coldStart: true }, rebuildIndex: true },
  { name: '+ Rank-band seeds for bulk expansion', rebuildIndex: true },
  { name: '+ Refit spatial indexes during animation' },
  { name: '+ Draw coincident spawns once', mergeSpawns: true },
  { name: '+ Cap Canvas resolution during bulk animation', mergeSpawns: true, capRaster: true },
]

function inspectForce(view: ForceView) {
  const { x, y, from, to } = view.layout
  const byX = [...view.exploration.visible].sort((a, b) => x[a] - x[b])
  let overlapped = 0
  let forward = 0
  for (let i = 0; i < byX.length; i++) {
    const a = byX[i]
    if (!Number.isFinite(x[a]) || !Number.isFinite(y[a])) throw new Error('Non-finite force position')
    for (let j = i + 1; j < byX.length && x[byX[j]] - x[a] < nodeWidth; j++) {
      if (Math.abs(y[byX[j]] - y[a]) < nodeHeight) overlapped++
    }
  }
  for (const edge of view.exploration.visibleEdges) {
    if (x[to[edge]] > x[from[edge]]) forward++
  }
  return { overlapped, forward, worldWidth: view.layout.width, worldHeight: view.layout.height }
}

async function runForceBenchmark(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  const indexes = new Map(data.nodes.map((node, i) => [node.id, i]))
  const selected = indexes.get(data.rootId)!
  const topology = makeTopology(indexes, data.edges)
  const theme = readTheme(ctx.canvas)

  async function measure(view: ForceView, renderer: LineageRenderer, trigger: () => void, stage?: typeof forceStages[number]) {
    const intervals: number[] = []
    const submission: number[] = []
    const started = performance.now()
    trigger()
    let firstDrawMs = 0
    let firstMotionMs: number | undefined
    const probe = view.exploration.visible.at(-1)!
    const initialX = view.layout.x[probe]
    const initialY = view.layout.y[probe]
    let previous: number | undefined
    do {
      const now = await waitFrame()
      if (now > started + 20000) throw new Error('Force simulation timed out')
      if (previous !== undefined) intervals.push(now - previous)
      previous = now
      const begin = performance.now()
      view.advance(now, stage?.rebuildIndex)
      const spawns = !stage || stage.mergeSpawns ? view.spawns : undefined
      // Repeated overview-to-card zooms with simultaneous x/y panning.
      const phase = Math.min(1, ((now - started) % 550) / 500)
      const zoom = Math.sin(phase * Math.PI) ** 2
      const { layout } = view
      const fit = fitCamera(layout, width, height)
      const scale = Math.min(fit.scale, 0.09) ** (1 - zoom) * 1.18 ** zoom
      const cx = layout.left + layout.width * (0.5 + 0.13 * Math.sin(phase * 2 * Math.PI))
      const cy = layout.top + layout.height * (0.5 + 0.17 * Math.sin(phase * 2 * Math.PI))
      const camera = stage && submission.length > 0
        ? { scale, x: width / 2 - cx * scale, y: height / 2 - cy * scale }
        : centerCamera(layout, selected, width, height, 0.9)
      const frameDpr = sizeCanvas(ctx.canvas, width, height, dpr, stage?.capRaster && view.bulkAnimating)
      renderer.draw(ctx, camera, width, height, frameDpr, undefined, spawns)
      const drawn = performance.now()
      submission.push(drawn - begin)
      if (submission.length === 1) firstDrawMs = drawn - started
      if (firstMotionMs === undefined && Math.hypot(layout.x[probe] - initialX, layout.y[probe] - initialY) >= 2) {
        firstMotionMs = drawn - started
      }
    } while (view.running)
    const settleMs = performance.now() - started
    const timing = view.timing
    if (!timing) throw new Error('Worker did not report final timing')
    return {
      ticks: timing.ticks,
      workerTicksPerSecond: timing.ticks * 1000 / timing.elapsedMs,
      computeTicksPerSecond: timing.ticks * 1000 / timing.computeMs,
      workerSettleMs: timing.elapsedMs,
      firstDrawMs,
      firstMotionMs,
      settleMs,
      frames: submission.length,
      submit: summarize(submission),
      rAF: summarize(intervals),
      over20ms: intervals.filter((interval) => interval > 20).length,
    }
  }

  const reports = []
  const stages = forceStages.filter((stage) => dpr > 1 || !stage.capRaster)
  for (const stage of stages) {
    let error: string | undefined
    const view = new ForceView(topology, selected, () => {}, (message) => { error = message })
    try {
      const { exploration, layout } = view
      view.refresh()
      const renderer = new LineageRenderer(layout, data.nodes, selected, theme, exploration.hidden)
      renderer.select(selected)
      while (view.running) {
        const now = await waitFrame()
        if (error) throw new Error(error)
        view.advance(now)
      }
      const metrics = await measure(view, renderer, () => {
        exploration.expandAll()
        if (exploration.visible.length !== 5000 || exploration.visibleEdges.length !== 7000) throw new Error('Expand all missed fixture assets or connections')
        view.refresh(stage.options)
      }, stage)
      const quality = inspectForce(view)
      reports.push({ stage: stage.name, ...metrics, ...quality })
      if (stage !== stages.at(-1)) continue
      if (quality.overlapped || quality.forward < 6900) throw new Error('Settled fixture cards overlap or lose lineage direction')
      const parent = exploration.visible.find((node) => node !== selected && exploration.children[node] === 1 &&
        exploration.visible.some((child) => exploration.owner[child] === node && !exploration.children[child]))!
      const baseline = { x: layout.x.slice(), y: layout.y.slice() }
      for (const reheatAll of [true, false]) {
        exploration.collapse(parent)
        view.refresh()
        const pinned = [...exploration.visible]
        const before = pinned.map((node) => [layout.x[node], layout.y[node]])
        const expansion = await measure(view, renderer, () => {
          if (!exploration.expand(parent)) throw new Error('Could not reopen the collapsed branch')
          view.refresh({ reheatAll, coldStart: reheatAll })
        })
        let drift = 0
        pinned.forEach((node, i) => {
          drift = Math.max(drift, Math.hypot(layout.x[node] - before[i][0], layout.y[node] - before[i][1]))
        })
        if (!reheatAll && drift !== 0) throw new Error('A settled asset moved during local expansion')
        reports.push({
          stage: reheatAll ? 'Branch expansion with global reheat' : 'Branch expansion with settled nodes pinned',
          revealed: exploration.visible.length - pinned.length,
          maximumPriorAssetDrift: drift,
          ...expansion,
        })
        layout.x.set(baseline.x)
        layout.y.set(baseline.y)
      }
    } finally {
      view.dispose()
    }
  }
  return reports
}

async function runBenchmark(dpr: number) {
  const component = await checkComponent()
  await document.fonts.load('600 17px "Inter Variable"')
  const request = { nodeIds: data.nodes.map((node) => node.id), edges: data.edges }
  const { layout, elapsed, roundTrip } = await workerLayout(request)
  if (data.nodes.length !== 5000 || layout.from.length !== 7000 || layout.feedbackEdges) throw new Error('Unexpected fixture topology')
  for (let i = 0; i < layout.from.length; i++) {
    if (layout.x[layout.from[i]] >= layout.x[layout.to[i]]) throw new Error('A fixture edge did not advance ranks')
  }
  const previousOrder = new Map(data.nodes.map((node, i) => [node.id, layout.y[i] / layout.height]))
  const expanded = await workerLayout({
    nodeIds: [...request.nodeIds, 'fictional-extra'],
    edges: [...request.edges, { fromEntity: data.rootId, toEntity: 'fictional-extra' }],
    previousOrder,
  })

  const width = 1280
  const height = 720
  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  host.append(canvas)
  const ctx = canvas.getContext('2d', { alpha: false })!
  const selected = request.nodeIds.indexOf(data.rootId)
  const renderer = new LineageRenderer(layout, data.nodes, selected, readTheme(canvas))
  renderer.select(selected)
  const fit = fitCamera(layout, width, height)
  const center = centerCamera(layout, selected, width, height, 1)
  if (renderer.hit(center, width / 2, height / 2) !== selected) throw new Error('Indexed hit-test missed the centered asset')

  const count = 120
  const timing = []
  for (const [stage, options] of stages) {
    const submission: number[] = []
    const intervals: number[] = []
    // Prime text labels and drawing paths outside the measured trace.
    for (let i = 0; i < 6; i++) {
      await waitFrame()
      renderer.draw(ctx, fit, width, height, dpr, options)
    }
    let prev = await waitFrame()
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const zoom = Math.sin(t * Math.PI) ** 2
      const scale = fit.scale * (1.25 / fit.scale) ** zoom
      const cx = layout.width * (0.42 + 0.12 * Math.sin(t * 2 * Math.PI))
      const cy = layout.height * (0.5 + 0.2 * Math.sin(t * 2 * Math.PI))
      const now = await waitFrame()
      if (i) intervals.push(now - prev)
      prev = now
      const start = performance.now()
      renderer.draw(ctx, { scale, x: width / 2 - cx * scale, y: height / 2 - cy * scale }, width, height, dpr, options)
      submission.push(performance.now() - start)
    }
    intervals.push((await waitFrame()) - prev)
    const raf = summarize(intervals)
    timing.push({
      stage,
      submit: summarize(submission),
      rAF: raf,
      over20ms: intervals.filter((interval) => interval > 20).length,
    })
  }
  const force = await runForceBenchmark(ctx, width, height, dpr)
  return {
    nodes: data.nodes.length, edges: layout.from.length, width, height, dpr, framesPerStage: count,
    generationMs, workerMs: elapsed, workerRoundTripMs: roundTrip,
    expansionWorkerMs: expanded.elapsed, expansionRoundTripMs: expanded.roundTrip, timing, force, component,
  }
}

Object.assign(window, { runLineageBenchmark: runBenchmark })
