import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Small uppercase label above a value or list. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase', className)}>{children}</div>
}

export function Fact({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg p-3 ring-1 ring-foreground/10">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={cn('text-sm', mono && 'font-mono text-xs break-all')}>{value}</span>
    </div>
  )
}

export function Chips({ items, icon: Icon, onClick, empty = 'None' }: { items: string[]; icon?: LucideIcon; onClick?: (item: string) => void; empty?: string }) {
  if (!items.length) return <span className="text-xs text-muted-foreground">{empty}</span>
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) =>
        onClick ? (
          <button key={i} type="button" onClick={() => onClick(i)} className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Badge variant="secondary" className="font-mono text-[11px] hover:bg-muted">
              {Icon && <Icon />} {i}
            </Badge>
          </button>
        ) : (
          <Badge key={i} variant="secondary" className="font-mono text-[11px]">
            {Icon && <Icon />} {i}
          </Badge>
        ),
      )}
    </span>
  )
}

export function Arrow() {
  return <span className="text-muted-foreground">→</span>
}

/** A centered "nothing here" message inside a card or panel. */
export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
      <Icon className="size-8 opacity-40" />
      <p className="font-medium text-foreground">{title}</p>
      {children && <div className="max-w-md">{children}</div>}
    </div>
  )
}
