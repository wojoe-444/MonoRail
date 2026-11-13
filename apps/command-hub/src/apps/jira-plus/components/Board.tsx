import { useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { Avatar, CATEGORY_LABEL, Lozenge, PriorityIcon, TypeIcon } from '../bits'
import { formatDuration } from '../time'
import type { Issue, StatusCategory } from '../types'
import { ParentChip } from './Parent'
import { DueDate, WhereTag } from './TaskRow'

const COLUMNS: StatusCategory[] = ['todo', 'in_progress', 'done']
const DOT: Record<StatusCategory, string> = { todo: 'bg-muted-foreground/50', in_progress: 'bg-info', done: 'bg-success' }

interface BoardProps {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  onMove: (issue: Issue, to: StatusCategory) => void
  /** "Add task" at the bottom of a column; hidden when not given. */
  onAdd?: () => void
  /** Show which project each card belongs to (the all-projects board). */
  showProject?: boolean
  busyKey?: string
}

/** Board: one column per status category; drag a card to move it. */
export function Board({ issues, onOpen, onMove, onAdd, showProject, busyKey }: BoardProps) {
  const [dragKey, setDragKey] = useState<string>()
  const [over, setOver] = useState<StatusCategory>()

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = issues.filter((i) => i.statusCategory === col)
        return (
          <section
            key={col}
            aria-label={CATEGORY_LABEL[col]}
            onDragOver={(e) => {
              if (!dragKey) return
              e.preventDefault()
              setOver(col)
            }}
            onDragLeave={() => setOver((o) => (o === col ? undefined : o))}
            onDrop={(e) => {
              e.preventDefault()
              const issue = issues.find((i) => `${i.source}:${i.key}` === dragKey)
              setDragKey(undefined)
              setOver(undefined)
              if (issue && issue.statusCategory !== col) onMove(issue, col)
            }}
            className={cn(
              'flex min-w-0 flex-col gap-3 rounded-xl bg-muted/60 p-3 ring-1 ring-foreground/5 transition-colors',
              over === col && 'bg-primary-soft/60 ring-2 ring-primary/40',
            )}
          >
            <header className="flex items-center gap-2 px-1 pt-1">
              <span className={cn('size-2 rounded-full', DOT[col])} />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{CATEGORY_LABEL[col]}</span>
              <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
            </header>
            {items.map((issue) => {
              const id = `${issue.source}:${issue.key}`
              return (
                <Card
                  key={id}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => {
                    setDragKey(id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragKey(undefined)
                    setOver(undefined)
                  }}
                  onClick={() => onOpen(issue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpen(issue)
                    }
                  }}
                  className={cn(
                    'cursor-pointer gap-3 px-4 py-4 text-left transition-shadow outline-none hover:shadow-elevation-2 focus-visible:ring-2 focus-visible:ring-ring',
                    dragKey === id && 'opacity-40',
                    busyKey === issue.key && 'animate-pulse',
                  )}
                >
                  <span className={cn('text-sm leading-snug font-medium break-words', col === 'done' && 'text-muted-foreground')}>{issue.summary}</span>
                  {(issue.parent || showProject) && (
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      {showProject && <WhereTag issue={issue} />}
                      {issue.parent && <ParentChip parent={issue.parent} className="max-w-full" />}
                    </span>
                  )}
                  {(issue.labels.length > 0 || (col === 'in_progress' && issue.status !== 'In Progress')) && (
                    <span className="flex flex-wrap gap-1">
                      {col === 'in_progress' && issue.status !== 'In Progress' && <Lozenge status={issue.status} category={issue.statusCategory} />}
                      {issue.labels.slice(0, 3).map((l) => (
                        <span key={l} className="rounded-full border px-2 text-xs leading-5 text-muted-foreground">
                          {l}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <TypeIcon type={issue.type} />
                    <span className={cn('font-mono text-xs text-muted-foreground', col === 'done' && 'line-through')}>{issue.key}</span>
                    <span className="ml-auto flex items-center gap-2.5">
                      {issue.commentCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums" title={`${issue.commentCount} ${issue.commentCount === 1 ? 'comment' : 'comments'}`}>
                          <MessageSquare className="size-3" />
                          {issue.commentCount}
                        </span>
                      )}
                      {!!issue.timeSpentSeconds && (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums" title="Time logged">
                          {formatDuration(issue.timeSpentSeconds)}
                        </span>
                      )}
                      {col !== 'done' && <DueDate issue={issue} empty={false} />}
                      <PriorityIcon priority={issue.priority} />
                      {issue.assignee && <Avatar name={issue.assignee} />}
                    </span>
                  </span>
                </Card>
              )
            })}
            {onAdd && col !== 'done' && (
              <button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                <Plus className="size-3.5" /> Add task
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}
