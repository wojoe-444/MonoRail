import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { ErrorNote } from '../components/Modal'
import { TaskRow } from '../components/TaskRow'
import { daysUntil } from '../due'
import { useJira } from '../JiraContext'
import { matches, useQuery, useScope, useScopedIssues } from '../scope'
import type { Issue, StatusCategory } from '../types'

const GROUPS: [StatusCategory, string][] = [
  ['in_progress', 'In progress'],
  ['todo', 'To do'],
  ['done', 'Done'],
]

function byDue(a: Issue, b: Issue): number {
  const da = a.dueDate ? (daysUntil(a.dueDate) ?? 9999) : 9999
  const db = b.dueDate ? (daysUntil(b.dueDate) ?? 9999) : 9999
  return da - db || b.updated.localeCompare(a.updated)
}

/** Every task in scope, grouped by status. Also the Epics and Recurring views of one project. */
export function TaskListView() {
  const { openIssue, selected } = useJira()
  const { view, projectRef } = useScope()
  const [q] = useQuery()
  const { issues, error } = useScopedIssues(projectRef)
  const [showDone, setShowDone] = useState(view !== 'list')
  const [closed, setClosed] = useState<Set<StatusCategory>>(new Set())

  const shown = useMemo(
    () =>
      (issues ?? [])
        .filter((i) => (view === 'recurring' ? i.type === 'Recurring' : i.type !== 'Recurring' && (view !== 'epics' || i.type.toLowerCase() === 'epic')))
        .filter((i) => matches(i, q))
        .sort(byDue),
    [issues, view, q],
  )
  const doneCount = shown.filter((i) => i.statusCategory === 'done').length
  const one = issues ? shown.length === 1 : false
  const noun = view === 'recurring' ? (one ? 'recurring task' : 'recurring tasks') : view === 'epics' ? (one ? 'epic' : 'epics') : one ? 'task' : 'tasks'

  const toggle = (c: StatusCategory) =>
    setClosed((s) => {
      const next = new Set(s)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 text-sm text-muted-foreground">
        <span>
          {issues ? shown.length : '…'} {noun}
          {q && (
            <>
              {' '}
              matching “<span className="text-foreground">{q}</span>”
            </>
          )}
        </span>
        {view === 'recurring' && <span>Finish one to create its next occurrence.</span>}
        <label className="ml-auto flex items-center gap-2 text-xs">
          <Switch checked={showDone} onCheckedChange={setShowDone} aria-label="Show done tasks" />
          Show done{doneCount ? ` (${doneCount})` : ''}
        </label>
      </div>
      <ErrorNote error={error} className="mx-6" />
      {!issues && !error && (
        <div className="flex items-center gap-2 border-t px-6 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {issues && shown.length === 0 && (
        <p className="border-t px-6 py-12 text-center text-sm text-muted-foreground">
          {q ? 'Nothing matches your search.' : view === 'epics' ? 'No epics yet. Make one with New epic.' : view === 'recurring' ? 'No recurring tasks yet.' : 'Nothing here yet. Add one with New task.'}
        </p>
      )}
      {issues &&
        GROUPS.filter(([c]) => c !== 'done' || showDone).map(([c, label]) => {
          const list = shown.filter((i) => i.statusCategory === c)
          if (!list.length) return null
          const isClosed = closed.has(c)
          return (
            <div key={c}>
              <button
                type="button"
                onClick={() => toggle(c)}
                aria-expanded={!isClosed}
                className="flex w-full items-center gap-2 border-t bg-muted/40 px-6 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase outline-none hover:text-foreground focus-visible:bg-muted"
              >
                {isClosed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {label}
                <span className="font-mono normal-case">{list.length}</span>
              </button>
              <ul className={cn('divide-y border-t', isClosed && 'hidden')}>
                {list.map((i) => (
                  <TaskRow key={`${i.source}:${i.key}`} issue={i} showProject={!projectRef} selected={selected?.source === i.source && selected.key === i.key} onOpen={(t) => openIssue(t.source, t.key)} />
                ))}
              </ul>
            </div>
          )
        })}
    </Card>
  )
}
