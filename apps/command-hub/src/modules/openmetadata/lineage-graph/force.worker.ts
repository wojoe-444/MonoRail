import { ForceSimulation, type ForceInput, type ForceRun } from './force'

export type ForceRequest =
  | { type: 'init'; input: ForceInput }
  | { type: 'run'; run: ForceRun }
  | { type: 'release'; positions: Float32Array<ArrayBuffer> }

export interface ForceTiming {
  ticks: number
  computeMs: number
  elapsedMs: number
}

export type ForceResponse =
  | { revision: number; positions: Float32Array<ArrayBuffer>; timing?: ForceTiming }
  | { ready: true }
  | { error: string }

let input: ForceInput
let timer: ReturnType<typeof setTimeout> | undefined
let buffer: Float32Array<ArrayBuffer> | undefined
let publish: (() => void) | undefined

function fail(cause: unknown) {
  clearTimeout(timer)
  publish = undefined
  self.postMessage({ error: cause instanceof Error ? cause.message : String(cause) } satisfies ForceResponse)
}

function start(run: ForceRun) {
  clearTimeout(timer)
  publish = undefined
  if (!run.moving.length && !run.options?.reheatAll) return
  const started = performance.now()
  const simulation = new ForceSimulation(input, run)
  let ticks = 0
  let computeMs = 0
  let timing: ForceTiming | undefined
  let pending = false
  let lastSent = -Infinity

  publish = () => {
    if (!pending || !buffer) return
    if (!timing && performance.now() - lastSent < 14) return
    simulation.snapshot(buffer)
    self.postMessage({ revision: run.revision, positions: buffer, timing } satisfies ForceResponse, {
      transfer: [buffer.buffer],
    })
    buffer = undefined
    pending = false
    lastSent = performance.now()
  }

  function step() {
    try {
      const before = performance.now()
      const finished = simulation.tick()
      computeMs += performance.now() - before
      ticks++
      pending = true
      if (finished) timing = { ticks, computeMs, elapsedMs: performance.now() - started }
      publish?.()
      if (!finished) timer = setTimeout(step, 0)
    } catch (error) {
      fail(error)
    }
  }
  timer = setTimeout(step, 0)
}

self.onmessage = ({ data }: MessageEvent<ForceRequest>) => {
  try {
    switch (data.type) {
      case 'init':
        input = data.input
        buffer = new Float32Array(input.ranks.length * 2)
        self.postMessage({ ready: true } satisfies ForceResponse)
        break
      case 'run':
        start(data.run)
        break
      case 'release':
        buffer = data.positions
        publish?.()
        break
    }
  } catch (error) {
    fail(error)
  }
}
