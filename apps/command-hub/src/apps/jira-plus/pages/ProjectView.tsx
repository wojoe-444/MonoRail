import { useMemo, useState } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router-dom'
import { ExternalLink, FolderGit2, KanbanSquare, List, Loader2, Repeat, Search, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'

import { errorText, jiraApi } from '../api'
import { LocalChip, ProjectAvatar } from '../bits'
import { Board } from '../components/Board'
import { IssueList } from '../components/IssueList'
import { ErrorNote } from '../components/Modal'
import { projectPath, useJira } from '../JiraContext'
import type { Issue, Source, StatusCategory } from '../types'
import { useIssues } from '../useIssues'

/** Local workflow: which status a card lands in when dropped on a column. */
const LOCAL_STATUS_FOR: Record<StatusCategory, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

/** A project: Jira's project sidebar plus the board or list. */
export function ProjectView() {
  const { source, key, view } = useParams() as { source: Source; key: string; view: string }
  const { projects, overview, openIssue, openDialog, refresh } = useJira()
  const project = projects.find((p) => p.source === source && p.key === key)
  const { issues, setIssues, error } = useIssues(source, key)
  const [query, setQuery] = useState('')
  const [busyKey, setBusyKey] = useState<string>()
  const [moveError, setMoveError] = useState<string>()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (issues ?? []).filter((i) => (view === 'recurring' ? i.type === 'Recurring' : i.type !== 'Recurring' && (view !== 'epics' || i.type.toLowerCase() === 'epic')) && (!q || i.key.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q) || i.labels.some((l) => l.toLowerCase().includes(q))))
  }, [issues, query, view])

  if (overview && !project) return <Navigate to="/projects" replace />
  if (view !== 'board' && view !== 'list' && view !== 'epics' && view !== 'recurring') return <Navigate to={projectPath({ source, key })} replace />

  async function move(issue: Issue, to: StatusCategory) {
    setBusyKey(issue.key)
    setMoveError(undefined)
    // Optimistic: show the card in its new column while the change lands.
    setIssues((list) => list?.map((i) => (i.key === issue.key ? { ...i, statusCategory: to } : i)))
    try {
      let transitionId: string | undefined
      if (issue.source === 'local') transitionId = LOCAL_STATUS_FOR[to]
      else {
        const detail = await jiraApi().getIssue({ source: issue.source, key: issue.key })
        transitionId = detail.transitions.find((t) => t.toCategory === to)?.id
        if (!transitionId) throw new Error(`${issue.key} has no transition to ${LOCAL_STATUS_FOR[to]} in its Jira workflow.`)
      }
      await jiraApi().transitionIssue({ source: issue.source, key: issue.key, transitionId })
    } catch (e) {
      setMoveError(errorText(e))
    } finally {
      setBusyKey(undefined)
      void refresh()
    }
  }

  const local = source === 'local'
  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'jp-focusable relative flex h-9 items-center gap-3 rounded-[3px] px-3 text-(--jp-subtle) outline-none hover:bg-(--jp-hover)',
      isActive && 'bg-(--jp-selected) text-(--jp-selected-fg) before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-(--jp-selected-fg)',
    )

  return (
    <div className="flex min-h-full">
      <aside className="w-60 shrink-0 border-r border-(--jp-border) bg-(--jp-bg) px-2 py-6">
        <div className="mb-6 flex items-center gap-3 px-2">
          <ProjectAvatar projectKey={key} size={32} local={local} />
          <div className="min-w-0">
            <div className="truncate font-semibold">{project?.name ?? key}</div>
            <div className="text-xs text-(--jp-subtle)">{local ? 'Private software project' : 'Software project'}</div>
          </div>
        </div>
        <div className="jp-overline mb-1 px-3">Planning</div>
        <nav className="flex flex-col gap-0.5">
          <NavLink to={projectPath({ source, key }, 'board')} className={navItem}>
            <KanbanSquare className="size-4" /> Board
          </NavLink>
          <NavLink to={projectPath({ source, key }, 'list')} className={navItem}>
            <List className="size-4" /> List
          </NavLink>
          <NavLink to={projectPath({ source, key }, 'epics')} className={navItem}>
            <Zap className="size-4" /> Epics
          </NavLink>
          <NavLink to={projectPath({ source, key }, 'recurring')} className={navItem}><Repeat className="size-4" /> Recurring</NavLink>
        </nav>
        <div className="mx-3 my-4 h-px bg-(--jp-border)" />
        {local ? (
          <div className="px-3 text-xs leading-5 text-(--jp-subtle)">
            <div className="mb-2 flex items-center gap-1.5 font-semibold text-(--jp-local)">
              <FolderGit2 className="size-4" /> Private repo
            </div>
            Every change is a git commit on this computer. This project never syncs to your team Jira or GitHub.
          </div>
        ) : (
          project?.url && (
            <a href={project.url} target="_blank" rel="noreferrer" className={navItem({ isActive: false })}>
              <ExternalLink className="size-4" /> Open in Jira
            </a>
          )
        )}
      </aside>

      <main className="min-w-0 flex-1 px-10 py-6">
        <div className="text-(--jp-subtle)">
          <Link to="/projects" className="hover:underline">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <span>{project?.name ?? key}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-medium">{view === 'board' ? `${key} board` : view === 'epics' ? 'Epics' : view === 'recurring' ? 'Recurring' : 'List'}</h1>
          {local && <LocalChip />}
          <button type="button" className="jp-btn ml-auto" onClick={() => openDialog(view === 'epics' ? 'create-epic' : view === 'recurring' ? 'create-recurring' : 'create', project)} disabled={!project || (view === 'recurring' && !local)}>
            {view === 'epics' ? 'Create epic' : view === 'recurring' ? 'Create recurring item' : 'Create issue'}
          </button>
        </div>
        {view === 'recurring' && local && <p className="mt-4 text-(--jp-subtle)">Complete an item to create its next occurrence. Its date advances from the previous expected end date.</p>}
        {view === 'recurring' && !local && <p className="mt-4 text-(--jp-subtle)">Recurring items are available in private projects. Team Jira recurrence is managed in Jira.</p>}
        <div className="mt-6 mb-4 flex items-center gap-3">
          <div className="relative w-44">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-(--jp-subtlest)" />
            <input aria-label="Search this project" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="jp-field h-8 min-h-0 py-0 pl-8" />
          </div>
          {issues && <span className="text-(--jp-subtle)">{filtered.length} {view === 'recurring' ? (filtered.length === 1 ? 'recurring item' : 'recurring items') : view === 'epics' ? (filtered.length === 1 ? 'epic' : 'epics') : (filtered.length === 1 ? 'issue' : 'issues')}</span>}
        </div>
        <ErrorNote error={error ?? moveError} />
        {!issues && !error && (
          <div className="flex items-center gap-2 py-8 text-(--jp-subtle)">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {issues &&
          (view === 'board' ? (
            <Board issues={filtered} busyKey={busyKey} onOpen={(i) => openIssue(i.source, i.key)} onMove={move} />
          ) : (
            <IssueList issues={filtered} empty={view === 'recurring' ? (query ? 'No recurring items match your search.' : 'No recurring items yet.') : view === 'epics' ? (query ? 'No epics match your search.' : 'No epics yet. Create an epic to get started.') : undefined} onOpen={(i) => openIssue(i.source, i.key)} />
          ))}
      </main>
    </div>
  )
}
