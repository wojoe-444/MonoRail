import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Args, BackendId, Method, MethodCall, MethodResult, Result, ScopedRequest, SingleId } from '@/ipc/contract'

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

/** The wire result is paired to the request by the selected backend. */
async function invokeRequest(id: BackendId, method: string, args?: unknown): Promise<unknown> {
  if (!window.commandHub) throw new ModuleUnavailableError()
  const invoke = window.commandHub.invoke as (id: BackendId, method: string, args?: unknown) => Promise<unknown>
  return invoke(id, method, args)
}

/** Call a method on a module's backend in the Electron main process. */
export async function invokeModule<const Id extends BackendId, const M extends Method<Id>>(
  id: Id & SingleId<NoInfer<Id>>,
  ...request: ScopedRequest<NoInfer<Id>, M>
): Promise<Result<Id, M>> {
  return invokeRequest(id, request[0], request[1]) as Promise<Result<Id, M>>
}

/** Bind a known backend to its feature API, optionally with a browser sample. */
export function moduleClient<Id extends BackendId>(
  id: Id & SingleId<NoInfer<Id>>,
  sample?: (method: string, args?: Record<string, unknown>) => Promise<unknown>,
) {
  return async <C extends MethodCall<Id>>(...call: C): Promise<MethodResult<Id, C>> => {
    if (sample && !isDesktop()) return await sample(call[0], call[1] as Record<string, unknown> | undefined) as MethodResult<Id, C>
    return invokeRequest(id, call[0], call[1]) as Promise<MethodResult<Id, C>>
  }
}

export interface ModuleQuery<T, A> {
  data: T | undefined
  error: Error | undefined
  /** True for the first load (no data yet). */
  loading: boolean
  /** True while any request is in flight, including refreshes. */
  fetching: boolean
  refresh: (args?: A) => Promise<void>
  /** Fetch again without marking the query as fetching (background polling, no fade). */
  reload: (args?: A) => Promise<void>
}

type QueryOptions = { enabled?: boolean }
// A query can change its captured method between renders. A caller with a
// method union may refresh its captured request but cannot supply an override.
type QueryOverride<Id extends BackendId, M extends Method<Id>> = [M] extends [SingleId<M>] ? Args<Id, M> : never
type QueryCall<Id extends BackendId, M extends Method<Id>> = {
  [K in M]: undefined extends Args<Id, K>
    ? [method: K, args?: Args<Id, K>, options?: QueryOptions]
    : [method: K, args: Args<Id, K>, options?: QueryOptions]
}[M]

/**
 * Load data from a module backend. Keeps the previous data while refetching
 * so views can hold their frame instead of flashing a skeleton.
 */
export function useModuleQuery<const Id extends BackendId, const M extends Method<Id>>(
  moduleId: Id & SingleId<NoInfer<Id>>,
  ...call: [method: M, ...unknown[]] & NoInfer<QueryCall<NoInfer<Id>, M>>
): ModuleQuery<Result<Id, M>, QueryOverride<Id, M>> {
  const [method, args, { enabled = isDesktop() } = {}] = call
  const [data, setData] = useState<Result<Id, M>>()
  const [error, setError] = useState<Error>()
  const [fetching, setFetching] = useState(enabled)
  const argsRef = useRef(args)
  useLayoutEffect(() => {
    argsRef.current = args
  })
  const seq = useRef(0)

  const run = useCallback(
    async (override?: Args<Id, M>, silent = false) => {
      const id = ++seq.current
      if (!silent) setFetching(true)
      try {
        const result = await invokeRequest(moduleId, method, override ?? argsRef.current) as Result<Id, M>
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
    // oxlint-disable-next-line react/set-state-in-effect -- Start the bridge request when enabled or its method changes, keeping previous data during the fetch.
    if (enabled) void run()
  }, [run, enabled])

  const reload = useCallback((override?: Args<Id, M>) => run(override, true), [run])
  const refresh = useCallback((override?: Args<Id, M>) => run(override), [run])

  return { data, error, loading: fetching && data === undefined, fetching, refresh, reload }
}
