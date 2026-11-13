import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * True when real backends are reachable: the Electron window (preload), the
 * browser dev bridge, or a remote device (Remote access). Same as hasBackends();
 * kept under this name because every page already uses it.
 */
export function isDesktop(): boolean {
  return hasBackends()
}

/** True when module backends are reachable (any bridge is present). */
export function hasBackends(): boolean {
  return typeof window !== 'undefined' && !!window.commandHub
}

/**
 * True when the user is at this PC: actions that open a system dialog,
 * Explorer, a terminal or restart the app make sense. False in the browser dev
 * server (no backends) and on a remote device such as a phone. Backend methods
 * that need it are listed in each backend's `desktopOnly`.
 */
export function hasLocalScreen(): boolean {
  return hasBackends() && !window.commandHub?.remote
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
  /** Fetch again without marking the query as fetching (background polling, no fade). */
  reload: (args?: unknown) => Promise<void>
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
    async (override?: unknown, silent = false) => {
      const id = ++seq.current
      if (!silent) setFetching(true)
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

  const reload = useCallback((override?: unknown) => run(override, true), [run])
  const refresh = useCallback((override?: unknown) => run(override), [run])

  return { data, error, loading: fetching && data === undefined, fetching, refresh, reload }
}
