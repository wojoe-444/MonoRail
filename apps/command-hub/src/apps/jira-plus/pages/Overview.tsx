import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Cloud, Loader2, Lock, Plus } from 'lucide-react'

import { StatTile } from '@/components/charts/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

import { ProjectAvatar } from '../bits'
import { ErrorNote } from '../components/Modal'
import { TaskRow } from '../components/TaskRow'
import { daysUntil } from '../due'
import { useJira } from '../JiraContext'
import { viewPath } from '../scope'
import { formatDuration } from '../time'
import type { Issue } from '../types'
import { useIssues } from '../useIssues'

/** Soonest expected end first (late ones on top), then work in progress, then most recently updated. */
function upNextOrder(a: Issue, b: Issue): number {
  const da = a.dueDate ? (daysUntil(a.dueDate) ?? 9999) : 9999
  const db = b.dueDate ? (daysUntil(b.dueDate) ?? 9999) : 9999
  if (da !== db) return da - db
  if (a.statusCategory !== b.statusCategory) return a.statusCategory === 'in_progress' ? -1 : 1
  return b.updated.localeCompare(a.updated)
}

/** Landing view: four numbers, what is up next, and every project. */
export function Overview() {
  const { projects, overview, openIssue, openDialog, selected } = useJira()
  const { issues, error } = useIssues('all')
  const navigate = useNavigate()

  const open = useMemo(() => (issues ?? []).filter((i) => i.type !== 'Recurring' && i.statusCategory !== 'done'), [issues])
  const stats = useMemo(() => {
    const local = open.filter((i) => i.source === 'local').length
    const dueSoon = open.filter((i) => i.dueDate && (daysUntil(i.dueDate) ?? 99) <= 6)
    const late = dueSoon.filter((i) => (daysUntil(i.dueDate!) ?? 0) < 0).length
    const today = dueSoon.filter((i) => daysUntil(i.dueDate!) === 0).length
    const doing = open.filter((i) => i.statusCategory === 'in_progress')
    const logged = open.reduce((s, i) => s + (i.timeSpentSeconds ?? 0), 0)
    return { local, team: open.length - local, dueSoon: dueSoon.length, late, today, doing: doing.length, doingProjects: new Set(doing.map((i) => `${i.source}:${i.projectKey}`)).size, logged }
  }, [open])
  const upNext = useMemo(() => [...open].sort(upNextOrder).slice(0, 8), [open])
  const dash = issues ? undefined : '–'

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Open tasks" value={dash ?? String(open.length)} hint={issues ? `${stats.local} private, ${stats.team} on team Jira` : undefined} />
        <StatTile
          label="Due in 7 days"
          value={dash ?? String(stats.dueSoon)}
          hint={issues ? (stats.late ? `${stats.late} late` : stats.today ? `${stats.today} due today` : 'nothing late') : undefined}
        />
        <StatTile label="In progress" value={dash ?? String(stats.doing)} hint={issues ? `across ${stats.doingProjects} ${stats.doingProjects === 1 ? 'project' : 'projects'}` : undefined} />
        <StatTile label="Time logged" value={dash ?? (stats.logged ? formatDuration(stats.logged) : '0m')} hint="on open tasks" />
      </div>

      <ErrorNote error={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="gap-0 py-0 xl:col-span-2">
          <CardHeader className="py-6">
            <CardTitle>Up next</CardTitle>
            <CardDescription>Open tasks, the soonest expected end first.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => navigate(viewPath('list'))}>
                View all <ChevronRight />
              </Button>
            </CardAction>
          </CardHeader>
          {!issues && !error ? (
            <div className="flex items-center gap-2 border-t px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : upNext.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t px-6 py-12 text-center">
              <span className="text-sm text-muted-foreground">Nothing open. Add a task to get started.</span>
              <Button size="sm" onClick={() => openDialog('create')}>
                <Plus /> New task
              </Button>
            </div>
          ) : (
            <ul className="divide-y border-t">
              {upNext.map((i) => (
                <TaskRow key={`${i.source}:${i.key}`} issue={i} selected={selected?.source === i.source && selected.key === i.key} onOpen={(t) => openIssue(t.source, t.key)} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-0 self-start py-0">
          <CardHeader className="py-6">
            <CardTitle>Projects</CardTitle>
            <CardDescription>Private projects are a git repo on this computer.</CardDescription>
          </CardHeader>
          <ul className="divide-y border-t">
            {projects.map((p) => {
              const local = p.source === 'local'
              const done = Math.max(0, p.issueCount - p.openCount)
              return (
                <li key={`${p.source}:${p.key}`}>
                  <button type="button" onClick={() => navigate(viewPath('board', p))} className="flex w-full flex-col gap-2 px-6 py-4 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/60">
                    <span className="flex w-full items-center gap-3">
                      <ProjectAvatar projectKey={p.key} local={local} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {local ? <Lock className="size-3" /> : <Cloud className="size-3" />}
                          {local ? 'Private' : 'Team Jira'}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{p.openCount} open</span>
                    </span>
                    {p.issueCount > 0 && <Progress value={(done / p.issueCount) * 100} className="h-1.5" aria-label={`${done} of ${p.issueCount} done`} />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-2 border-t px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => openDialog('project')}>
              <Plus /> Private project
            </Button>
            {!overview?.connection.connected && (
              <Button variant="ghost" size="sm" onClick={() => openDialog('connect')}>
                <Cloud /> Connect team Jira
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
