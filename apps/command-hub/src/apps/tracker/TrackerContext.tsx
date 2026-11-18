import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { trackerApi, type IssuePatch, type NewIssue } from './api'
import { buildIndex, errorText, identifier, type Index } from './lib'
import type { Issue, Snapshot } from './types'

export interface Toast {
  id: number
  text: string
  tone?: 'error' | 'info'
  action?: { label: string; run: () => void }
}

interface TrackerState {
  snap: Snapshot | undefined
  /** The first snapshot has arrived. */
  loaded: boolean
  idx: Index
  loadError: string | undefined
  refresh: () => Promise<void>
  /** Run a backend call, refresh, and show its error as a toast. Resolves to undefined on failure. */
  run: <T>(fn: () => Promise<T>, done?: string) => Promise<T | undefined>
  updateIssues: (p: IssuePatch) => Promise<void>
  deleteIssues: (ids: string[]) => Promise<void>
  /** The issue in the side panel (by identifier, kept in the URL as ?issue=ENG-12). */
  openIssue: (i: Issue | undefined) => void
  openedIssue: Issue | undefined
  creating: Partial<NewIssue> | undefined
  startCreate: (defaults?: Partial<NewIssue>) => void
  endCreate: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

const Ctx = createContext<TrackerState | null>(null)
const EMPTY: Snapshot = { teams: [], users: [], states: [], labels: [], issues: [], projects: [], milestones: [], projectUpdates: [], cycles: [], initiatives: [], views: [], commentCounts: {}, meId: null }

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>()
  const [loadError, setLoadError] = useState<string>()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [creating, setCreating] = useState<Partial<NewIssue>>()
  const [params, setParams] = useSearchParams()
  const seq = useRef(0)
  const scheduled = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    try {
      setSnap(await trackerApi.snapshot())
      setLoadError(undefined)
    } catch (e) {
      setLoadError(errorText(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep each team's automatic cycles up to date once per visit (makes upcoming cycles, rolls over unfinished issues).
  useEffect(() => {
    if (!snap) return
    const due = snap.teams.filter((t) => t.cyclesEnabled && !scheduled.current.has(`${t.id}:${t.cycleDuration}:${t.cycleCooldown}:${t.cycleStartDate}:${t.upcomingCycleCount}`))
    if (!due.length) return
    for (const t of due) scheduled.current.add(`${t.id}:${t.cycleDuration}:${t.cycleCooldown}:${t.cycleStartDate}:${t.upcomingCycleCount}`)
    void Promise.all(due.map((t) => trackerApi.scheduleCycles(t.id).catch(() => ({ created: 0, rolledOver: 0 })))).then((r) => {
      if (r.some((x) => x.created || x.rolledOver)) void refresh()
    })
  }, [snap, refresh])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq.current
    setToasts((all) => [...all.slice(-3), { ...t, id }])
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), t.action ? 8000 : 4500)
  }, [])
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((x) => x.id !== id)), [])

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, done?: string): Promise<T | undefined> => {
      try {
        const out = await fn()
        await refresh()
        if (done) toast({ text: done })
        return out
      } catch (e) {
        toast({ text: errorText(e), tone: 'error' })
        await refresh()
        return undefined
      }
    },
    [refresh, toast],
  )

  const updateIssues = useCallback(
    async (p: IssuePatch) => {
      // Optimistic: show the change at once, then take the backend's answer.
      if (p.patch) setSnap((s) => (s ? { ...s, issues: s.issues.map((i) => (p.ids.includes(i.id) ? { ...i, ...p.patch } : i)) } : s))
      await run(() => trackerApi.updateIssues(p))
    },
    [run],
  )

  const idx = useMemo(() => buildIndex(snap ?? EMPTY), [snap])

  const deleteIssues = useCallback(
    async (ids: string[]) => {
      const label = ids.length === 1 ? identifier(idx, idx.issue.get(ids[0])!) : `${ids.length} issues`
      const ok = await run(() => trackerApi.deleteIssues(ids).then(() => true))
      if (ok) toast({ text: `Deleted ${label}.`, action: { label: 'Undo', run: () => void run(() => trackerApi.restoreIssues(ids)) } })
    },
    [idx, run, toast],
  )

  const issueParam = params.get('issue')
  const openedIssue = issueParam ? idx.byIdentifier.get(issueParam) : undefined
  const openIssue = useCallback(
    (i: Issue | undefined) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (i) next.set('issue', identifier(idx, i))
          else next.delete('issue')
          return next
        },
        { replace: !!issueParam && !!i },
      )
    },
    [idx, setParams, issueParam],
  )

  const value: TrackerState = {
    snap,
    loaded: snap !== undefined,
    idx,
    loadError,
    refresh,
    run,
    updateIssues,
    deleteIssues,
    openIssue,
    openedIssue,
    creating,
    startCreate: (d) => setCreating(d ?? {}),
    endCreate: () => setCreating(undefined),
    toasts,
    toast,
    dismiss,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTracker(): TrackerState & { snap: Snapshot } {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTracker outside TrackerProvider')
  return { ...v, snap: v.snap ?? EMPTY }
}
