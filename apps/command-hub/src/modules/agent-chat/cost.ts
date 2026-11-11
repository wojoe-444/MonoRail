import { turnCost } from './live'
import type { CallUsage, ChatMessage, ChatTotal, LiveTurn } from './types'

/** Token weights for splitting a reply's cost when calls have no logged cost (T2). */
export const WEIGHTS = { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 }

export function callWeight(c: CallUsage): number {
  return c.input * WEIGHTS.input + c.output * WEIGHTS.output + c.cacheWrite * WEIGHTS.cacheWrite + c.cacheRead * WEIGHTS.cacheRead
}

export interface CostedCall extends CallUsage {
  /** The call's cost: logged, or this call's share of the reply's cost. */
  cost?: number
  estimate?: boolean
}

export interface ReplyCost {
  calls: CostedCall[]
  /** The reply's total; exact when known. */
  total?: number
}

/**
 * Cost per model call. A logged cost is used as it is. Otherwise the reply's
 * cost (when known) minus the logged part is split over the other calls by
 * token weight, and those shares are marked as estimates. The shares always
 * add up to the reply's cost.
 */
export function costCalls(calls: CallUsage[], replyUsd?: number): ReplyCost {
  const logged = calls.reduce((n, c) => n + (c.costUsd ?? 0), 0)
  const rest = calls.filter((c) => c.costUsd === undefined)
  if (rest.length === 0) return { calls: calls.map((c) => ({ ...c, cost: c.costUsd })), total: calls.length ? (replyUsd ?? logged) : replyUsd }
  if (replyUsd === undefined) return { calls: calls.map((c) => ({ ...c, cost: c.costUsd })), total: undefined }
  const remaining = Math.max(0, replyUsd - logged)
  const weight = rest.reduce((n, c) => n + callWeight(c), 0)
  const out: CostedCall[] = calls.map((c) => {
    if (c.costUsd !== undefined) return { ...c, cost: c.costUsd }
    const share = weight > 0 ? (callWeight(c) / weight) * remaining : remaining / rest.length
    return { ...c, cost: share, estimate: true }
  })
  return { calls: out, total: replyUsd }
}

/** The model calls of a live turn: one per message id (the last usage seen wins). */
export function turnCalls(turn: LiveTurn): CallUsage[] {
  const byId = new Map<string, CallUsage>()
  let anon = 0
  for (const e of turn.events) {
    if (e.t !== 'usage') continue
    const { t: _t, id, ...u } = e
    byId.set(id ?? `anon-${anon++}`, u)
  }
  return [...byId.values()]
}

export function liveReplyCost(turn: LiveTurn): ReplyCost {
  return costCalls(turnCalls(turn), turnCost(turn)?.turnUsd)
}

export interface HistoryReply {
  /** Index in the message list of the reply's last message; details render after it. */
  endIndex: number
  calls: CallUsage[]
}

/**
 * Replies in a history: the messages after each user prompt. Each reply's
 * model calls are its assistant messages' usage, plus subagent calls that
 * happened before the next prompt.
 */
export function historyReplies(messages: ChatMessage[], subagentCalls: CallUsage[] = []): HistoryReply[] {
  const replies: (HistoryReply & { start?: number })[] = []
  let current: (HistoryReply & { start?: number }) | undefined
  messages.forEach((m, i) => {
    if (m.role === 'user') {
      current = undefined
      return
    }
    if (m.role !== 'assistant') return
    if (!current) {
      current = { endIndex: i, calls: [], start: m.ts }
      replies.push(current)
    }
    current.endIndex = i
    if (m.usage) current.calls.push({ ...m.usage, model: m.usage.model ?? m.model, ts: m.ts })
  })
  // Subagent calls go to the last reply that started before them.
  for (const c of subagentCalls) {
    if (c.ts === undefined) continue
    let target: (typeof replies)[number] | undefined
    for (const r of replies) if (r.start !== undefined && r.start <= c.ts) target = r
    target?.calls.push(c)
  }
  return replies.filter((r) => r.calls.length > 0).map(({ start: _s, ...r }) => r)
}

/**
 * The chat total to show: the newest running total a Claude turn reported,
 * or the total read from disk plus the turns sent since the chat was opened.
 */
export function chatTotalView(base: ChatTotal | undefined, turns: LiveTurn[]): { total?: ChatTotal; sinceOpened: number } {
  let sinceOpened = 0
  let total = base
  for (const t of turns) {
    const c = turnCost(t)
    if (!c) continue
    if (c.sessionUsd !== undefined) {
      total = { usd: c.sessionUsd, complete: true }
      sinceOpened = 0
    } else if (c.turnUsd !== undefined) sinceOpened += c.turnUsd
  }
  return { total, sinceOpened }
}
