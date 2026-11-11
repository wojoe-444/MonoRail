import type { SessionFact, SourceId, UsageFact, UsageReport } from './types'

/** "claude-opus-4-1-20250805" -> "Opus 4.1", "claude-3-5-sonnet-20241022" -> "Sonnet 3.5". */
export function modelLabel(raw: string): string {
  const gem = /^(?:.*\/)?gemini-([\d.]+)-([a-z]+(?:-[a-z]+)?)/i.exec(raw)
  if (gem) {
    const kind = gem[2].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
    return `Gemini ${gem[1]} ${kind.replace(/ Preview$/, '')}`
  }
  const name = raw.replace(/^anthropic[./]/, '').replace(/^claude-/, '').replace(/-\d{8}$/, '').replace(/\[.*\]$/, '')
  const parts = name.split('-')
  const family = parts.find((p) => /^(opus|sonnet|haiku|fable|instant)$/i.test(p))
  if (!family) return raw
  const version = parts.filter((p) => /^\d+(\.\d+)?$/.test(p)).join('.')
  const fam = family[0].toUpperCase() + family.slice(1).toLowerCase()
  return version ? `${fam} ${version}` : fam
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  pi: 'pi',
}

/** Model label, marked with its source unless it ran in Claude Code: "Sonnet 4.5 · pi". */
export function sourceModelLabel(raw: string, source: SourceId = 'claude-code'): string {
  const label = modelLabel(raw)
  return source === 'claude-code' ? label : `${label} · ${SOURCE_LABELS[source]}`
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
          source: 'claude-code',
          rawModel: b.modelName,
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

/** Days, counted back from the newest usage, that decide which models keep a color. */
export const RECENT_RANK_DAYS = 30

/**
 * Stable series identity: the top N models keep a slot; the rest fold into
 * "Other". Models are ranked by output in the last 30 days of data, then by
 * all-time output, so a model you switched to recently gets its own color
 * instead of hiding in "Other" behind models you no longer use. Computed on
 * the full dataset, never the current filters, so filtering never repaints a
 * model.
 */
export function seriesOrder(facts: UsageFact[], max = 5, key: (f: UsageFact) => string = (f) => f.model): string[] {
  const last = facts.reduce((m, f) => (f.date > m ? f.date : m), '')
  const since = last ? addDays(last, -(RECENT_RANK_DAYS - 1)) : ''
  const recent = new Map<string, number>()
  const all = new Map<string, number>()
  for (const f of facts) {
    const k = key(f)
    all.set(k, (all.get(k) ?? 0) + f.outputTokens)
    if (f.date >= since) recent.set(k, (recent.get(k) ?? 0) + f.outputTokens)
  }
  const ranked = [...all.keys()].sort((a, b) => (recent.get(b) ?? 0) - (recent.get(a) ?? 0) || all.get(b)! - all.get(a)!)
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

/** Dense time series (every bucket present, zero-filled) split into series. */
export function timeSeries<T extends { date: string; outputTokens: number; cost: number }>(
  rows: T[],
  w: { start: string; end: string },
  order: string[],
  seriesKey: (row: T) => string,
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
  for (const r of rows) {
    const p = points.get(keyOf(r.date))
    if (!p) continue
    const k = seriesOf(seriesKey(r), order)
    const v = metric === 'cost' ? r.cost : r.outputTokens
    p.values[k] = (p.values[k] ?? 0) + v
    p.total += v
    p.outputTokens += r.outputTokens
    p.cost += r.cost
  }
  for (const p of points.values()) p.costPerMOutput = perM(p.cost, p.outputTokens)
  return [...points.values()]
}

export function pctChange(curr: number | undefined, prev: number | undefined): number | undefined {
  if (curr === undefined || prev === undefined || prev === 0) return undefined
  return (curr - prev) / prev
}

// ---------------------------------------------------------------- session partners

/** A day x phase x model slice of a session phase, priced. */
export interface PartnerFact {
  date: string
  phaseKey: string
  sessionId: string
  combo: string
  model: string
  role: 'driver' | 'subagent'
  outputTokens: number
  cost: number
  /** The phase's effort (Claude Code) or thinking level (pi), when logged. */
  effort?: string
}

export interface PhaseSummary {
  key: string
  sessionId: string
  project: string
  combo: string
  driver?: string
  subagents: string[]
  effort?: string
  start: string
  end: string
  outputTokens: number
  cost: number
}

/**
 * The partner label for a phase: the driver first, then the distinct models
 * its subagents ran on. "Sonnet 5.5 solo" when no subagents ran.
 */
export function comboLabel(driver: string | undefined, subagents: string[]): string {
  if (!driver) return 'Subagents only'
  if (!subagents.length) return `${driver} solo`
  const others = subagents.filter((s) => s !== driver)
  return others.length ? [driver, ...others].join(' + ') : `${driver} + own subagents`
}

/**
 * Price phase tokens from the priced facts: each model's API-equivalent cost
 * per output token in the same session, else the same day, else the model's
 * overall average, applied to the phase's output for that model.
 */
function rateTables(facts: UsageFact[]) {
  const agg = new Map<string, { cost: number; output: number }>()
  const add = (k: string, f: UsageFact) => {
    const a = agg.get(k) ?? { cost: 0, output: 0 }
    a.cost += f.cost
    a.output += f.outputTokens
    agg.set(k, a)
  }
  for (const f of facts) {
    const m = f.rawModel ?? f.model
    if (f.sessionId) add(`s|${f.sessionId}|${m}`, f)
    add(`d|${f.date}|${m}`, f)
    add(`o|${m}`, f)
  }
  const rate = (k: string) => {
    const a = agg.get(k)
    return a && a.output > 0 ? a.cost / a.output : undefined
  }
  return (sessionId: string, date: string, model: string) =>
    rate(`s|${sessionId}|${model}`) ?? rate(`d|${date}|${model}`) ?? rate(`o|${model}`) ?? 0
}

export function normalizePartners(
  report: UsageReport,
  priced: UsageFact[],
  source?: SourceId,
): { facts: PartnerFact[]; phases: PhaseSummary[] } {
  const raw = (report.partners?.phases ?? []).filter((p) => !source || (p.source ?? 'claude-code') === source)
  const rate = rateTables(priced)
  const facts: PartnerFact[] = []
  const phases: PhaseSummary[] = []
  raw.forEach((p, i) => {
    const driver = p.driver ? sourceModelLabel(p.driver, p.source) : undefined
    const subagents = [...new Set(p.facts.filter((f) => f.role === 'subagent').map((f) => sourceModelLabel(f.model, p.source)))].sort()
    const combo = comboLabel(driver, subagents)
    const key = `${p.sessionId}#${i}`
    let outputTokens = 0
    let cost = 0
    for (const f of p.facts) {
      const c = f.output * rate(p.sessionId, f.date, f.model)
      outputTokens += f.output
      cost += c
      facts.push({
        date: f.date,
        phaseKey: key,
        sessionId: p.sessionId,
        combo,
        model: sourceModelLabel(f.model, p.source),
        role: f.role,
        outputTokens: f.output,
        cost: c,
        effort: p.effort,
      })
    }
    phases.push({
      key,
      sessionId: p.sessionId,
      project: projectLabel(p.project),
      combo,
      driver,
      subagents,
      effort: p.effort,
      start: p.start,
      end: p.end,
      outputTokens,
      cost,
    })
  })
  return { facts, phases }
}

export interface ComboRow extends GroupRow {
  phases: number
  sessions: number
  /** Share of the combo's output produced by subagents. */
  subagentShare: number
}

export function groupCombos(facts: PartnerFact[], order: string[]): ComboRow[] {
  const map = new Map<string, { output: number; cost: number; sub: number; phases: Set<string>; sessions: Set<string> }>()
  for (const f of facts) {
    const k = seriesOf(f.combo, order)
    let a = map.get(k)
    if (!a) map.set(k, (a = { output: 0, cost: 0, sub: 0, phases: new Set(), sessions: new Set() }))
    a.output += f.outputTokens
    a.cost += f.cost
    if (f.role === 'subagent') a.sub += f.outputTokens
    a.phases.add(f.phaseKey)
    a.sessions.add(f.sessionId)
  }
  return [...map.entries()]
    .map(([key, a]) => ({
      key,
      outputTokens: a.output,
      inputTokens: 0,
      cacheTokens: 0,
      cost: a.cost,
      costPerMOutput: perM(a.cost, a.output),
      phases: a.phases.size,
      sessions: a.sessions.size,
      subagentShare: a.output ? a.sub / a.output : 0,
    }))
    .sort((a, b) => b.outputTokens - a.outputTokens)
}

/** Top combos by all-time output keep a color; the rest fold into "Other". */
export function comboOrder(facts: PartnerFact[], max = 5): string[] {
  const totals = new Map<string, number>()
  for (const f of facts) totals.set(f.combo, (totals.get(f.combo) ?? 0) + f.outputTokens)
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  return ranked.length <= max ? ranked : [...ranked.slice(0, max), OTHER]
}
