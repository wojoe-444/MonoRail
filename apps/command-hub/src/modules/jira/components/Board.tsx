import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { Issue, StatusCategory } from '../types'
import { CATEGORY_LABEL, PersonAvatar, PriorityIcon, StatusBadge, TypeIcon } from './bits'

const COLUMNS: StatusCategory[] = ['todo', 'in_progress', 'done']
const COLUMN_DOT: Record<StatusCategory, string> = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-info',
  done: 'bg-success',
}

interface BoardProps {
  issues: Issue[]
  /** Show which project each card belongs to (the "All work" view). */
  showProject?: boolean
  onOpen: (issue: Issue) => void
  onMove: (issue: Issue, to: StatusCategory) => void
  busyKey?: string
}

/** Three columns by status category; drag a card to move it. */
export function Board({ issues, showProject, onOpen, onMove, busyKey }: BoardProps) {
  const [dragKey, setDragKey] = useState<string>()
  const [over, setOver] = useState<StatusCategory>()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              const issue = issues.find((i) => i.key === dragKey)
              setDragKey(undefined)
              setOver(undefined)
              if (issue && issue.statusCategory !== col) onMove(issue, col)
            }}
            className={cn(
              'flex min-h-48 flex-col gap-2 rounded-xl bg-muted/70 p-2 transition-colors',
              over === col && 'bg-primary-soft/60 ring-2 ring-primary/30',
            )}
          >
            <header className="flex items-center gap-2 px-2 pt-1 pb-1">
              <span className={cn('size-2 rounded-full', COLUMN_DOT[col])} />
              <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {CATEGORY_LABEL[col]}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
            </header>
            {items.map((issue) => (
              <button
                key={issue.key}
                type="button"
                draggable
                onDragStart={(e) => {
                  setDragKey(issue.key)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                  setDragKey(undefined)
                  setOver(undefined)
                }}
                onClick={() => onOpen(issue)}
                className={cn(
                  'group flex flex-col gap-3 rounded-lg border bg-card p-3 text-left shadow-elevation-1 transition-shadow outline-none hover:shadow-elevation-2 focus-visible:ring-[3px] focus-visible:ring-ring',
                  dragKey === issue.key && 'opacity-50',
                  busyKey === issue.key && 'animate-pulse',
                )}
              >
                <span className="text-sm leading-snug font-medium">{issue.summary}</span>
                {issue.labels.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {issue.labels.slice(0, 3).map((l) => (
                      <span key={l} className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                        {l}
                      </span>
                    ))}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <TypeIcon type={issue.type} />
                  <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">{issue.key}</span>
                  {showProject && issue.projectName && (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">· {issue.projectName}</span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {issue.commentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
                        <MessageSquare className="size-3.5" /> {issue.commentCount}
                      </span>
                    )}
                    <PriorityIcon priority={issue.priority} />
                    <PersonAvatar name={issue.assignee} />
                  </span>
                </span>
                {col === 'in_progress' && issue.status !== CATEGORY_LABEL.in_progress && (
                  <StatusBadge status={issue.status} category={issue.statusCategory} className="-mt-1" />
                )}
              </button>
            ))}
            {items.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
                {dragKey ? 'Drop here' : 'Nothing here'}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
