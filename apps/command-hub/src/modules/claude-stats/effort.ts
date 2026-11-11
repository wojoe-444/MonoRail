import { perM, type GroupRow } from './transform'
import type { UsageFact } from './types'

/**
 * Effort as logged: Claude Code's per-response effort, pi's thinking level.
 * Levels are ordinal, so they get one hue in steps of strength (a sequential
 * ramp) instead of categorical colors; "not logged" is the neutral Other grey.
 */
export const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export const NOT_LOGGED = 'Not logged'

export function effortKey(f: { effort?: string }): string {
  return f.effort ?? NOT_LOGGED
}

/** Levels present in `facts`, lowest first, unknown levels after the known ones, "Not logged" last. */
export function effortOrder(facts: { effort?: string }[]): string[] {
  const seen = new Set(facts.map(effortKey))
  const known = EFFORT_LEVELS.filter((l) => seen.has(l)) as string[]
  const unknown = [...seen].filter((l) => l !== NOT_LOGGED && !known.includes(l)).sort()
  return [...known, ...unknown, ...(seen.has(NOT_LOGGED) ? [NOT_LOGGED] : [])]
}

/** Ramp color for a level, by its rank among the logged levels in `order` (ranked on the full dataset). */
export function effortColor(order: string[], level: string): string {
  if (level === NOT_LOGGED) return 'var(--series-other)'
  const logged = order.filter((l) => l !== NOT_LOGGED)
  const i = logged.indexOf(level)
  const pct = logged.length <= 1 ? 100 : Math.round(40 + (60 * Math.max(i, 0)) / (logged.length - 1))
  return `color-mix(in oklab, var(--series-1) ${pct}%, var(--card))`
}

export function effortName(level: string): string {
  return level === NOT_LOGGED ? level : level === 'xhigh' ? 'Extra high' : level[0].toUpperCase() + level.slice(1)
}

export interface EffortRow extends GroupRow {
  /** Model calls, counted only where the scan logged them. */
  calls: number
  /** Cost of the facts that carry a call count, so cost per call never mixes in uncounted days. */
  callCost: number
  thinking: number
  thinkingEstimated: number
  /** Output tokens of the facts that are allowed to carry a thinking count (not ccusage-only days). */
  thinkingOutput: number
}

function emptyRow(key: string): EffortRow {
  return {
    key,
    inputTokens: 0,
    outputTokens: 0,
    cacheTokens: 0,
    cost: 0,
    costPerMOutput: undefined,
    calls: 0,
    callCost: 0,
    thinking: 0,
    thinkingEstimated: 0,
    thinkingOutput: 0,
  }
}

/** Totals per key with call counts and thinking tokens. */
export function effortRows(facts: UsageFact[], key: (f: UsageFact) => string): Map<string, EffortRow> {
  const rows = new Map<string, EffortRow>()
  for (const f of facts) {
    const k = key(f)
    const r = rows.get(k) ?? emptyRow(k)
    r.inputTokens += f.inputTokens
    r.outputTokens += f.outputTokens
    r.cacheTokens += f.cacheCreationTokens + f.cacheReadTokens
    r.cost += f.cost
    if (f.requests) {
      r.calls += f.requests
      r.callCost += f.cost
      r.thinkingOutput += f.outputTokens
    }
    r.thinking += f.thinkingTokens ?? 0
    r.thinkingEstimated += f.thinkingEstimated ?? 0
    rows.set(k, r)
  }
  for (const r of rows.values()) r.costPerMOutput = perM(r.cost, r.outputTokens)
  return rows
}

export function costPerCall(r: EffortRow | undefined): number | undefined {
  return r && r.calls > 0 ? r.callCost / r.calls : undefined
}

/** Thinking tokens as a share of output, over the facts that can carry a count. */
export function thinkingShare(r: EffortRow | undefined): number | undefined {
  return r && r.thinkingOutput > 0 && r.thinking > 0 ? r.thinking / r.thinkingOutput : undefined
}
