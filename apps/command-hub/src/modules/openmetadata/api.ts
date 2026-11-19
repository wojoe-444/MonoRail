import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

import { sampleInvoke } from './sample'

/**
 * Which catalog the page reads: MonoRail's local database, the copy of the
 * BigQuery dataset that is the source of truth, or the OpenMetadata server.
 * Unset: the backend's default.
 */
export type Source = 'local' | 'bigquery' | 'server'
let source: Source | undefined
/** Set by the page before its children load; every call then names it. */
export function setSource(s: Source | undefined) {
  source = s
}
/** Whether the catalog being read takes edits. BigQuery is read-only for now: MonoRail does not write entities to it. */
export const canEdit = () => source !== 'bigquery'

/** Call the OpenMetadata backend; in the browser dev server, the fictional sample catalog. */
export function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  const withSource = source && !(args && 'source' in args) ? { source, ...args } : args
  return isDesktop() ? invokeModule<T>('openmetadata', method, withSource) : sampleInvoke<T>(method, args)
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/**
 * Bumped when the catalog's data changed under the page (a BigQuery sync
 * finished). Every useCall then reloads in place, keeping its data meanwhile,
 * so open lists and entities refresh without the page losing its place.
 */
let dataVersion = 0
const dataListeners = new Set<() => void>()
export function refreshData() {
  dataVersion++
  for (const l of dataListeners) l()
}
const subscribeData = (l: () => void) => {
  dataListeners.add(l)
  return () => void dataListeners.delete(l)
}
export const useDataVersion = () => useSyncExternalStore(subscribeData, () => dataVersion)

export interface CallState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
  reload: () => void
}

/**
 * Load from the backend when `args` change (compared as JSON). `null` args load nothing.
 * Keeps the last data while reloading the same request.
 */
export function useCall<T>(method: string, args: Record<string, unknown> | null): CallState<T> {
  const key = args === null ? null : JSON.stringify(args)
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; loading: boolean }>({ key: null, loading: false })
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const version = useDataVersion()

  useEffect(() => {
    if (key === null) return
    const id = ++seq.current
    setState((s) => ({ key, data: s.key === key ? s.data : undefined, loading: true }))
    call<T>(method, JSON.parse(key) as Record<string, unknown>).then(
      (data) => id === seq.current && setState({ key, data, loading: false }),
      (e: unknown) => id === seq.current && setState({ key, error: errorText(e), loading: false }),
    )
  }, [method, key, tick, version])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  const current = state.key === key
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: key !== null && (!current || state.loading), reload }
}
