import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { Args, Method, MethodCall, MethodResult, Result } from '@/ipc/contract'
import { isDesktop, moduleClient } from '@/modules/client'

import { sampleInvoke } from './sample'

/**
 * Which catalog answered the page's status call: the copy on this PC of the
 * BigQuery dataset (while BigQuery metadata is set up), the OpenMetadata
 * server, or MonoRail's local database. The backend picks it; the page has no
 * switch. Every later call names the same one so a page never mixes two.
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
const live = moduleClient('openmetadata')
export function call<C extends MethodCall<'openmetadata'>>(...request: C): Promise<MethodResult<'openmetadata', C>> {
  const [method, args] = request
  const withSource = source && !(args && 'source' in args) ? { source, ...args } : args
  // The catalog source is the only transport detail added by this adapter.
  const enriched = (withSource !== args ? [method, withSource] : request) as C
  return isDesktop() ? live(...enriched) : sampleInvoke(method, args)
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
type CatalogQuery = {
  [M in Method<'openmetadata'>]: [method: M, args: Args<'openmetadata', M> | null, refreshKey?: unknown]
}[Method<'openmetadata'>]

export function useCall<C extends CatalogQuery>(...query: C): CallState<Result<'openmetadata', C[0]>> {
  const [method, args, refreshKey] = query
  type T = Result<'openmetadata', C[0]>
  const key = args === null ? null : JSON.stringify([args, refreshKey])
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; loading: boolean }>({ key: null, loading: false })
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const version = useDataVersion()

  useEffect(() => {
    if (key === null) return
    const id = ++seq.current
    // oxlint-disable-next-line react/set-state-in-effect -- Mark the new catalog request as pending before delivering its result.
    setState((s) => ({ key, data: s.key === key ? s.data : undefined, loading: true }))
    const [payload] = JSON.parse(key)
    const request = [method, payload ?? undefined] as MethodCall<'openmetadata'>
    call(...request).then(
      (data) => id === seq.current && setState({ key, data: data as T, loading: false }),
      (e: unknown) => id === seq.current && setState({ key, error: errorText(e), loading: false }),
    )
  }, [method, key, tick, version])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  const current = state.key === key
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: key !== null && (!current || state.loading), reload }
}
