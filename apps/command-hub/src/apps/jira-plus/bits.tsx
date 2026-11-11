import { Bookmark, Bug, Check, ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Equal, FlaskConical, Lock, Zap, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { StatusCategory } from './types'

const TYPES: Record<string, [LucideIcon, string]> = {
  task: [Check, 'var(--jp-type-task)'],
  bug: [Bug, 'var(--jp-type-bug)'],
  story: [Bookmark, 'var(--jp-type-story)'],
  spike: [FlaskConical, 'var(--jp-type-spike)'],
  epic: [Zap, 'var(--jp-type-epic)'],
  'sub-task': [Check, 'var(--jp-type-subtask)'],
  subtask: [Check, 'var(--jp-type-subtask)'],
}

/** 16px colored tile per issue type, like Jira's type icons. */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const [Icon, color] = TYPES[type.toLowerCase()] ?? TYPES.task
  return (
    <span
      title={type}
      role="img"
      aria-label={type}
      className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] text-white', className)}
      style={{ background: color }}
    >
      <Icon className="size-3" strokeWidth={3} />
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

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/** Rounded-square project avatar. Local projects get a lock badge so you always know where a ticket lives. */
export function ProjectAvatar({ projectKey, local, size = 24, className }: { projectKey: string; local?: boolean; size?: 16 | 24 | 32 | 40; className?: string }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <span
        className="flex size-full items-center justify-center rounded-[3px] font-bold text-white"
        style={{ background: `var(--jp-av-${(hash(projectKey) % 6) + 1})`, fontSize: Math.max(8, size * 0.38) }}
      >
        {projectKey.slice(0, 2)}
      </span>
      {local && size >= 24 && (
        <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-(--jp-local) text-white ring-2 ring-(--jp-bg)">
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
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        !name && 'border-2 border-dashed border-(--jp-border-bold) bg-transparent',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4, background: name ? `var(--jp-av-${(hash(name) % 6) + 1})` : undefined }}
    >
      {initials}
    </span>
  )
}

/** "Private" chip for local projects. */
export function LocalChip({ className }: { className?: string }) {
  return (
    <span
      title="Stored in a private git repo on this computer. Never sent anywhere."
      className={cn('inline-flex items-center gap-1 rounded-[3px] bg-(--jp-local-bg) px-1.5 text-[11px] leading-4 font-bold text-(--jp-local) uppercase', className)}
    >
      <Lock className="size-2.5" strokeWidth={3} /> Private
    </span>
  )
}
