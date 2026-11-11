import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** True when running inside the Electron app (preload bridge is present). */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.commandHub
}

export class ModuleUnavailableError extends Error {
  constructor() {
    super('Local data is only available in the desktop app.')
    this.name = 'ModuleUnavailableError'
  }
}

/** Call a method on a module's backend in the Electron main process. */
export async function invokeModule<T>(moduleId: string, method: string, args?: unknown): Promise<T> {
  if (!window.commandHub) throw new ModuleUnavailableError()
  return window.commandHub.invoke<T>(moduleId, method, args)
}

export interface ModuleQuery<T> {
  data: T | undefined
  error: Error | undefined
  /** True for the first load (no data yet). */
  loading: boolean
  /** True while any request is in flight, including refreshes. */
  fetching: boolean
  refresh: (args?: unknown) => Promise<void>
}

/**
 * Load data from a module backend. Keeps the previous data while refetching
 * so views can hold their frame instead of flashing a skeleton.
 */
export function useModuleQuery<T>(
  moduleId: string,
  method: string,
  args?: unknown,
  { enabled = isDesktop() }: { enabled?: boolean } = {},
): ModuleQuery<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [fetching, setFetching] = useState(enabled)
  const argsRef = useRef(args)
  useLayoutEffect(() => {
    argsRef.current = args
  })
  const seq = useRef(0)

  const run = useCallback(
    async (override?: unknown) => {
      const id = ++seq.current
      setFetching(true)
      try {
        const result = await invokeModule<T>(moduleId, method, override ?? argsRef.current)
        if (id === seq.current) {
          setData(result)
          setError(undefined)
        }
      } catch (e) {
        if (id === seq.current) setError(e instanceof Error ? e : new Error(String(e)))
      } finally {
        if (id === seq.current) setFetching(false)
      }
    },
    [moduleId, method],
  )

  useEffect(() => {
    if (enabled) void run()
  }, [run, enabled])

  return { data, error, loading: fetching && data === undefined, fetching, refresh: run }
}
