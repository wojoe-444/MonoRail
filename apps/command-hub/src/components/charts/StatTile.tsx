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
  /** Whether an increase is good (green) or bad (amber). */
  upIsGood?: boolean
  hint?: string
  /** The one hero figure on a view: a larger value. */
  hero?: boolean
  /** Small trend on the right, e.g. a `Sparkline`. */
  trend?: ReactNode
  className?: string
}

/**
 * KPI tile in the Bot Dashboard style: uppercase label, large tabular value,
 * a colored delta line with an arrow, and an optional sparkline on the right.
 */
export function StatTile({ label, value, delta, deltaLabel, upIsGood = true, hint, hero, trend, className }: StatTileProps) {
  const showDelta = delta !== undefined && Number.isFinite(delta)
  const good = !showDelta || delta === 0 ? undefined : delta > 0 === upIsGood
  return (
    <Card className={cn('gap-0 px-4 py-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
          <span className={cn('font-semibold tracking-tight tabular-nums', hero ? 'text-4xl' : 'text-3xl')}>{value}</span>
          <span className="flex min-h-4 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {showDelta && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  good === true && 'text-success',
                  good === false && 'text-warning-soft-foreground',
                )}
              >
                {delta > 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : delta < 0 ? (
                  <ArrowDownRight className="size-3.5" />
                ) : null}
                {formatSignedPercent(delta)}
              </span>
            )}
            {showDelta && deltaLabel && <span>{deltaLabel}</span>}
            {hint && <span>{hint}</span>}
          </span>
        </div>
        {trend}
      </div>
    </Card>
  )
}
