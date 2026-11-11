import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatSignedPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

interface StatTileProps {
  label: string
  value: string
  /** Fractional change vs. the previous period, e.g. 0.12 for +12%. */
  delta?: number
  deltaLabel?: string
  /** Whether an increase is good (green) or bad (red). */
  upIsGood?: boolean
  hint?: string
  /** The one hero figure on a view: larger value, room for a trend. */
  hero?: boolean
  trend?: ReactNode
  className?: string
}

/** KPI tile: label, value, optional delta vs. a named period, optional trend. */
export function StatTile({ label, value, delta, deltaLabel, upIsGood = true, hint, hero, trend, className }: StatTileProps) {
  const showDelta = delta !== undefined && Number.isFinite(delta)
  const good = !showDelta || delta === 0 ? undefined : delta > 0 === upIsGood
  return (
    <Card className={cn('gap-0 px-6 py-5', hero && 'bg-gradient-to-br from-card to-primary-soft/60', className)}>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-2 font-semibold tracking-tight', hero ? 'text-5xl' : 'text-[28px] leading-tight')}>
        {value}
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {showDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold',
              good === undefined && 'bg-secondary text-secondary-foreground',
              good === true && 'bg-success-soft text-success-soft-foreground',
              good === false && 'bg-destructive-soft text-destructive-soft-foreground',
            )}
          >
            {delta > 0 ? <ArrowUpRight className="size-3" /> : delta < 0 ? <ArrowDownRight className="size-3" /> : null}
            {formatSignedPercent(delta)}
          </span>
        )}
        {showDelta && deltaLabel && <span>{deltaLabel}</span>}
        {hint && <span>{hint}</span>}
      </div>
      {trend && <div className="mt-3">{trend}</div>}
    </Card>
  )
}
