import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Cloud,
  ExternalLink,
  FlaskConical,
  FolderGit2,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'

import { errorText, jiraApi } from './api'
import { ProjectAvatar, SectionLabel } from './components/bits'
import { Board } from './components/Board'
import { ConnectJiraDialog, CreateIssueDialog, NewProjectDialog, ProjectForm } from './components/Dialogs'
import { IssueSheet } from './components/IssueSheet'
import { IssueTable } from './components/IssueTable'
import type { Issue, Overview, Project, Scope, Source, StatusCategory } from './types'

type View = 'board' | 'list'

const PREFS_KEY = 'jira.prefs'
function loadPrefs(): { scope: Scope; view: View } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '')
    if (p?.scope?.kind && (p.view === 'board' || p.view === 'list')) return p
  } catch {
    // first run
  }
  return { scope: { kind: 'all' }, view: 'board' }
}

/** Local workflow: which status a card lands in when dropped on a column. */
const LOCAL_STATUS_FOR: Record<StatusCategory, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

export default function JiraPage() {
  const api = jiraApi()
  const [overview, setOverview] = useState<Overview>()
  const [issues, setIssues] = useState<Issue[]>()
  const [loadingIssues, setLoadingIssues] = useState(false)
  const [error, setError] = useState<string>()
  const [scope, setScope] = useState<Scope>(() => loadPrefs().scope)
  const [view, setView] = useState<View>(() => loadPrefs().view)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<{ source: Source; key: string }>()
  const [busyKey, setBusyKey] = useState<string>()
  const [dialog, setDialog] = useState<'create' | 'project' | 'connect'>()

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ scope, view }))
  }, [scope, view])

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api.getOverview())
    } catch (e) {
      setError(errorText(e))
    }
  }, [api])

  const loadIssues = useCallback(async () => {
    setLoadingIssues(true)
    try {
      const list =
        scope.kind === 'all'
          ? await api.listIssues({ source: 'all' })
          : await api.listIssues({ source: scope.source, projectKey: scope.key })
      setIssues(list)
      setError(undefined)
    } catch (e) {
      setError(errorText(e))
      setIssues([])
    } finally {
      setLoadingIssues(false)
    }
  }, [api, scope])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])
  useEffect(() => {
    void loadIssues()
  }, [loadIssues])

  const refresh = () => Promise.all([loadOverview(), loadIssues()])

  const projects = useMemo(() => overview?.projects ?? [], [overview])
  const current: Project | undefined =
    scope.kind === 'project' ? projects.find((p) => p.source === scope.source && p.key === scope.key) : undefined

  // A saved scope can point at a project that is gone (disconnected, or deleted).
  useEffect(() => {
    if (overview && scope.kind === 'project' && !current) setScope({ kind: 'all' })
  }, [overview, scope, current])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!issues || !q) return issues ?? []
    return issues.filter(
      (i) => i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || i.labels.some((l) => l.toLowerCase().includes(q)),
    )
  }, [issues, query])

  const priorities = overview?.local.priorities ?? ['Highest', 'High', 'Medium', 'Low', 'Lowest']
  const hasLocal = projects.some((p) => p.source === 'local')
  const connection = overview?.connection

  async function move(issue: Issue, to: StatusCategory) {
    setBusyKey(issue.key)
    // Optimistic: show the card in its new column while the change lands.
    setIssues((list) => list?.map((i) => (i.key === issue.key ? { ...i, statusCategory: to } : i)))
    try {
      let transitionId: string | undefined
      if (issue.source === 'local') transitionId = LOCAL_STATUS_FOR[to]
      else {
        const detail = await api.getIssue({ source: issue.source, key: issue.key })
        transitionId = detail.transitions.find((t) => t.toCategory === to)?.id
        if (!transitionId) throw new Error(`${issue.key} has no transition to ${to === 'in_progress' ? 'In Progress' : to === 'done' ? 'Done' : 'To Do'} in its Jira workflow.`)
      }
      await api.transitionIssue({ source: issue.source, key: issue.key, transitionId })
      setError(undefined)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusyKey(undefined)
      void refresh()
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Workspace"
        title="Jira"
        description="Your team tickets and your personal projects in one tracker. Personal projects live in a local git repo."
        actions={
          <>
            <ConnectionButton connection={connection} onClick={() => setDialog('connect')} />
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void refresh()} disabled={loadingIssues}>
              <RefreshCw className={cn(loadingIssues && 'animate-spin')} />
            </Button>
            <Button onClick={() => setDialog('create')} disabled={!projects.length}>
              <Plus /> Create
            </Button>
          </>
        }
      />

      {!isDesktop() && (
        <div className="flex items-center gap-2 rounded-lg bg-info-soft px-4 py-3 text-sm text-info-soft-foreground">
          <FlaskConical className="size-4 shrink-0" />
          Browser preview with fictional sample data. Open the desktop app to use your Jira and local repo.
        </div>
      )}

      {error && <Banner tone="destructive">{error}</Banner>}
      {connection?.error && (
        <Banner tone="warning">
          Team Jira is unavailable: {connection.error}{' '}
          <button type="button" className="font-medium underline underline-offset-4" onClick={() => setDialog('connect')}>
            Check connection
          </button>
        </Banner>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ProjectList
          projects={projects}
          scope={scope}
          connected={!!connection?.connected}
          loading={!overview}
          onSelect={setScope}
          onNewProject={() => setDialog('project')}
          onConnect={() => setDialog('connect')}
        />

        <div className="flex min-w-0 flex-col gap-6">
          {overview && !hasLocal ? (
            <SetupCard
              onCreated={(p) => {
                void loadOverview()
                setScope({ kind: 'project', source: 'local', key: p.key })
              }}
            />
          ) : (
            <>
              <ScopeHeader scope={scope} project={current} siteUrl={connection?.siteUrl} repoDir={overview?.local.repoDir} />
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets" className="pl-9" />
                </div>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {issues ? `${filtered.length} ticket${filtered.length === 1 ? '' : 's'}` : ''}
                </span>
                <Segmented
                  className="ml-auto"
                  aria-label="View"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'board', label: 'Board' },
                    { value: 'list', label: 'List' },
                  ]}
                />
              </div>
              {!issues ? (
                <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading tickets…
                </div>
              ) : view === 'board' ? (
                <Board
                  issues={filtered}
                  showProject={scope.kind === 'all'}
                  busyKey={busyKey}
                  onOpen={(i) => setOpen({ source: i.source, key: i.key })}
                  onMove={move}
                />
              ) : (
                <IssueTable issues={filtered} showProject={scope.kind === 'all'} onOpen={(i) => setOpen({ source: i.source, key: i.key })} />
              )}
            </>
          )}
        </div>
      </div>

      <IssueSheet
        target={open}
        projectName={current?.name}
        priorities={priorities}
        onClose={() => setOpen(undefined)}
        onChanged={() => void refresh()}
      />
      <CreateIssueDialog
        open={dialog === 'create'}
        onOpenChange={(o) => setDialog(o ? 'create' : undefined)}
        projects={projects}
        defaultProject={current}
        priorities={priorities}
        onCreated={(i) => {
          void refresh()
          setOpen({ source: i.source, key: i.key })
        }}
      />
      <NewProjectDialog
        open={dialog === 'project'}
        onOpenChange={(o) => setDialog(o ? 'project' : undefined)}
        onCreated={(p) => {
          void loadOverview()
          setScope({ kind: 'project', source: 'local', key: p.key })
        }}
      />
      <ConnectJiraDialog
        open={dialog === 'connect'}
        onOpenChange={(o) => setDialog(o ? 'connect' : undefined)}
        connection={connection}
        onSaved={() => void refresh()}
      />
    </div>
  )
}

function Banner({ tone, children }: { tone: 'destructive' | 'warning'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
        tone === 'destructive' ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span className="break-words">{children}</span>
    </div>
  )
}

function ConnectionButton({ connection, onClick }: { connection?: Overview['connection']; onClick: () => void }) {
  if (!connection) return null
  if (!connection.connected) {
    return (
      <Button variant="outline" onClick={onClick}>
        <Cloud /> Connect team Jira
      </Button>
    )
  }
  const host = connection.siteUrl?.replace(/^https:\/\//, '')
  return (
    <Button variant="outline" onClick={onClick} title={`Connected as ${connection.displayName ?? connection.email}`}>
      <span className={cn('size-2 rounded-full', connection.error ? 'bg-warning' : 'bg-success')} />
      <span className="max-w-48 truncate">{host}</span>
    </Button>
  )
}

interface ProjectListProps {
  projects: Project[]
  scope: Scope
  connected: boolean
  loading: boolean
  onSelect: (s: Scope) => void
  onNewProject: () => void
  onConnect: () => void
}

/** Projects drawer: "All work" first, then every project, local and team, as equals. */
function ProjectList({ projects, scope, connected, loading, onSelect, onNewProject, onConnect }: ProjectListProps) {
  const openTotal = projects.reduce((n, p) => n + p.openCount, 0)
  const isActive = (p?: Project) =>
    p ? scope.kind === 'project' && scope.source === p.source && scope.key === p.key : scope.kind === 'all'

  return (
    <Card className="gap-0 py-2">
      <nav aria-label="Projects" className="flex flex-col px-2">
        <ProjectRow active={isActive()} onClick={() => onSelect({ kind: 'all' })} count={openTotal}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <Layers className="size-4" />
          </span>
          <span className="truncate font-medium">All my work</span>
        </ProjectRow>
        <Separator className="my-2" />
        <SectionLabel className="px-3 pt-2 pb-1">Projects</SectionLabel>
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {projects.map((p) => (
          <ProjectRow
            key={`${p.source}:${p.key}`}
            active={isActive(p)}
            count={p.openCount}
            onClick={() => onSelect({ kind: 'project', source: p.source, key: p.key })}
          >
            <ProjectAvatar projectKey={p.key} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{p.name}</span>
              <span className="truncate text-xs text-muted-foreground">{p.key}</span>
            </span>
          </ProjectRow>
        ))}
        <Separator className="my-2" />
        <button
          type="button"
          onClick={onNewProject}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <Plus className="size-4" /> New personal project
        </button>
        {!connected && !loading && (
          <button
            type="button"
            onClick={onConnect}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <Cloud className="size-4" /> Connect team Jira
          </button>
        )}
      </nav>
    </Card>
  )
}

function ProjectRow({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'relative flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
        active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-accent',
      )}
    >
      {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-primary" />}
      {children}
      {count > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>}
    </button>
  )
}

function ScopeHeader({ scope, project, siteUrl, repoDir }: { scope: Scope; project?: Project; siteUrl?: string; repoDir?: string }) {
  if (scope.kind === 'all' || !project) {
    return (
      <div className="flex items-center gap-4">
        <span className="flex size-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Layers className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-semibold">All my work</h2>
          <p className="text-sm text-muted-foreground">Every personal ticket, plus team tickets assigned to you.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProjectAvatar projectKey={project.key} size="lg" />
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold">{project.name}</h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {project.source === 'local' ? (
            <>
              <FolderGit2 className="size-4" />
              <span title={repoDir}>Personal project · local git repo</span>
            </>
          ) : (
            <>
              <Cloud className="size-4" /> Team project · {siteUrl?.replace(/^https:\/\//, '')}
            </>
          )}
        </p>
      </div>
      {project.url && (
        <Button variant="ghost" size="sm" asChild>
          <a href={project.url} target="_blank" rel="noreferrer">
            <ExternalLink /> Open in Jira
          </a>
        </Button>
      )}
    </div>
  )
}

function SetupCard({ onCreated }: { onCreated: (p: Project) => void }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-highlight-soft text-highlight-soft-foreground">
          <FolderGit2 className="size-5" />
        </div>
        <CardTitle>Set up your personal project</CardTitle>
        <CardDescription>
          Track every task as a ticket without filling up the team board. Your personal project works like any Jira project,
          but it is stored in a git repo in your local AppData and is never pushed anywhere.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        <ProjectForm onCreated={onCreated} />
      </CardContent>
    </Card>
  )
}
