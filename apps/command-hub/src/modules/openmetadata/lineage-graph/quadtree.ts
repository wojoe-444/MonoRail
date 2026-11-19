/** Bucketed Barnes–Hut quadtree. Node indexes and scratch storage are reused each tick. */
export class QuadTree {
  first = new Int32Array(128)
  head = new Int32Array(128)
  mass = new Uint32Array(128)
  centerX = new Float32Array(128)
  centerY = new Float32Array(128)
  midX = new Float32Array(128)
  midY = new Float32Array(128)
  half = new Float32Array(128)
  readonly next: Int32Array
  private used = 0

  constructor(count: number) {
    this.next = new Int32Array(count)
  }

  private allocate(x: number, y: number, half: number) {
    const index = this.used++
    if (index === this.first.length) {
      function grow<T extends Int32Array | Uint32Array | Float32Array>(array: T) {
        const ArrayType = array.constructor as new (length: number) => T
        const next = new ArrayType(array.length * 2)
        next.set(array)
        return next
      }
      this.first = grow(this.first)
      this.head = grow(this.head)
      this.mass = grow(this.mass)
      this.centerX = grow(this.centerX)
      this.centerY = grow(this.centerY)
      this.midX = grow(this.midX)
      this.midY = grow(this.midY)
      this.half = grow(this.half)
    }
    this.first[index] = -1
    this.head[index] = -1
    this.mass[index] = 0
    this.midX[index] = x
    this.midY[index] = y
    this.half[index] = half
    return index
  }

  private child(quad: number, x: number, y: number) {
    return this.first[quad] + Number(x >= this.midX[quad]) + 2 * Number(y >= this.midY[quad])
  }

  private add(quad: number, node: number) {
    this.next[node] = this.head[quad]
    this.head[quad] = node
    this.mass[quad]++
  }

  build(active: Uint32Array, x: Float32Array, y: Float32Array) {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const node of active) {
      left = Math.min(left, x[node])
      top = Math.min(top, y[node])
      right = Math.max(right, x[node])
      bottom = Math.max(bottom, y[node])
    }
    this.used = 0
    this.allocate((left + right) / 2, (top + bottom) / 2, Math.max(right - left, bottom - top, 2) / 2 + 0.01)
    for (const node of active) {
      let quad = 0
      let depth = 0
      while (this.first[quad] >= 0 || (this.mass[quad] >= 4 && depth < 18)) {
        if (this.first[quad] < 0) {
          const first = this.used
          this.first[quad] = first
          const half = this.half[quad] / 2
          const cx = this.midX[quad]
          const cy = this.midY[quad]
          this.allocate(cx - half, cy - half, half)
          this.allocate(cx + half, cy - half, half)
          this.allocate(cx - half, cy + half, half)
          this.allocate(cx + half, cy + half, half)
          for (let member = this.head[quad]; member >= 0;) {
            const next = this.next[member]
            this.add(this.child(quad, x[member], y[member]), member)
            member = next
          }
          this.head[quad] = -1
        }
        quad = this.child(quad, x[node], y[node])
        depth++
      }
      this.add(quad, node)
    }
    for (let quad = this.used - 1; quad >= 0; quad--) {
      const first = this.first[quad]
      let sumX = 0
      let sumY = 0
      if (first < 0) {
        for (let node = this.head[quad]; node >= 0; node = this.next[node]) {
          sumX += x[node]
          sumY += y[node]
        }
      } else {
        let mass = 0
        for (let child = first; child < first + 4; child++) {
          const weight = this.mass[child]
          mass += weight
          sumX += this.centerX[child] * weight
          sumY += this.centerY[child] * weight
        }
        this.mass[quad] = mass
      }
      const divisor = this.mass[quad] || 1
      this.centerX[quad] = sumX / divisor
      this.centerY[quad] = sumY / divisor
    }
  }
}
