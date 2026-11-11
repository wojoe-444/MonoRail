import type { SessionFact, UsageFact, UsageReport } from './types'

/** "claude-opus-4-1-20250805" -> "Opus 4.1", "claude-3-5-sonnet-20241022" -> "Sonnet 3.5". */
export function modelLabel(raw: string): string {
  const name = raw.replace(/^anthropic[./]/, '').replace(/^claude-/, '').replace(/-\d{8}$/, '').replace(/\[.*\]$/, '')
  const parts = name.split('-')
  const family = parts.find((p) => /^(opus|sonnet|haiku|fable|instant)$/i.test(p))
  if (!family) return raw
  const version = parts.filter((p) => /^\d+(\.\d+)?$/.test(p)).join('.')
  const fam = family[0].toUpperCase() + family.slice(1).toLowerCase()
  return version ? `${fam} ${version}` : fam
}

/**
 * Readable project name from ccusage's encoded folder name, e.g.
 * "C--Users-me-Repos-MonoRail" -> "Repos-MonoRail", "-home-me-app" -> "app".
 */
export function projectLabel(raw: string): string {
  const stripped = raw
    .replace(/^[A-Za-z]--Users-[^-]+-?/, '')
    .replace(/^-(home|Users)-[^-]+-?/, '')
    .replace(/^-root-?/, '')
  return stripped || '~ (home folder)'
}

export function normalize(report: UsageReport): { facts: UsageFact[]; sessions: SessionFact[] } {
  const facts: UsageFact[] = []
  const groups = report.daily.projects ?? { unknown: report.daily.daily ?? [] }
  for (const [project, rows] of Object.entries(groups)) {
    for (const row of rows) {
      for (const b of row.modelBreakdowns ?? []) {
        if (b.modelName === '<synthetic>') continue
        facts.push({
          date: row.date,
          project: projectLabel(row.project ?? project),
          model: modelLabel(b.modelName),
          inputTokens: b.inputTokens,
          outputTokens: b.outputTokens,
          cacheCreationTokens: b.cacheCreationTokens,
          cacheReadTokens: b.cacheReadTokens,
          cost: b.cost,
        })
      }
    }
  }
  const sessions: SessionFact[] = (report.sessions.sessions ?? []).map((s) => ({
    id: s.sessionId,
    project: projectLabel(s.projectPath),
    firstActivity: s.firstActivity,
    lastActivity: s.lastActivity,
    models: [...new Set(s.modelsUsed.filter((m) => m !== '<synthetic>').map(modelLabel))],
    outputTokens: s.outputTokens,
    totalTokens: s.totalTokens,
    cost: s.totalCost,
  }))
  return { facts, sessions }
}

// ---------------------------------------------------------------- date range

export type RangeKey = '7d' | '30d' | '90d' | 'all'

export const RANGES: { key: RangeKey; label: string; days?: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time' },
]

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}

export interface DateWindow {
  start: string
  end: string
  /** Same-length window immediately before, for deltas. Undefined for "all". */
  prev?: { start: string; end: string }
}

export function windowFor(range: RangeKey, facts: UsageFact[], today = isoDate(new Date())): DateWindow {
  const days = RANGES.find((r) => r.key === range)?.days
  if (!days) {
    const first = facts.reduce((min, f) => (f.date < min ? f.date : min), today)
    return { start: first, end: today }
  }
  const start = addDays(today, -(days - 1))
  return { start, end: today, prev: { start: addDays(start, -days), end: addDays(start, -1) } }
}

export function inWindow<T extends { date: string }>(rows: T[], w: { start: string; end: string }): T[] {
  return rows.filter((r) => r.date >= w.start && r.date <= w.end)
}

// ---------------------------------------------------------------- aggregates

export interface Totals {
  outputTokens: number
  inputTokens: number
  cacheTokens: number
  cost: number
  /** API-equivalent dollars per million output tokens. */
  costPerMOutput: number | undefined
}

export function totals(facts: UsageFact[]): Totals {
  let outputTokens = 0
  let inputTokens = 0
  let cacheTokens = 0
  let cost = 0
  for (const f of facts) {
    outputTokens += f.outputTokens
    inputTokens += f.inputTokens
    cacheTokens += f.cacheCreationTokens + f.cacheReadTokens
    cost += f.cost
  }
  return { outputTokens, inputTokens, cacheTokens, cost, costPerMOutput: perM(cost, outputTokens) }
}

export function perM(cost: number, output: number): number | undefined {
  return output > 0 ? (cost / output) * 1_000_000 : undefined
}

export interface GroupRow extends Totals {
  key: string
}

export function groupBy(facts: UsageFact[], key: (f: UsageFact) => string): GroupRow[] {
  const map = new Map<string, UsageFact[]>()
  for (const f of facts) {
    const k = key(f)
    let list = map.get(k)
    if (!list) map.set(k, (list = []))
    list.push(f)
  }
  return [...map.entries()]
    .map(([k, list]) => ({ key: k, ...totals(list) }))
    .sort((a, b) => b.outputTokens - a.outputTokens)
}

export const OTHER = 'Other'

/**
 * Stable series identity: the top N models by all-time output keep a slot;
 * the rest fold into "Other". Computed on the full dataset so filtering the
 * date range never repaints a model.
 */
export function seriesOrder(facts: UsageFact[], max = 5): string[] {
  const ranked = groupBy(facts, (f) => f.model).map((g) => g.key)
  return ranked.length <= max ? ranked : [...ranked.slice(0, max), OTHER]
}

export function seriesOf(model: string, order: string[]): string {
  return order.includes(model) ? model : OTHER
}

export type Bucket = 'day' | 'week'

/** Monday of the week containing iso. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow = (date.getDay() + 6) % 7
  return isoDate(new Date(y, m - 1, d - dow))
}

export interface TimePoint {
  date: string
  /** series -> value */
  values: Record<string, number>
  total: number
  outputTokens: number
  cost: number
  costPerMOutput: number | undefined
}

export type Metric = 'outputTokens' | 'cost'

/** Dense time series (every bucket present, zero-filled) split by model series. */
export function timeSeries(
  facts: UsageFact[],
  w: { start: string; end: string },
  order: string[],
  metric: Metric,
  bucket: Bucket,
): TimePoint[] {
  const keyOf = (iso: string) => (bucket === 'week' ? weekStart(iso) : iso)
  const points = new Map<string, TimePoint>()
  const step = bucket === 'week' ? 7 : 1
  for (let d = keyOf(w.start); d <= w.end; d = addDays(d, step)) {
    points.set(d, {
      date: d,
      values: Object.fromEntries(order.map((s) => [s, 0])),
      total: 0,
      outputTokens: 0,
      cost: 0,
      costPerMOutput: undefined,
    })
  }
  for (const f of facts) {
    const p = points.get(keyOf(f.date))
    if (!p) continue
    const s = seriesOf(f.model, order)
    const v = metric === 'cost' ? f.cost : f.outputTokens
    p.values[s] = (p.values[s] ?? 0) + v
    p.total += v
    p.outputTokens += f.outputTokens
    p.cost += f.cost
  }
  for (const p of points.values()) p.costPerMOutput = perM(p.cost, p.outputTokens)
  return [...points.values()]
}

export function pctChange(curr: number | undefined, prev: number | undefined): number | undefined {
  if (curr === undefined || prev === undefined || prev === 0) return undefined
  return (curr - prev) / prev
}
