import { useState } from 'react'
import { AlertTriangle, Ban, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

import { allowOneMoreTurn, formatLimit, formatMoney, resetsLabel, type LiveSpending, type SpendingStatus } from './spending'

/** The meter that sets the state (or today's, when nothing is near a limit). */
function lead(s: LiveSpending) {
  const m = s.period === 'month' ? s.monthly : s.daily.limit != null ? s.daily : s.monthly
  return { m, label: m === s.monthly ? s.monthLabel : 'Today', ofWhat: m === s.monthly ? "this month's" : "today's" }
}

/**
 * Chat's status bar chip while the spending limit is on: "Today $21.40 / $25".
 * Nothing when it is off.
 */
export function SpendingChip({ status }: { status?: SpendingStatus }) {
  if (!status || status.state === 'off') return null
  if (status.state === 'damaged')
    return (
      <button type="button" onClick={() => navigate('/settings')} className="rounded-full bg-destructive-soft px-2 py-0.5 text-destructive-soft-foreground">
        Spending limit: check Settings
      </button>
    )
  const { m, label } = lead(status)
  if (m.limit == null) return null
  return (
    <button
      type="button"
      onClick={() => navigate('/settings')}
      title="Spending limit for turns MonoRail runs. Click to change it in Settings."
      className={cn(
        'rounded-full px-2 py-0.5 font-mono tabular-nums',
        m.state === 'reached' ? 'bg-destructive-soft text-destructive-soft-foreground' : m.state === 'warn' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-muted',
      )}
    >
      {label} {formatMoney(m.spent)} / {formatLimit(m.limit)}
    </button>
  )
}

/** Above Chat's composer: a warning near the limit, or the paused notice at it. */
export function SpendingBanner({ status }: { status?: SpendingStatus }) {
  const [busy, setBusy] = useState(false)
  if (!status || status.state === 'off' || status.state === 'ok' || status.state === 'damaged') return null
  const { m, ofWhat } = lead(status)
  if (m.limit == null) return null
  const amounts = `(${formatMoney(m.spent)} of ${formatMoney(m.limit)})`

  if (status.state === 'warn')
    return (
      <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          <b className="font-semibold">{Math.floor(m.pct ?? 0)}% of {ofWhat} spending limit used</b> {amounts}.
        </span>
      </div>
    )

  const paused = status.blocked
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2 text-sm', paused ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-warning-soft text-warning-soft-foreground')}>
      {paused ? <Ban className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{ofWhat[0].toUpperCase() + ofWhat.slice(1)} spending limit is reached</b> {amounts}.{' '}
        {paused ? `New turns are paused until the limit resets ${resetsLabel(status)}.` : status.allowOnce ? 'One more turn is allowed.' : 'Turns still run because it is set to only warn.'}
      </span>
      {paused && (
        <span className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7" onClick={() => navigate('/settings')}>
            Change limit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              allowOneMoreTurn().finally(() => setBusy(false))
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Allow one more turn
          </Button>
        </span>
      )}
    </div>
  )
}
