import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, CircleDot, Inbox, Layers, Loader2, PenSquare, Repeat, Search, Settings, Target, User, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { prefs } from '@/lib/prefs'
import { cn } from '@/lib/utils'

import { CreateIssue } from './components/CreateIssue'
import { EntityIcon } from './components/bits'
import { IssuePanel } from './components/IssuePanel'
import { activeCycle } from './lib'
import { CycleDetail, CyclesPage } from './pages/Cycles'
import { InitiativeDetail, InitiativesPage } from './pages/Initiatives'
import { MyIssues } from './pages/MyIssues'
import { ProjectDetail, ProjectsPage } from './pages/Projects'
import { SearchPage } from './pages/Search'
import { SettingsPage, TeamSettingsPage } from './pages/Settings'
import { TeamIssues, TriagePage } from './pages/TeamIssues'
import { ViewDetail, ViewsPage } from './pages/Views'
import { Welcome } from './pages/Welcome'
import { TrackerProvider, useTracker } from './TrackerContext'
import './styles.css'

/**
 * Tracker: issues, projects, cycles and initiatives on this PC, modelled on
 * the planning concepts of tools like Linear. Data lives in MonoRail's local
 * database (electron/apps/tracker). Routes live under the app's hash path,
 * e.g. #/apps/tracker/team/ENG/issues?issue=ENG-12.
 */
export default function TrackerApp({ basePath }: { basePath: string }) {
  return (
    <div className="trk flex h-full min-h-0">
      <HashRouter basename={basePath}>
        <TrackerProvider>
          <Shell />
        </TrackerProvider>
      </HashRouter>
    </div>
  )
}

function Shell() {
  const { snap, loaded, loadError, startCreate, refresh } = useTracker()
  const loc = useLocation()
  const ready = snap.teams.length > 0 || snap.users.length > 0

  // C anywhere (outside a text field) starts a new issue, with the team of the page it is on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        const key = loc.pathname.match(/^\/team\/([^/]+)/)?.[1]
        startCreate({ teamId: snap.teams.find((x) => x.key === key)?.id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loc.pathname, snap.teams, startCreate])

  if (loadError)
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">Tracker could not open its data</h2>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    )
  if (!loaded) return <Loader2 className="m-8 size-5 animate-spin text-muted-foreground" />

  return (
    <>
      {ready && <Sidebar />}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={ready ? <Navigate to="/my-issues" replace /> : <Welcome />} />
          <Route path="/my-issues" element={<Ready ready={ready}><MyIssues /></Ready>} />
          <Route path="/search" element={<Ready ready={ready}><SearchPage /></Ready>} />
          <Route path="/team/:key/triage" element={<Ready ready={ready}><TriagePage /></Ready>} />
          <Route path="/team/:key/issues" element={<Ready ready={ready}><TeamIssues /></Ready>} />
          <Route path="/team/:key/cycles" element={<Ready ready={ready}><CyclesPage /></Ready>} />
          <Route path="/team/:key/cycles/:number" element={<Ready ready={ready}><CycleDetail /></Ready>} />
          <Route path="/team/:key/projects" element={<Ready ready={ready}><ProjectsPage /></Ready>} />
          <Route path="/team/:key/settings" element={<Ready ready={ready}><TeamSettingsPage /></Ready>} />
          <Route path="/projects" element={<Ready ready={ready}><ProjectsPage /></Ready>} />
          <Route path="/projects/:id" element={<Ready ready={ready}><ProjectDetail /></Ready>} />
          <Route path="/initiatives" element={<Ready ready={ready}><InitiativesPage /></Ready>} />
          <Route path="/initiatives/:id" element={<Ready ready={ready}><InitiativeDetail /></Ready>} />
          <Route path="/views" element={<Ready ready={ready}><ViewsPage /></Ready>} />
          <Route path="/views/:id" element={<Ready ready={ready}><ViewDetail /></Ready>} />
          <Route path="/settings" element={<Ready ready={ready}><SettingsPage /></Ready>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <IssuePanel />
      <CreateIssue />
      <Toasts />
    </>
  )
}

function Ready({ ready, children }: { ready: boolean; children: ReactNode }) {
  if (!ready) return <Navigate to="/" replace />
  return <>{children}</>
}

// ---------------------------------------------------------------- sidebar

/** Teams folded shut in the sidebar (new teams start open). */
const CLOSED_KEY = 'commandHub.tracker.closedTeams'

function Sidebar() {
  const { snap, startCreate, idx } = useTracker()
  const navigate = useNavigate()
  const [closed, setClosed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(prefs.getItem(CLOSED_KEY) ?? '[]') as string[])
    } catch {
      return new Set()
    }
  })
  const open = { has: (id: string) => !closed.has(id) }
  const toggle = (id: string) =>
    setClosed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      prefs.setItem(CLOSED_KEY, JSON.stringify([...n]))
      return n
    })
  const [q, setQ] = useState('')
  const triage = (teamId: string) => snap.issues.filter((i) => i.teamId === teamId && idx.state.get(i.stateId)?.type === 'triage').length
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-sidebar/40 p-2 text-sm" aria-label="Tracker">
      <div className="mb-1 flex items-center gap-1">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            navigate(`/search?q=${encodeURIComponent(q)}`)
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues" className="h-8 w-full rounded-md border bg-card pr-2 pl-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Search issues" />
        </form>
        <Button size="icon" variant="outline" className="size-8" title="New issue (C)" onClick={() => startCreate()}>
          <PenSquare />
        </Button>
      </div>
      <Item to="/my-issues" icon={<User className="size-4" />}>
        My issues
      </Item>
      <Item to="/projects" icon={<Layers className="size-4" />}>
        Projects
      </Item>
      <Item to="/initiatives" icon={<Target className="size-4" />}>
        Initiatives
      </Item>
      <Item to="/views" icon={<CircleDot className="size-4" />}>
        Views
      </Item>
      <div className="mt-3 mb-1 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Your teams</div>
      {snap.teams.map((t) => {
        const n = triage(t.id)
        const cycle = activeCycle(snap, t.id)
        return (
          <div key={t.id}>
            <button type="button" onClick={() => toggle(t.id)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent" aria-expanded={open.has(t.id)}>
              <EntityIcon icon={t.icon} color={t.color} size={16} />
              <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
              {open.has(t.id) ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
            </button>
            {open.has(t.id) && (
              <div className="ml-3 flex flex-col gap-0.5 border-l pl-2">
                {t.triageEnabled && (
                  <Item to={`/team/${t.key}/triage`} icon={<Inbox className="size-4" />} count={n}>
                    Triage
                  </Item>
                )}
                <Item to={`/team/${t.key}/issues`} icon={<CircleDot className="size-4" />}>
                  Issues
                </Item>
                {t.cyclesEnabled && (
                  <Item to={cycle ? `/team/${t.key}/cycles/${cycle.number}` : `/team/${t.key}/cycles`} match={`/team/${t.key}/cycles`} icon={<Repeat className="size-4" />}>
                    Cycles
                  </Item>
                )}
                <Item to={`/team/${t.key}/projects`} icon={<Layers className="size-4" />}>
                  Projects
                </Item>
              </div>
            )}
          </div>
        )
      })}
      <span className="flex-1" />
      <Item to="/settings" icon={<Settings className="size-4" />}>
        Tracker settings
      </Item>
    </nav>
  )
}

function Item({ to, icon, children, count, match }: { to: string; icon: ReactNode; children: ReactNode; count?: number; match?: string }) {
  const loc = useLocation()
  const active = match ? loc.pathname.startsWith(match) : loc.pathname === to || loc.pathname.startsWith(`${to}/`)
  return (
    <NavLink to={to} className={cn('flex h-8 items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-accent hover:text-foreground', active && 'bg-sidebar-accent font-medium text-foreground')}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {!!count && <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning-soft-foreground tabular-nums">{count}</span>}
    </NavLink>
  )
}

function Toasts() {
  const { toasts, dismiss } = useTracker()
  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border bg-popover px-3 py-2 text-sm shadow-elevation-2', t.tone === 'error' && 'border-destructive/40 text-destructive')}>
          <span className="min-w-0 flex-1">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
