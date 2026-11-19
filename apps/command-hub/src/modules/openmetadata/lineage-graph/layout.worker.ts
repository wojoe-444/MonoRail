import { layoutLineage, type LayoutRequest, type LineageLayout } from './layout'

export type LayoutResponse =
  | { layout: LineageLayout; elapsed: number }
  | { error: string }

self.onmessage = ({ data }: MessageEvent<LayoutRequest>) => {
  try {
    const start = performance.now()
    const layout = layoutLineage(data)
    const { x, y, from, to, nodeIndex, edgeIndex } = layout
    const transfer = [x.buffer, y.buffer, from.buffer, to.buffer]
    for (const index of [nodeIndex, edgeIndex]) {
      transfer.push(index.bounds.buffer, index.branches.buffer, index.items.buffer, index.itemBounds.buffer)
    }
    self.postMessage({ layout, elapsed: performance.now() - start } satisfies LayoutResponse, { transfer })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies LayoutResponse)
  }
}
