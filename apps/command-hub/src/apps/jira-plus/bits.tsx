import { Bookmark, Bug, Check, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Equal, FlaskConical, Lock, Repeat, Zap, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { StatusCategory } from './types'

const TYPES: Record<string, [LucideIcon, string]> = {
  task: [Check, 'bg-info-soft text-info-soft-foreground'],
  bug: [Bug, 'bg-destructive-soft text-destructive-soft-foreground'],
  story: [Bookmark, 'bg-success-soft text-success-soft-foreground'],
  spike: [FlaskConical, 'bg-warning-soft text-warning-soft-foreground'],
  epic: [Zap, 'bg-primary-soft text-primary-soft-foreground'],
  recurring: [Repeat, 'bg-highlight-soft text-highlight-soft-foreground'],
  'sub-task': [Check, 'bg-info-soft text-info-soft-foreground'],
  subtask: [Check, 'bg-info-soft text-info-soft-foreground'],
}

/** Soft colored tile per task type (MonoRail's soft semantic colors). */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const [Icon, tone] = TYPES[type.toLowerCase()] ?? TYPES.task
  return (
    <span title={type} role="img" aria-label={type} className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-md', tone, className)}>
      <Icon className="size-3" strokeWidth={2.5} />
    </span>
  )
}

const PRIORITIES: Record<string, LucideIcon> = {
  highest: ChevronsUp,
  high: ChevronUp,
  medium: Equal,
  low: ChevronDown,
  lowest: ChevronsDown,
}

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const key = priority.toLowerCase()
  const Icon = PRIORITIES[key] ?? Equal
  return (
    <span title={`${priority} priority`} role="img" aria-label={`${priority} priority`} className="inline-flex shrink-0">
      <Icon className={cn('size-4', className)} strokeWidth={2.5} style={{ color: `var(--jp-pri-${PRIORITIES[key] ? key : 'medium'})` }} />
    </span>
  )
}

export const CATEGORY_LABEL: Record<StatusCategory, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

export function Lozenge({ status, category, className }: { status: string; category: StatusCategory; className?: string }) {
  return <span className={cn('jp-lozenge', `jp-lz-${category}`, className)}>{status}</span>
}

/** Soft project tile with its key. Private projects get a lock badge so you always know where a task lives. */
export function ProjectAvatar({ projectKey, local, size = 24, className }: { projectKey: string; local?: boolean; size?: 16 | 24 | 32 | 40; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className={cn('flex size-full items-center justify-center rounded-md font-mono font-semibold', local ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-info-soft text-info-soft-foreground')}
        style={{ fontSize: Math.max(8, size * 0.32) }}
      >
        {projectKey.slice(0, size >= 32 ? 4 : 2)}
      </span>
      {local && size >= 24 && (
        <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
          <Lock className="size-2" strokeWidth={3} />
        </span>
      )}
    </span>
  )
}

export function Avatar({ name, size = 24, className }: { name?: string; size?: 24 | 32; className?: string }) {
  const initials = name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : ''
  return (
    <span
      title={name ?? 'Unassigned'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        name ? 'bg-highlight-soft text-highlight-soft-foreground' : 'border-2 border-dashed border-(--jp-border-bold) bg-transparent',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  )
}

/** "Private" chip for private (local) projects. */
export function LocalChip({ className }: { className?: string }) {
  return (
    <span
      title="Stored in a private git repo on this computer. Never sent anywhere."
      className={cn('inline-flex items-center gap-1 rounded-full bg-(--jp-local-bg) px-2 text-xs leading-5 font-medium text-(--jp-local)', className)}
    >
      <Lock className="size-3" /> Private
    </span>
  )
}
