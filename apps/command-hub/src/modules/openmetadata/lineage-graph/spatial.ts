export type Bounds = [left: number, top: number, right: number, bottom: number]

export interface SpatialIndex {
  bounds: Float32Array
  branches: Int32Array
  items: Uint32Array
  itemBounds: Float32Array
}

const leafSize = 16

/** Balanced bounding-volume hierarchy. Each item is stored once, even for long edges. */
export function buildIndex(itemBounds: Float32Array, ids?: ArrayLike<number>): SpatialIndex {
  const order = ids ? Array.from(ids) : Array.from({ length: itemBounds.length / 4 }, (_, i) => i)
  const count = order.length
  const bounds: number[] = []
  const branches: number[] = []

  function partition(start: number, end: number) {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = start; i < end; i++) {
      const offset = order[i] * 4
      const x1 = itemBounds[offset]
      const y1 = itemBounds[offset + 1]
      const x2 = itemBounds[offset + 2]
      const y2 = itemBounds[offset + 3]
      left = Math.min(left, x1)
      top = Math.min(top, y1)
      right = Math.max(right, x2)
      bottom = Math.max(bottom, y2)
      minX = Math.min(minX, x1 + x2)
      maxX = Math.max(maxX, x1 + x2)
      minY = Math.min(minY, y1 + y2)
      maxY = Math.max(maxY, y1 + y2)
    }
    const node = branches.length / 2
    bounds.push(left, top, right, bottom)
    if (end - start <= leafSize) {
      branches.push(~start, end)
      return node
    }

    const axis = maxX - minX >= maxY - minY ? 0 : 1
    const sorted = order.slice(start, end).sort((a, b) =>
      itemBounds[a * 4 + axis] + itemBounds[a * 4 + axis + 2] -
      itemBounds[b * 4 + axis] - itemBounds[b * 4 + axis + 2])
    for (let i = 0; i < sorted.length; i++) order[start + i] = sorted[i]

    branches.push(0, 0)
    const middle = (start + end) >>> 1
    branches[node * 2] = partition(start, middle)
    branches[node * 2 + 1] = partition(middle, end)
    return node
  }

  if (count) partition(0, count)
  return { bounds: Float32Array.from(bounds), branches: Int32Array.from(branches), items: Uint32Array.from(order), itemBounds }
}

/** Update existing partitions bottom-up as the renderer interpolates coordinates. */
export function refitIndex({ bounds, itemBounds, branches, items }: SpatialIndex) {
  for (let node = branches.length / 2 - 1; node >= 0; node--) {
    const first = branches[node * 2]
    const second = branches[node * 2 + 1]
    const offset = node * 4
    if (first >= 0) {
      const a = first * 4
      const b = second * 4
      bounds[offset] = Math.min(bounds[a], bounds[b])
      bounds[offset + 1] = Math.min(bounds[a + 1], bounds[b + 1])
      bounds[offset + 2] = Math.max(bounds[a + 2], bounds[b + 2])
      bounds[offset + 3] = Math.max(bounds[a + 3], bounds[b + 3])
      continue
    }
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (let i = ~first; i < second; i++) {
      const item = items[i] * 4
      left = Math.min(left, itemBounds[item])
      top = Math.min(top, itemBounds[item + 1])
      right = Math.max(right, itemBounds[item + 2])
      bottom = Math.max(bottom, itemBounds[item + 3])
    }
    bounds[offset] = left
    bounds[offset + 1] = top
    bounds[offset + 2] = right
    bounds[offset + 3] = bottom
  }
}

export function queryIndex(index: SpatialIndex, area: Bounds, results: number[], stack: number[]) {
  results.length = 0
  stack.length = 0
  if (!index.branches.length) return

  const [left, top, right, bottom] = area
  const { bounds, itemBounds, branches, items } = index
  stack.push(0)
  while (stack.length) {
    const branch = stack.pop()!
    const offset = branch * 4
    if (bounds[offset] > right || bounds[offset + 1] > bottom || bounds[offset + 2] < left || bounds[offset + 3] < top) continue
    const first = branches[branch * 2]
    const second = branches[branch * 2 + 1]
    if (first >= 0) {
      stack.push(second, first)
      continue
    }
    for (let i = ~first; i < second; i++) {
      const item = items[i]
      const j = item * 4
      if (itemBounds[j] <= right && itemBounds[j + 1] <= bottom && itemBounds[j + 2] >= left && itemBounds[j + 3] >= top) {
        results.push(item)
      }
    }
  }
}
