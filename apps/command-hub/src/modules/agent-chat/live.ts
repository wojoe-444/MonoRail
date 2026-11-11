import type { ChatBlock, ChatMessage, LiveTurn, TurnEvent } from './types'

/**
 * Turn the events of a live turn into transcript messages: the prompt, then
 * one assistant message per model message, with streamed text, tool results
 * and denials folded in.
 */
export function turnToMessages(turn: LiveTurn): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'user', ts: turn.startedAt, blocks: [{ type: 'text', text: turn.prompt }] }]
  const byId = new Map<string, ChatMessage>()
  const tools = new Map<string, Extract<ChatBlock, { type: 'tool' }>>()
  let current: ChatMessage | undefined
  let pending = ''

  const open = (id?: string, model?: string): ChatMessage => {
    const key = id ?? `anon-${out.length}`
    let m = byId.get(key)
    if (!m) {
      m = { role: 'assistant', model, blocks: [] }
      byId.set(key, m)
      out.push(m)
    }
    if (model && !m.model) m.model = model
    current = m
    return m
  }

  for (const e of turn.events) {
    switch (e.t) {
      case 'message_start':
        open(e.id)
        pending = ''
        break
      case 'delta':
        if (!current) open()
        pending += e.text
        break
      case 'assistant': {
        const m = open(e.id, e.model)
        for (const b of e.blocks) {
          const copy = { ...b }
          if (copy.type === 'text') pending = '' // the full text replaces what streamed
          m.blocks.push(copy)
          if (copy.type === 'tool' && copy.id) tools.set(copy.id, copy)
        }
        break
      }
      case 'tool_result': {
        const tool = tools.get(e.toolUseId)
        if (tool) {
          tool.result = e.result
          tool.isError = e.isError
        }
        break
      }
      case 'denied':
        ;(current ?? open()).blocks.push({ type: 'denied', kind: e.kind, tool: e.tool, summary: e.summary, reason: e.reason })
        break
      case 'error':
        out.push({ role: 'system', blocks: [{ type: 'text', text: e.message }] })
        current = undefined
        break
      default:
        break
    }
  }
  if (pending && current) current.blocks.push({ type: 'text', text: pending })
  return out.filter((m) => m.role !== 'assistant' || m.blocks.length > 0)
}

/** Context use of the last model request in a turn: input plus cache tokens. */
export function contextUse(turn: LiveTurn | undefined): { used: number; window?: number; model?: string } | undefined {
  if (!turn) return undefined
  let last: Extract<TurnEvent, { t: 'usage' }> | undefined
  let window: number | undefined
  for (const e of turn.events) {
    if (e.t === 'usage') last = e
    if (e.t === 'result' && e.contextWindow) window = e.contextWindow
  }
  return last ? { used: last.input + last.cacheRead + last.cacheWrite, window, model: last.model } : undefined
}

export function turnCost(turn: LiveTurn): Extract<TurnEvent, { t: 'cost' }> | undefined {
  for (let i = turn.events.length - 1; i >= 0; i--) {
    const e = turn.events[i]
    if (e.t === 'cost') return e
  }
  return undefined
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export function formatUsd(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${Number((n / 1_000_000).toFixed(1))}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}
