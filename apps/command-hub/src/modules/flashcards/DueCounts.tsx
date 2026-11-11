import { cn } from '@/lib/utils'

import type { DeckCounts } from './types'

const KINDS = [
  { key: 'new', label: 'New', className: 'text-info' },
  { key: 'learning', label: 'Learning', className: 'text-warning-soft-foreground' },
  { key: 'review', label: 'Due', className: 'text-success' },
] as const

/** New / Learning / Due figures in fixed colors, or (legend) just their labels. */
export function DueCounts({ counts, legend, className }: { counts?: DeckCounts; legend?: boolean; className?: string }) {
  if (legend) {
    return (
      <span className={cn('flex items-center gap-4', className)}>
        {KINDS.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full bg-current', k.className)} />
            {k.label}
          </span>
        ))}
      </span>
    )
  }
  return (
    <span className={cn('flex items-center gap-4 font-mono text-sm tabular-nums', className)}>
      {KINDS.map((k) => {
        const n = counts?.[k.key] ?? 0
        return (
          <span key={k.key} title={k.label} className={cn('w-10 text-right', n ? cn('font-semibold', k.className) : 'text-muted-foreground/60')}>
            {n}
          </span>
        )
      })}
    </span>
  )
}
