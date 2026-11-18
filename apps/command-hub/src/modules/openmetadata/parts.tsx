import { createElement } from 'react'

import { Badge } from '@/components/ui/badge'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import { typeIcon } from './catalog'
import type { OmCounts, OmRef, OmTag } from './types'
import { countOf, displayName, isTier } from './util'

/** An entity type's icon on a soft tile. */
export function TypeTile({ type, className }: { type: string | undefined; className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground', className)} aria-hidden>
      {createElement(typeIcon(type), { className: 'size-4' })}
    </span>
  )
}

/** A type's count: blank while loading, a dash when the server lacks the type. */
export function CountText({ counts, type, className }: { counts: OmCounts | undefined; type: string; className?: string }) {
  const c = countOf(counts, type)
  return <span className={cn('text-xs text-muted-foreground tabular-nums', className)}>{c.error ? '–' : c.n === undefined ? '' : formatCount(c.n)}</span>
}

export function Owners({ owners, empty = 'No owner' }: { owners: OmRef[] | undefined; empty?: string }) {
  if (!owners?.length) return <span className="text-sm text-muted-foreground">{empty}</span>
  return <span className="truncate text-sm">{owners.map((o) => displayName(o)).join(', ')}</span>
}

export function Tags({ tags, empty = 'None' }: { tags: OmTag[] | undefined; empty?: string }) {
  const plain = (tags ?? []).filter((t) => !isTier(t))
  if (!plain.length) return <span className="text-sm text-muted-foreground">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {plain.map((t) => (
        <Badge key={t.tagFQN} variant={t.source === 'Glossary' ? 'info' : 'secondary'} className="font-normal">
          {t.tagFQN}
        </Badge>
      ))}
    </span>
  )
}
