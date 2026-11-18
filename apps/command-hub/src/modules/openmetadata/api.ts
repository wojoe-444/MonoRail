import { useCallback, useEffect, useRef, useState } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

import { sampleInvoke } from './sample'

/** Call the OpenMetadata backend; in the browser dev server, the fictional sample catalog. */
export function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  return isDesktop() ? invokeModule<T>('openmetadata', method, args) : sampleInvoke<T>(method, args)
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

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

  useEffect(() => {
    if (key === null) return
    const id = ++seq.current
    setState((s) => ({ key, data: s.key === key ? s.data : undefined, loading: true }))
    call<T>(method, JSON.parse(key) as Record<string, unknown>).then(
      (data) => id === seq.current && setState({ key, data, loading: false }),
      (e: unknown) => id === seq.current && setState({ key, error: errorText(e), loading: false }),
    )
  }, [method, key, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  const current = state.key === key
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: key !== null && (!current || state.loading), reload }
}
