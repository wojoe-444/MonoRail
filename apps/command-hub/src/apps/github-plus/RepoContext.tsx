import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { RefInfo, RepoInfo } from './types'
import { api } from './api'

interface Ctx {
  repo: RepoInfo | null
  refs: RefInfo[]
  /** Recently opened repo paths (kept in AppData by the backend), newest first. */
  recents: string[]
  /** True while the last-opened repo is being restored on startup. */
  restoring: boolean
  forget(path: string): Promise<void>
  open(dir: string): Promise<void>
  /** Shows the folder picker; resolves true when a repo was opened. */
  pick(): Promise<boolean>
  refresh(): Promise<void>
  close(): void
  error: string | null
}
const RepoCtx = createContext<Ctx>(null!)
export const useRepo = (): Ctx => useContext(RepoCtx)

export function RepoProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [refs, setRefs] = useState<RefInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [recents, setRecents] = useState<string[]>([])
  const [restoring, setRestoring] = useState(true)

  const open = useCallback(async (dir: string) => {
    try {
      const info = await api.openRepo(dir)
      setRefs(await api.listRefs(info.path))
      setRepo(info)
      setError(null)
      setRecents((r) => [info.path, ...r.filter((x) => x !== info.path)])
    } catch (e) {
      setError((e as Error).message)
      throw e
    }
  }, [])

  const forget = useCallback(async (path: string) => setRecents(await api.removeRecent(path)), [])

  const pick = useCallback(async () => {
    const dir = await api.pickRepoFolder()
    if (!dir) return false
    return open(dir).then(() => true, () => false)
  }, [open])

  const refresh = useCallback(async () => { if (repo) await open(repo.path) }, [repo, open])

  // Reopen the last repo, so coming back to GitHub+ lands where you left off.
  useEffect(() => {
    let live = true
    api.getRecents().then(
      async (list) => {
        if (!live) return
        setRecents(list)
        if (list[0]) await open(list[0]).catch(() => setError(null))
        if (live) setRestoring(false)
      },
      () => live && setRestoring(false),
    )
    return () => { live = false }
  }, [open])

  return (
    <RepoCtx.Provider value={{ repo, refs, recents, restoring, forget, open, pick, refresh, close: () => setRepo(null), error }}>
      {children}
    </RepoCtx.Provider>
  )
}

/** Small async-data hook with loading and error state. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; loading: boolean } {
  const [state, set] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    set((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => live && set({ data, error: null, loading: false }),
      (e: Error) => live && set({ data: null, error: e.message, loading: false })
    )
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
