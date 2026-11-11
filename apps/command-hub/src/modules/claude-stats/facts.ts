import { findPrice, isAboveTier, normalizeModelId, priceTokens, sumParts, type CostParts } from './pricing'
import { normalize, projectLabel, SOURCE_LABELS, sourceModelLabel } from './transform'
import type { ScanSource, SessionFact, UsageFact, UsageReport } from './types'

export { SOURCE_LABELS }

export interface FactSet {
  facts: UsageFact[]
  sessions: SessionFact[]
  sources: ScanSource[]
  /** Models seen in the logs that have no price-table row. */
  unpriced: string[]
}

/**
 * Turn a report into priced facts (day x session x model x role x context step).
 *
 * Cost basis, per source:
 * - Claude Code: ccusage's API-equivalent cost for the day and model, spread over
 *   that day's requests by their list-price share (so prompt-size tiers and the
 *   token-type split follow the price table while totals match ccusage). Without
 *   ccusage, list prices.
 * - pi: the cost pi logged per token type, when every request in the row has one.
 * - Gemini CLI (and anything pi did not price): list prices.
 * Token-type splits that do not come from the log are flagged as estimates.
 */
export function buildFacts(report: UsageReport): FactSet {
  const scan = report.scan
  if (!scan) {
    const legacy = normalize(report)
    return {
      facts: legacy.facts,
      sessions: legacy.sessions,
      sources: [{ id: 'claude-code', label: 'Claude Code', found: true }],
      unpriced: [],
    }
  }

  // ccusage cost per day x model (Claude Code only).
  const ccusage = new Map<string, number>()
  for (const rows of Object.values(report.daily?.projects ?? {})) {
    for (const r of rows) {
      for (const b of r.modelBreakdowns ?? []) {
        const k = `${r.date}|${normalizeModelId(b.modelName)}`
        ccusage.set(k, (ccusage.get(k) ?? 0) + b.cost)
      }
    }
  }

  const unpriced = new Set<string>()
  const pending = scan.requests.map((r) => {
    const price = findPrice(r.model)
    if (!price) unpriced.add(r.model)
    const table: CostParts = price ? priceTokens(price, r.step, r) : { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
    const loggedAll = r.logged && r.logged.n === r.n ? r.logged : undefined
    return { r, price, table, loggedAll }
  })

  // Scale Claude Code rows so each day x model sums to ccusage's cost.
  const claudeKey = (date: string, model: string) => `${date}|${normalizeModelId(model)}`
  const groups = new Map<string, { table: number; output: number; priced: boolean }>()
  for (const p of pending) {
    if (p.r.source !== 'claude-code') continue
    const k = claudeKey(p.r.date, p.r.model)
    const g = groups.get(k) ?? { table: 0, output: 0, priced: !!p.price }
    g.table += sumParts(p.table)
    g.output += p.r.output
    groups.set(k, g)
  }

  const facts: UsageFact[] = pending.map(({ r, price, table, loggedAll }) => {
    let parts: CostParts = table
    let estimated = true
    if (loggedAll) {
      parts = { input: loggedAll.input, output: loggedAll.output, cacheWrite: loggedAll.cacheWrite, cacheRead: loggedAll.cacheRead }
      estimated = false
    } else if (r.source === 'claude-code') {
      const k = claudeKey(r.date, r.model)
      const target = ccusage.get(k)
      const g = groups.get(k)!
      // ccusage at zero for tokens the price table can price means ccusage
      // doesn't know the model yet: keep the list price instead of a $0 row.
      if (target !== undefined && g.table > 0 && target > 0) {
        const f = target / g.table
        parts = { input: table.input * f, output: table.output * f, cacheWrite: table.cacheWrite * f, cacheRead: table.cacheRead * f }
      } else if (target !== undefined && target > 0 && g.table === 0 && g.output > 0) {
        // No price row: spread ccusage's cost by output, with no token-type split.
        const share = (target * r.output) / g.output
        parts = { input: 0, output: share, cacheWrite: 0, cacheRead: 0 }
      }
    }
    return {
      date: r.date,
      source: r.source,
      project: projectLabel(r.project),
      sessionId: r.sessionId,
      model: sourceModelLabel(r.model, r.source),
      rawModel: r.model,
      role: r.role,
      step: r.step,
      requests: r.n,
      inputTokens: r.input,
      outputTokens: r.output,
      cacheCreationTokens: r.cw5m + r.cw1h,
      cacheReadTokens: r.cacheRead,
      cost: sumParts(parts),
      parts,
      partsEstimated: estimated,
      priced: !!price,
      aboveTier: isAboveTier(price, r.step),
      tierAbove: price?.tier?.above,
    }
  })

  const times = new Map(scan.sessions.map((s) => [s.sessionId, s]))
  const bySession = new Map<string, SessionFact>()
  for (const f of facts) {
    if (!f.sessionId) continue
    let s = bySession.get(f.sessionId)
    if (!s) {
      const t = times.get(f.sessionId)
      s = {
        source: f.source,
        id: f.sessionId,
        project: f.project,
        firstActivity: t?.first,
        lastActivity: t?.last ?? f.date,
        models: [],
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      }
      bySession.set(f.sessionId, s)
    }
    if (!s.models.includes(f.model)) s.models.push(f.model)
    s.outputTokens += f.outputTokens
    s.totalTokens += f.inputTokens + f.outputTokens + f.cacheCreationTokens + f.cacheReadTokens
    s.cost += f.cost
  }

  return { facts, sessions: [...bySession.values()], sources: scan.sources, unpriced: [...unpriced] }
}

/** Model family for share comparisons: "Opus 4.6" -> "Opus", "Gemini 2.5 Pro" -> "Gemini Pro". */
export function modelFamily(label: string): string {
  const words = label.split(' · ')[0].split(' ')
  if (words[0] === 'Gemini') return ['Gemini', ...words.slice(2)].join(' ') || 'Gemini'
  return words[0]
}

/** Series key for a fact: the model, or the model split at its price tier when the breakout is on. */
export function modelSeriesKey(f: UsageFact, breakout: boolean): string {
  if (!breakout || f.tierAbove === undefined) return f.model
  const k = `${Math.round(f.tierAbove / 1000)}K`
  return f.aboveTier ? `${f.model} >${k}` : `${f.model} ≤${k}`
}
