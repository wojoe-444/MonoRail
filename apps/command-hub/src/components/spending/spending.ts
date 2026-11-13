import { useCallback, useEffect, useState } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

/**
 * The spending limit (off by default): a cap on what agent turns MonoRail runs
 * may spend. The backend is Chat's (electron/modules/agent-chat-spending.cjs),
 * because every such turn starts there; this file is the page side, shared by
 * the Settings card and Chat's meter.
 */
export interface SpendingSettings {
  enabled: boolean
  dailyUsd: number | null
  monthlyUsd: number | null
  warnAt: number
  onLimit: 'stop' | 'warn'
}

export type SpendingState = 'off' | 'ok' | 'warn' | 'reached'

export interface SpendingMeter {
  spent: number
  limit: number | null
  pct: number | null
  state: 'ok' | 'warn' | 'reached'
}

export interface LiveSpending {
  state: SpendingState
  settings: SpendingSettings
  /** Which limit sets the state. */
  period?: 'day' | 'month'
  /** New turns are paused. */
  blocked: boolean
  /** The limit is reached but the next turn was allowed by hand. */
  allowOnce: boolean
  daily: SpendingMeter
  monthly: SpendingMeter
  resetsAt?: number
  monthLabel: string
}

export type SpendingStatus = LiveSpending | { state: 'damaged'; message: string }

const MODULE = 'agent-chat'

/** Browser dev server only: fictional numbers, with the limit on so the UI shows. */
let sample: LiveSpending = {
  state: 'warn',
  period: 'day',
  blocked: false,
  allowOnce: false,
  settings: { enabled: true, dailyUsd: 25, monthlyUsd: 300, warnAt: 80, onLimit: 'stop' },
  daily: { spent: 21.4, limit: 25, pct: 85.6, state: 'warn' },
  monthly: { spent: 118.9, limit: 300, pct: 39.6, state: 'ok' },
  monthLabel: 'November',
}

async function call(method: string, args?: unknown): Promise<SpendingStatus> {
  if (isDesktop()) return invokeModule<SpendingStatus>(MODULE, method, args)
  if (method === 'setSpending') {
    const s = (args as { settings: SpendingSettings }).settings
    sample = { ...sample, settings: s, state: s.enabled ? sample.daily.state : 'off' }
  }
  return sample
}

const listeners = new Set<(s: SpendingStatus) => void>()
/** Tell every mounted view about a new status (e.g. after saving in Settings). */
function publish(s: SpendingStatus) {
  for (const l of listeners) l(s)
  return s
}

export const saveSpending = (settings: SpendingSettings) => call('setSpending', { settings }).then(publish)
export const allowOneMoreTurn = () => call('allowOneMoreTurn').then(publish)
export const resetSpending = () => call('resetSpending').then(publish)

/**
 * The current status, refetched whenever `refreshKey` changes (Chat passes the
 * newest turn's state, so the meter moves when a reply finishes).
 */
export function useSpending(refreshKey?: unknown) {
  const [status, setStatus] = useState<SpendingStatus>()
  const [error, setError] = useState<string>()
  const refresh = useCallback(() => {
    call('getSpending').then(
      (s) => {
        setStatus(s)
        setError(undefined)
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    )
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])
  useEffect(() => {
    listeners.add(setStatus)
    return () => {
      listeners.delete(setStatus)
    }
  }, [])
  return { status, error, refresh }
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "$25" for whole limits, "$25.50" otherwise. */
export function formatLimit(n: number): string {
  return Number.isInteger(n) ? `$${n.toLocaleString('en-US')}` : formatMoney(n)
}

export function resetsLabel(s: LiveSpending): string {
  return s.period === 'month' ? 'on the 1st' : 'at midnight'
}
