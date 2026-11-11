import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FolderPreview, GitHubPlusSettings, InitOptions, LinkedRepo, RefInfo, RepoInfo } from './types'
import { api, isNotARepoError } from './api'
import { takeGitHubPlusHandoff } from './handoff'

/** Thrown by open() when the folder is not a repo and GitHub+ is offering to make it one. */
export class InitOfferedError extends Error {
  constructor() {
    super('Offered to make this folder a git repository')
    this.name = 'InitOfferedError'
  }
}

interface Ctx {
  repo: RepoInfo | null
  refs: RefInfo[]
  /** Recently opened repo paths (kept in AppData by the backend), newest first. */
  recents: string[]
  /** Repos other MonoRail apps created (Jira+'s private projects); listed after the recents, never removed. */
  linked: LinkedRepo[]
  /** True while the last-opened repo is being restored on startup. */
  restoring: boolean
  forget(path: string): Promise<void>
  /** Open a repo. A plain folder is made into a repo automatically (setting) or offered via `initOffer`. */
  open(dir: string): Promise<void>
  /** Set when the user picked a plain folder: what "Make this a git repo" would snapshot. */
  initOffer: FolderPreview | null
  confirmInit(opts: InitOptions, alwaysAuto: boolean): Promise<void>
  cancelInit(): void
  settings: GitHubPlusSettings
  saveSettings(s: GitHubPlusSettings): Promise<void>
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
  const [linked, setLinked] = useState<LinkedRepo[]>([])
  const [restoring, setRestoring] = useState(true)
  const [initOffer, setInitOffer] = useState<FolderPreview | null>(null)
  const [settings, setSettings] = useState<GitHubPlusSettings>({ autoInitFolders: false })
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const show = useCallback(async (info: RepoInfo) => {
    setRefs(await api.listRefs(info.path))
    setRepo(info)
    setError(null)
    setInitOffer(null)
    setRecents((r) => [info.path, ...r.filter((x) => x !== info.path)])
  }, [])

  const openWith = useCallback(async (dir: string, offerInit: boolean) => {
    try {
      let info: RepoInfo
      try {
        info = await api.openRepo(dir)
      } catch (e) {
        if (!offerInit || !isNotARepoError(e)) throw e
        if (settingsRef.current.autoInitFolders) {
          info = await api.initRepo(dir, { excludeLarge: true, excludeSensitive: true })
        } else {
          setInitOffer(await api.previewFolder(dir))
          setError(null)
          throw new InitOfferedError()
        }
      }
      await show(info)
    } catch (e) {
      if (!(e instanceof InitOfferedError)) setError((e as Error).message)
      throw e
    }
  }, [show])
  const open = useCallback((dir: string) => openWith(dir, true), [openWith])

  const confirmInit = useCallback(async (opts: InitOptions, alwaysAuto: boolean) => {
    if (!initOffer) return
    try {
      if (alwaysAuto) setSettings(await api.saveSettings({ ...settingsRef.current, autoInitFolders: true }))
      await show(await api.initRepo(initOffer.path, opts))
    } catch (e) {
      setError((e as Error).message)
      throw e
    }
  }, [initOffer, show])

  const saveSettings = useCallback(async (s: GitHubPlusSettings) => setSettings(await api.saveSettings(s)), [])

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
    api.getSettings().then((s) => live && setSettings(s), () => undefined)
    api.getLinked().then((l) => live && setLinked(l), () => undefined)
    // Another app (Jira+) asked to open a repo: open that one instead of the last one.
    const handoff = takeGitHubPlusHandoff()
    api.getRecents().then(
      async (list) => {
        if (!live) return
        setRecents(list)
        if (handoff) await openWith(handoff, false).catch(() => undefined)
        else if (list[0]) await openWith(list[0], false).catch(() => setError(null))
        if (live) setRestoring(false)
      },
      () => live && setRestoring(false),
    )
    return () => { live = false }
  }, [openWith])

  return (
    <RepoCtx.Provider
      value={{
        repo, refs, recents, linked, restoring, forget, open, pick, refresh, close: () => setRepo(null), error,
        initOffer, confirmInit, cancelInit: () => setInitOffer(null), settings, saveSettings,
      }}
    >
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
