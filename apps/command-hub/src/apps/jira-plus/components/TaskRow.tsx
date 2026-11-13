import { CalendarDays, Cloud, Lock, MessageSquare, Repeat } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Lozenge, PriorityIcon, TypeIcon } from '../bits'
import { dueLabel } from '../due'
import { formatDuration } from '../time'
import type { Issue } from '../types'

/** Expected end date in words, colored when it is close or has passed. */
export function DueDate({ issue, empty = true }: { issue: Issue; empty?: boolean }) {
  if (!issue.dueDate) return empty ? <span className="text-xs text-muted-foreground/60">No date</span> : null
  const { text, tone } = dueLabel(issue.dueDate)
  const done = issue.statusCategory === 'done'
  return (
    <span
      title={`Expected end ${issue.dueDate}`}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums',
        done ? 'text-muted-foreground' : tone === 'late' ? 'text-destructive' : tone === 'soon' ? 'text-warning-soft-foreground' : 'text-muted-foreground',
      )}
    >
      {issue.type === 'Recurring' ? <Repeat className="size-3" /> : <CalendarDays className="size-3" />}
      {text}
    </span>
  )
}

/** Where a task lives: a private project on this computer or a team Jira project. */
export function WhereTag({ issue }: { issue: Issue }) {
  const local = issue.source === 'local'
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={local ? 'Private: kept on this computer' : 'Team Jira'}>
      {local ? <Lock className="size-3 shrink-0" /> : <Cloud className="size-3 shrink-0" />}
      <span className="truncate">{issue.projectName ?? issue.projectKey}</span>
    </span>
  )
}

/** One task as a list row (hub list style: dividers and a hover state). */
export function TaskRow({ issue, selected, onOpen, showProject = true }: { issue: Issue; selected?: boolean; onOpen: (i: Issue) => void; showProject?: boolean }) {
  const done = issue.statusCategory === 'done'
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(issue)}
        className={cn(
          'flex w-full items-center gap-4 px-6 py-3 text-left transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/60',
          selected && 'bg-primary-soft/50 hover:bg-primary-soft/50',
        )}
      >
        <TypeIcon type={issue.type} className="size-6" />
        <span className={cn('w-20 shrink-0 font-mono text-xs text-muted-foreground', done && 'line-through')}>{issue.key}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-medium', done && 'text-muted-foreground')}>{issue.summary}</span>
          {(showProject || issue.parent || issue.labels.length > 0) && (
            <span className="flex min-w-0 items-center gap-3">
              {showProject && <WhereTag issue={issue} />}
              {issue.parent && (
                <span className="truncate text-xs text-muted-foreground" title={issue.parent.summary}>
                  in <span className="font-mono">{issue.parent.key}</span>
                  {issue.parent.summary ? ` ${issue.parent.summary}` : ''}
                </span>
              )}
              {issue.labels.slice(0, 2).map((l) => (
                <span key={l} className="hidden rounded-full border px-1.5 text-[11px] leading-4 text-muted-foreground lg:inline">
                  {l}
                </span>
              ))}
            </span>
          )}
        </span>
        {issue.commentCount > 0 && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground tabular-nums md:inline-flex" title={`${issue.commentCount} comments`}>
            <MessageSquare className="size-3" />
            {issue.commentCount}
          </span>
        )}
        {!!issue.timeSpentSeconds && (
          <span className="hidden font-mono text-xs text-muted-foreground tabular-nums lg:inline" title="Time logged">
            {formatDuration(issue.timeSpentSeconds)}
          </span>
        )}
        <span className="hidden w-24 md:block">
          <DueDate issue={issue} />
        </span>
        <PriorityIcon priority={issue.priority} />
        <span className="flex w-32 justify-end">
          <Lozenge status={issue.status} category={issue.statusCategory} />
        </span>
      </button>
    </li>
  )
}
