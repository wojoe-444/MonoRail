import type { FormEvent } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Cloud, ExternalLink, FolderGit2, Loader2, Lock, Plus, Repeat, Search, SlidersHorizontal, Zap } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { isDesktop } from '@/modules/client'
import { cn } from '@/lib/utils'

import { TaskCalendar } from '../calendar/TaskCalendar'
import { ProjectAvatar } from './bits'
import { Dialogs } from './components/Dialogs'
import { IssueModal } from './components/IssueModal'
import { JiraProvider, useJira } from './JiraContext'
import { Overview } from './pages/Overview'
import { TaskListView } from './pages/TaskListView'
import { TriggerTemplates } from './pages/TriggerTemplates'
import { Welcome } from './pages/Welcome'
import { BoardView } from './pages/BoardView'
import { MAIN_VIEWS, useQuery, useScope, viewPath, type TaskView } from './scope'
import type { Project } from './types'
import './styles.css'

/**
 * Tasks (formerly Jira+): your private tasks and your team's Jira on one
 * native MonoRail page. Private projects are a git repo in the app's data
 * folder; team projects come from Jira Cloud through Connections. The backend
 * and data folder keep the id `jira-plus` so existing tasks stay in place.
 *
 * Routes live under the app's hash path, e.g. #/apps/jira-plus/projects/local/ME/board.
 */
export default function TasksApp({ basePath }: { basePath: string }) {
  return (
    <div className="jp mx-auto flex w-full max-w-[96rem] flex-col gap-6 p-6 lg:p-8">
      <HashRouter basename={basePath}>
        <JiraProvider>
          <Shell />
        </JiraProvider>
      </HashRouter>
    </div>
  )
}

const VIEW_LABEL: Record<TaskView, string> = {
  overview: 'Overview',
  list: 'List',
  board: 'Board',
  calendar: 'Calendar',
  epics: 'Epics',
  recurring: 'Recurring',
  'on-trigger': 'On trigger',
}

function Shell() {
  const { overview, overviewError, projects, openDialog, openIssue } = useJira()
  const navigate = useNavigate()
  const { view, project, projectRef } = useScope()
  const [q, setQ] = useQuery()
  const hasLocal = projects.some((p) => p.source === 'local')
  const goTo = (p: { source: 'local' | 'jira'; key: string }) => navigate(viewPath('board', p))

  function search(e: FormEvent) {
    e.preventDefault()
    const key = q.trim().toUpperCase()
    // A task key jumps straight to the task; anything else filters the current view.
    const m = key.match(/^([A-Z][A-Z0-9]+)-\d+$/)
    const target = m && projects.find((p) => p.key === m[1])
    if (target) {
      openIssue(target.source, key)
      setQ('')
    } else if (view === 'overview' || view === 'calendar') navigate({ pathname: viewPath('list', projectRef), search: q ? `?q=${encodeURIComponent(q)}` : '' })
  }

  const mainView: TaskView = MAIN_VIEWS.includes(view) ? view : 'list'
  const createKind = view === 'epics' ? 'create-epic' : view === 'recurring' ? 'create-recurring' : 'create'

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Tasks"
        description={
          isDesktop()
            ? "Your private tasks and your team's Jira in one place. Private tasks stay on this computer."
            : 'Browser preview with fictional sample tasks. Open the desktop app to use your private projects and team Jira.'
        }
        actions={
          <>
            <form onSubmit={search} className="relative" role="search">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search tasks or jump to a task key"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search or jump to a key"
                className="h-9 w-64 rounded-lg border bg-card pr-3 pl-9 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </form>
            <Button variant="outline" onClick={() => openDialog('connect')}>
              <SlidersHorizontal /> Team Jira
            </Button>
            <Button onClick={() => openDialog(createKind, project)} disabled={!projects.length || (view === 'recurring' && project?.source !== 'local')}>
              <Plus /> {view === 'epics' ? 'New epic' : view === 'recurring' ? 'New recurring task' : 'New task'}
            </Button>
          </>
        }
      />

      {overview?.connection.error && <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">Team Jira is unavailable: {overview.connection.error}</div>}
      {overviewError && <div className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">{overviewError}</div>}

      {!overview ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !hasLocal ? (
        <Welcome onCreated={goTo} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Segmented<TaskView>
              aria-label="View"
              value={mainView}
              onChange={(v) => navigate({ pathname: viewPath(v, projectRef), search: q ? `?q=${encodeURIComponent(q)}` : '' })}
              options={MAIN_VIEWS.map((v) => ({ value: v, label: VIEW_LABEL[v], disabled: v === 'overview' && !!projectRef, title: v === 'overview' && projectRef ? 'Overview covers every project' : undefined }))}
            />
            <ProjectChips active={projectRef} onPick={(p) => navigate(viewPath(p ? (view === 'overview' ? 'board' : view) : MAIN_VIEWS.includes(view) ? view : 'list', p))} />
          </div>

          {projectRef && <ProjectStrip project={project} projectRef={projectRef} view={view} />}

          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/list" element={<TaskListView />} />
            <Route path="/board" element={<BoardView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/projects/:source/:key/:view" element={<ProjectRoute project={project} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      )}
      <IssueModal />
      <Dialogs onProjectCreated={goTo} />
    </>
  )
}

function ProjectRoute({ project }: { project?: Project }) {
  const { overview } = useJira()
  const { view, projectRef } = useScope()
  if (overview && !project) return <Navigate to="/" replace />
  if (!projectRef) return null
  if (view === 'board') return <BoardView key={`${projectRef.source}:${projectRef.key}`} />
  if (view === 'calendar') return <CalendarView />
  if (view === 'on-trigger') return project ? <TriggerTemplates key={`${project.source}:${project.key}`} project={project} /> : null
  return <TaskListView key={`${projectRef.source}:${projectRef.key}:${view}`} />
}

function CalendarView() {
  const { openIssue, version } = useJira()
  const { projectRef } = useScope()
  return <TaskCalendar project={projectRef} revision={version} onOpen={(i) => openIssue(i.source, i.key)} />
}

function ProjectChips({ active, onPick }: { active?: { source: string; key: string }; onPick: (p?: Project) => void }) {
  const { projects, openDialog } = useJira()
  const chip = (on: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on ? 'border-transparent bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
    )
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Project">
      <button type="button" role="radio" aria-checked={!active} className={chip(!active)} onClick={() => onPick(undefined)}>
        All projects
      </button>
      {projects.map((p) => {
        const on = active?.source === p.source && active.key === p.key
        return (
          <button key={`${p.source}:${p.key}`} type="button" role="radio" aria-checked={on} className={chip(on)} onClick={() => onPick(p)} title={p.source === 'local' ? 'Private project on this computer' : 'Team Jira project'}>
            {p.source === 'local' ? <Lock className="size-3.5" /> : <Cloud className="size-3.5" />}
            {p.name}
          </button>
        )
      })}
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => openDialog('project')}>
        <Plus /> Project
      </Button>
    </div>
  )
}

/** One project's name, where it lives, and its extra views (epics, recurring, templates). */
function ProjectStrip({ project, projectRef, view }: { project?: Project; projectRef: { source: 'local' | 'jira'; key: string }; view: TaskView }) {
  const navigate = useNavigate()
  const local = projectRef.source === 'local'
  const extra: { view: TaskView; label: string; icon: typeof Zap; localOnly?: boolean }[] = [
    { view: 'epics', label: 'Epics', icon: Zap },
    { view: 'recurring', label: 'Recurring', icon: Repeat, localOnly: true },
    { view: 'on-trigger', label: 'On trigger', icon: FolderGit2 },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4">
      <ProjectAvatar projectKey={projectRef.key} local={local} size={32} />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{project?.name ?? projectRef.key}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {local ? (
            <>
              <Lock className="size-3" /> Private project: every change is a git commit on this computer. Never synced to Jira or GitHub.
            </>
          ) : (
            <>
              <Cloud className="size-3" /> Team Jira project
            </>
          )}
        </span>
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {extra
          .filter((x) => !x.localOnly || local)
          .map((x) => (
            <Button key={x.view} variant={view === x.view ? 'soft' : 'outline'} size="sm" aria-pressed={view === x.view} onClick={() => navigate(viewPath(view === x.view ? 'list' : x.view, projectRef))}>
              <x.icon /> {x.label}
            </Button>
          ))}
        {!local && project?.url && (
          <Button variant="outline" size="sm" asChild>
            <a href={project.url} target="_blank" rel="noreferrer">
              <ExternalLink /> Open in Jira
            </a>
          </Button>
        )}
      </span>
    </div>
  )
}
