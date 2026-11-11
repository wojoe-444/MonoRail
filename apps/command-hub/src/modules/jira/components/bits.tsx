import {
  Bookmark,
  Bug,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  CircleCheck,
  Equal,
  FlaskConical,
  SquareCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { StatusCategory } from '../types'

const TYPE_ICONS: Record<string, [LucideIcon, string]> = {
  task: [SquareCheck, 'bg-info-soft text-info-soft-foreground'],
  bug: [Bug, 'bg-destructive-soft text-destructive-soft-foreground'],
  story: [Bookmark, 'bg-success-soft text-success-soft-foreground'],
  spike: [FlaskConical, 'bg-warning-soft text-warning-soft-foreground'],
  epic: [Zap, 'bg-primary-soft text-primary-soft-foreground'],
  'sub-task': [CircleCheck, 'bg-highlight-soft text-highlight-soft-foreground'],
}

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const [Icon, tone] = TYPE_ICONS[type.toLowerCase()] ?? TYPE_ICONS.task
  return (
    <span
      title={type}
      className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-[5px]', tone, className)}
    >
      <Icon className="size-3.5" aria-label={type} />
    </span>
  )
}

const PRIORITY_ICONS: Record<string, [LucideIcon, string]> = {
  highest: [ChevronsUp, 'text-destructive'],
  high: [ChevronUp, 'text-warning'],
  medium: [Equal, 'text-info'],
  low: [ChevronDown, 'text-success'],
  lowest: [ChevronsDown, 'text-muted-foreground'],
}

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const [Icon, tone] = PRIORITY_ICONS[priority.toLowerCase()] ?? PRIORITY_ICONS.medium
  return (
    <span title={`${priority} priority`} className="inline-flex shrink-0">
      <Icon className={cn('size-4', tone, className)} aria-label={`${priority} priority`} />
    </span>
  )
}

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const CATEGORY_VARIANT = { todo: 'secondary', in_progress: 'info', done: 'success' } as const

export function StatusBadge({ status, category, className }: { status: string; category: StatusCategory; className?: string }) {
  return (
    <Badge variant={CATEGORY_VARIANT[category]} className={cn('rounded-md uppercase tracking-[0.04em]', className)}>
      {status}
    </Badge>
  )
}

const PROJECT_TONES = [
  'bg-primary text-primary-foreground',
  'bg-highlight text-highlight-foreground',
  'bg-success text-white',
  'bg-info text-white',
  'bg-warning text-foreground',
  'bg-destructive text-white',
]

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/** Square project avatar with the key's first letters, like Jira's project icons. */
export function ProjectAvatar({ projectKey, size = 'md', className }: { projectKey: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
        PROJECT_TONES[hash(projectKey) % PROJECT_TONES.length],
        size === 'sm' && 'size-6 text-[10px]',
        size === 'md' && 'size-8 text-xs',
        size === 'lg' && 'size-12 text-base',
        className,
      )}
    >
      {projectKey.slice(0, 2)}
    </span>
  )
}

export function PersonAvatar({ name, className }: { name?: string; className?: string }) {
  const initials = name
    ? name
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'
  return (
    <span
      title={name ?? 'Unassigned'}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        name ? 'bg-primary-soft text-primary-soft-foreground' : 'border border-dashed text-muted-foreground',
        className,
      )}
    >
      {initials}
    </span>
  )
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase', className)}>
      {children}
    </div>
  )
}
