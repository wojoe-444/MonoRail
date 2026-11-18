import type { DragEvent, MouseEvent } from 'react'
import { GitBranch, MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'

import { cycleLabel, dueTone, estimateLabel, identifier, isDone, shortDate } from '../lib'
import { useTracker } from '../TrackerContext'
import type { Issue } from '../types'
import { Avatar, Chip, Dot, EntityIcon, PriorityIcon, StatusIcon } from './bits'
import { DatePicker, NONE, Picker, startedFill, useItems } from './Picker'

/** The inline pickers every row and card share: priority, status, assignee. */
function useRowEdit(issue: Issue) {
  const { updateIssues } = useTracker()
  return (patch: Partial<Issue>) => void updateIssues({ ids: [issue.id], patch })
}

const stop = (e: MouseEvent) => e.stopPropagation()

export function IssueRow({ issue, selected, onSelect, draggable, onDragStart, onDragOver, onDrop, dropAbove }: { issue: Issue; selected: boolean; onSelect: (e: MouseEvent) => void; draggable?: boolean; onDragStart?: (e: DragEvent) => void; onDragOver?: (e: DragEvent) => void; onDrop?: (e: DragEvent) => void; dropAbove?: boolean }) {
  const { snap, idx, openIssue, openedIssue } = useTracker()
  const items = useItems()
  const edit = useRowEdit(issue)
  const st = idx.state.get(issue.stateId)
  const team = idx.team.get(issue.teamId)
  const project = snap.projects.find((p) => p.id === issue.projectId)
  const cycle = snap.cycles.find((c) => c.id === issue.cycleId)
  const assignee = snap.users.find((u) => u.id === issue.assigneeId)
  const subs = idx.children.get(issue.id) ?? []
  const done = isDone(idx, issue)
  const tone = dueTone(issue.dueDate, done)
  const comments = snap.commentCounts[issue.id] ?? 0
  return (
    <div
      role="row"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => openIssue(issue)}
      onKeyDown={(e) => e.key === 'Enter' && openIssue(issue)}
      className={cn(
        'group relative flex h-10 cursor-default items-center gap-2 border-b px-4 text-sm outline-none hover:bg-accent/60 focus-visible:bg-accent',
        (selected || openedIssue?.id === issue.id) && 'bg-primary-soft/60',
        dropAbove && 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary',
      )}
    >
      <input type="checkbox" checked={selected} readOnly onClick={(e) => { e.stopPropagation(); onSelect(e) }} aria-label="Select" className={cn('size-3.5 shrink-0 accent-(--primary)', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')} />
      <Picker items={items.priority()} selected={[String(issue.priority)]} onPick={(v) => edit({ priority: Number(v) })} placeholder="Set priority…">
        <button type="button" onClick={stop} className="rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label="Priority">
          <PriorityIcon priority={issue.priority} />
        </button>
      </Picker>
      <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{identifier(idx, issue)}</span>
      <Picker items={items.status(issue.teamId)} selected={[issue.stateId]} onPick={(v) => edit({ stateId: v })} placeholder="Change status…">
        <button type="button" onClick={stop} className="rounded p-0.5 hover:bg-accent" aria-label={`Status: ${st?.name ?? ''}`}>
          {st && <StatusIcon type={st.type} color={st.color} fill={startedFill(snap.states.filter((s) => s.teamId === issue.teamId).sort((a, b) => a.position - b.position), st.id)} />}
        </button>
      </Picker>
      <span className={cn('min-w-0 truncate', done && 'text-muted-foreground')}>{issue.title}</span>
      {subs.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground" title={`${subs.filter((s) => isDone(idx, s)).length} of ${subs.length} sub-issues done`}>
          <GitBranch className="size-3" />
          {subs.filter((s) => isDone(idx, s)).length}/{subs.length}
        </span>
      )}
      {comments > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3" />
          {comments}
        </span>
      )}
      <span className="flex-1" />
      <span className="hidden min-w-0 items-center gap-1 overflow-hidden lg:flex">
        {issue.labelIds.slice(0, 3).map((l) => {
          const label = snap.labels.find((x) => x.id === l)
          return label ? (
            <Chip key={l}>
              <Dot color={label.color} />
              <span className="truncate">{label.name}</span>
            </Chip>
          ) : null
        })}
        {project && (
          <Chip title="Project">
            <EntityIcon icon={project.icon} color={project.color} size={12} />
            <span className="truncate">{project.name}</span>
          </Chip>
        )}
        {cycle && <Chip title="Cycle">{cycleLabel(cycle)}</Chip>}
      </span>
      {issue.estimate != null && <span className="hidden shrink-0 text-xs text-muted-foreground md:inline" title={estimateLabel(team, issue.estimate)}>{team?.estimateType === 'tShirt' ? estimateLabel(team, issue.estimate) : issue.estimate}</span>}
      <DatePicker value={issue.dueDate} onChange={(v) => edit({ dueDate: v })} align="end">
        <button type="button" onClick={stop} className={cn('hidden shrink-0 rounded px-1 text-xs hover:bg-accent sm:inline', !issue.dueDate && 'opacity-0 group-hover:opacity-60', tone === 'overdue' ? 'text-destructive' : tone === 'soon' ? 'text-warning-soft-foreground' : 'text-muted-foreground')}>
          {issue.dueDate ? shortDate(issue.dueDate) : 'Due'}
        </button>
      </DatePicker>
      <span className="hidden w-12 shrink-0 text-right text-xs text-muted-foreground xl:inline">{new Date(issue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      <Picker items={items.member()} selected={[issue.assigneeId ?? NONE]} onPick={(v) => edit({ assigneeId: v === NONE ? null : v })} placeholder="Assign to…" align="end">
        <button type="button" onClick={stop} className="shrink-0 rounded-full" aria-label={`Assignee: ${assignee?.name ?? 'none'}`}>
          <Avatar member={assignee} />
        </button>
      </Picker>
    </div>
  )
}

export function IssueCard({ issue, onDragStart, onDragOver, onDrop, dropAbove }: { issue: Issue; onDragStart: (e: DragEvent) => void; onDragOver: (e: DragEvent) => void; onDrop: (e: DragEvent) => void; dropAbove: boolean }) {
  const { snap, idx, openIssue } = useTracker()
  const items = useItems()
  const edit = useRowEdit(issue)
  const assignee = snap.users.find((u) => u.id === issue.assigneeId)
  const project = snap.projects.find((p) => p.id === issue.projectId)
  const st = idx.state.get(issue.stateId)
  const done = isDone(idx, issue)
  const tone = dueTone(issue.dueDate, done)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => openIssue(issue)}
      onKeyDown={(e) => e.key === 'Enter' && openIssue(issue)}
      tabIndex={0}
      className={cn('relative flex cursor-grab flex-col gap-2 rounded-lg bg-card p-3 text-sm ring-1 ring-foreground/10 outline-none hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing', dropAbove && 'before:absolute before:inset-x-0 before:-top-1.5 before:h-0.5 before:rounded before:bg-primary')}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">{identifier(idx, issue)}</span>
        <span className="flex-1" />
        <Picker items={items.member()} selected={[issue.assigneeId ?? NONE]} onPick={(v) => edit({ assigneeId: v === NONE ? null : v })} placeholder="Assign to…" align="end">
          <button type="button" onClick={stop} className="rounded-full" aria-label="Assignee">
            <Avatar member={assignee} />
          </button>
        </Picker>
      </div>
      <div className="flex items-start gap-2">
        {st && <StatusIcon type={st.type} color={st.color} className="mt-0.5" />}
        <span className={cn('line-clamp-3', done && 'text-muted-foreground')}>{issue.title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Picker items={items.priority()} selected={[String(issue.priority)]} onPick={(v) => edit({ priority: Number(v) })}>
          <button type="button" onClick={stop} className="flex h-5 items-center rounded border px-1 text-muted-foreground hover:bg-accent" aria-label="Priority">
            <PriorityIcon priority={issue.priority} />
          </button>
        </Picker>
        {issue.labelIds.slice(0, 2).map((l) => {
          const label = snap.labels.find((x) => x.id === l)
          return label ? (
            <Chip key={l}>
              <Dot color={label.color} />
              <span className="truncate">{label.name}</span>
            </Chip>
          ) : null
        })}
        {project && (
          <Chip>
            <EntityIcon icon={project.icon} color={project.color} size={12} />
            <span className="truncate">{project.name}</span>
          </Chip>
        )}
        {issue.estimate != null && <Chip>{estimateLabel(idx.team.get(issue.teamId), issue.estimate)}</Chip>}
        {issue.dueDate && <Chip className={cn(tone === 'overdue' && 'border-destructive/40 text-destructive')}>{shortDate(issue.dueDate)}</Chip>}
      </div>
    </div>
  )
}
