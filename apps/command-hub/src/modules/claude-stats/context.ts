import { contextStep, stepLabel } from './pricing'
import { OTHER, perM, seriesOf, SOURCE_LABELS, sourceModelLabel } from './transform'
import type { ScanCompaction, ScanTurnRow, SourceId, UsageFact } from './types'

// ---------------------------------------------------------------- P2/P3: cost per M output by context step

/** A step needs at least this much output to be plotted. */
export const MIN_STEP_OUTPUT = 100_000

export interface StepCell {
  series: string
  step: number
  cost: number
  output: number
  /** $ per M output tokens; undefined when the step is skipped. */
  perM: number | undefined
}

export function costByStep(facts: UsageFact[], order: string[]): { steps: number[]; cells: StepCell[] } {
  const map = new Map<string, StepCell>()
  for (const f of facts) {
    if (f.step === undefined) continue
    const series = seriesOf(f.model, order)
    const k = `${series}|${f.step}`
    const c = map.get(k) ?? { series, step: f.step, cost: 0, output: 0, perM: undefined }
    c.cost += f.cost
    c.output += f.outputTokens
    map.set(k, c)
  }
  const cells = [...map.values()]
  for (const c of cells) c.perM = c.output >= MIN_STEP_OUTPUT ? perM(c.cost, c.output) : undefined
  const steps = [...new Set(cells.filter((c) => c.perM !== undefined).map((c) => c.step))].sort((a, b) => a - b)
  return { steps, cells }
}

/**
 * "Average each model to 100": divide each plotted point by the model's
 * unweighted mean over its plotted steps, times 100.
 */
export function indexTo100(cells: StepCell[]): Map<string, number> {
  const sums = new Map<string, { sum: number; n: number }>()
  for (const c of cells) {
    if (c.perM === undefined) continue
    const s = sums.get(c.series) ?? { sum: 0, n: 0 }
    s.sum += c.perM
    s.n++
    sums.set(c.series, s)
  }
  return new Map([...sums].map(([k, s]) => [k, s.sum / s.n]))
}

// ---------------------------------------------------------------- C1: compactions

export const UNKNOWN = 'Unknown model'

export interface CompactionRow {
  series: string
  total: number
  manual: number
  medianContext: number | undefined
}

export function compactionLabel(c: ScanCompaction, order: string[]): string {
  return c.model ? seriesOf(sourceModelLabel(c.model, c.source), order) : UNKNOWN
}

/** Context step a compaction started from; -1 when the log has no size. */
export function compactionStep(c: ScanCompaction): number {
  return c.preTokens ? contextStep(c.preTokens) : -1
}

export function compactionStepLabel(step: number): string {
  return step < 0 ? 'Size not logged' : stepLabel(step)
}

export function compactionStats(rows: ScanCompaction[], order: string[]) {
  const bySeries = new Map<string, ScanCompaction[]>()
  const steps = new Set<number>()
  for (const c of rows) {
    const k = compactionLabel(c, order)
    const list = bySeries.get(k) ?? []
    list.push(c)
    bySeries.set(k, list)
    steps.add(compactionStep(c))
  }
  const series = [...order, UNKNOWN].filter((s) => bySeries.has(s))
  const stepList = [...steps].sort((a, b) => a - b)
  const bars = stepList.map((step) => ({
    step,
    values: Object.fromEntries(
      series.map((s) => [s, (bySeries.get(s) ?? []).filter((c) => compactionStep(c) === step).length]),
    ),
  }))
  const table: CompactionRow[] = series.map((s) => {
    const list = bySeries.get(s)!
    return {
      series: s,
      total: list.length,
      manual: list.filter((c) => c.trigger === 'manual').length,
      medianContext: median(list.flatMap((c) => (c.preTokens ? [c.preTokens] : []))),
    }
  })
  return { series, bars, table, total: rows.length }
}

export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ---------------------------------------------------------------- C2/C3: prompt size by turn

/** A turn needs at least this many passes to be plotted. */
export const MIN_TURN_PASSES = 5

export interface TurnLine {
  key: string
  /** Model series (color). */
  series: string
  source: SourceId
  kind?: 'start' | 'compaction'
  label: string
  passes: number
  /** turn -> average prompt size, only for plotted turns. */
  points: Map<number, number>
  /** turn -> passes, for every turn seen. */
  counts: Map<number, number>
}

/**
 * One line per model and harness (and, when split, per start condition).
 * Turn 1 is a session's first pass or the first pass after a compaction.
 */
export function turnLines(rows: ScanTurnRow[], order: string[], split: boolean): { lines: TurnLine[]; maxTurn: number } {
  const map = new Map<string, TurnLine & { sums: Map<number, number> }>()
  let maxTurn = 1
  for (const r of rows) {
    const label = sourceModelLabel(r.model, r.source)
    let series = seriesOf(label, order)
    if (series === OTHER && r.source !== 'claude-code') series = `${OTHER} · ${SOURCE_LABELS[r.source]}`
    const kind = split ? r.kind : undefined
    const key = kind ? `${series}|${kind}` : series
    let line = map.get(key)
    if (!line) {
      const name = kind ? `${series}, ${kind === 'start' ? 'from session start' : 'after compaction'}` : series
      line = { key, series, source: r.source, kind, label: name, passes: 0, points: new Map(), counts: new Map(), sums: new Map() }
      map.set(key, line)
    }
    line.passes += r.n
    line.counts.set(r.turn, (line.counts.get(r.turn) ?? 0) + r.n)
    line.sums.set(r.turn, (line.sums.get(r.turn) ?? 0) + r.promptSum)
  }
  for (const line of map.values()) {
    for (const [turn, n] of line.counts) {
      if (n >= MIN_TURN_PASSES) {
        line.points.set(turn, line.sums.get(turn)! / n)
        maxTurn = Math.max(maxTurn, turn)
      }
    }
  }
  const rank = (s: string) => {
    const i = order.indexOf(s.split(' · ')[0] === OTHER ? OTHER : s)
    return i < 0 ? order.length : i
  }
  const lines = [...map.values()]
    .map(({ sums: _sums, ...l }) => l)
    .sort((a, b) => rank(a.series) - rank(b.series) || a.series.localeCompare(b.series) || (a.kind === 'compaction' ? 1 : -1))
  return { lines, maxTurn }
}

/** Dash pattern: Claude Code solid, other harnesses dashed; split lines mark after-compaction too. */
export function turnDash(line: Pick<TurnLine, 'source' | 'kind'>): string | undefined {
  const cc = line.source === 'claude-code'
  if (line.kind === 'compaction') return cc ? '6 4' : '8 3 2 3'
  if (line.kind === 'start') return cc ? undefined : '2 3'
  return cc ? undefined : '6 4'
}
