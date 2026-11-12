import { useState } from 'react'

import { cn } from '@/lib/utils'

import { Avatar, CATEGORY_LABEL, Lozenge, PriorityIcon, TypeIcon } from '../bits'
import { formatDuration } from '../time'
import type { Issue, StatusCategory } from '../types'
import { ParentChip } from './Parent'

const COLUMNS: StatusCategory[] = ['todo', 'in_progress', 'done']

interface BoardProps {
  issues: Issue[]
  onOpen: (issue: Issue) => void
  onMove: (issue: Issue, to: StatusCategory) => void
  busyKey?: string
}

/** Kanban board: one column per status category; drag a card to move it. */
export function Board({ issues, onOpen, onMove, busyKey }: BoardProps) {
  const [dragKey, setDragKey] = useState<string>()
  const [over, setOver] = useState<StatusCategory>()

  return (
    <div className="flex min-h-0 gap-2 overflow-x-auto pb-4">
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
              'flex w-[272px] min-w-[272px] flex-1 flex-col gap-1 rounded-md bg-(--jp-sunken) p-1.5 transition-colors',
              over === col && 'bg-(--jp-selected) outline-2 outline-(--jp-focus) outline-dashed',
            )}
          >
            <header className="flex h-10 items-center gap-2 px-2">
              <span className="jp-overline">{CATEGORY_LABEL[col]}</span>
              <span className="jp-overline">{items.length}</span>
              {col === 'done' && items.length > 0 && <span className="ml-auto text-(--jp-type-story)">✓</span>}
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
                  'jp-focusable flex flex-col gap-3 rounded-[3px] bg-(--jp-raised) p-3 text-left shadow-(--jp-shadow-raised) outline-none hover:bg-(--jp-hover)',
                  dragKey === issue.key && 'opacity-40',
                  busyKey === issue.key && 'animate-pulse',
                )}
              >
                <span className="break-words text-(--jp-text)">{issue.summary}</span>
                {issue.parent && <ParentChip parent={issue.parent} className="self-start" />}
                {(issue.labels.length > 0 || (col === 'in_progress' && issue.status !== 'In Progress')) && (
                  <span className="flex flex-wrap gap-1">
                    {col === 'in_progress' && issue.status !== 'In Progress' && <Lozenge status={issue.status} category={issue.statusCategory} />}
                    {issue.labels.slice(0, 3).map((l) => (
                      <span key={l} className="rounded-[3px] border border-(--jp-border) px-1 text-xs text-(--jp-subtle)">
                        {l}
                      </span>
                    ))}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <TypeIcon type={issue.type} />
                  <span className={cn('text-xs font-semibold text-(--jp-subtle)', col === 'done' && 'line-through')}>{issue.key}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {!!issue.timeSpentSeconds && (
                      <span className="font-mono text-xs text-(--jp-subtle) tabular-nums" title="Time logged">
                        {formatDuration(issue.timeSpentSeconds)}
                      </span>
                    )}
                    <PriorityIcon priority={issue.priority} />
                    <Avatar name={issue.assignee} />
                  </span>
                </span>
              </button>
            ))}
          </section>
        )
      })}
    </div>
  )
}
