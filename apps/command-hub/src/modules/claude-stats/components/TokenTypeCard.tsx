import { Legend } from '@/components/charts/Legend'
import { SERIES_COLORS } from '@/components/charts/palette'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercent, formatUSD } from '@/lib/format'

import { addDays, perM, weekStart, type Bucket, type TimePoint } from '../transform'
import type { UsageFact } from '../types'
import { StackedTimeChart } from './StackedTimeChart'

const TOKEN_TYPES = [
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'cacheWrite', label: 'Cache write' },
  { key: 'cacheRead', label: 'Cache read' },
] as const

const ORDER = TOKEN_TYPES.map((t) => t.label)

function partsSeries(facts: UsageFact[], w: { start: string; end: string }, bucket: Bucket): TimePoint[] {
  const keyOf = (iso: string) => (bucket === 'week' ? weekStart(iso) : iso)
  const points = new Map<string, TimePoint>()
  for (let d = keyOf(w.start); d <= w.end; d = addDays(d, bucket === 'week' ? 7 : 1)) {
    points.set(d, { date: d, values: Object.fromEntries(ORDER.map((s) => [s, 0])), total: 0, outputTokens: 0, cost: 0, costPerMOutput: undefined })
  }
  for (const f of facts) {
    const p = points.get(keyOf(f.date))
    if (!p) continue
    const parts = f.parts ?? { input: 0, output: f.cost, cacheWrite: 0, cacheRead: 0 }
    for (const t of TOKEN_TYPES) p.values[t.label] += parts[t.key]
    p.total += f.cost
    p.cost += f.cost
    p.outputTokens += f.outputTokens
  }
  for (const p of points.values()) p.costPerMOutput = perM(p.cost, p.outputTokens)
  return [...points.values()]
}

/**
 * S2: each day's API-equivalent cost split into input, output, cache write and
 * cache read. A cost the tool logged per token type is used as logged; any
 * other split is estimated from the token mix at list-price ratios and says so.
 */
export function TokenTypeCard({ facts, window: w, bucket }: { facts: UsageFact[]; window: { start: string; end: string }; bucket: Bucket }) {
  const points = partsSeries(facts, w, bucket)
  const totals = TOKEN_TYPES.map((t) => {
    let logged = 0
    let estimated = 0
    for (const f of facts) {
      const v = f.parts?.[t.key] ?? (t.key === 'output' ? f.cost : 0)
      if (f.partsEstimated === false) logged += v
      else estimated += v
    }
    return { ...t, logged, estimated, total: logged + estimated }
  })
  const grand = totals.reduce((a, t) => a + t.total, 0)
  const anyEstimated = totals.some((t) => t.estimated > 0)
  const anyLogged = totals.some((t) => t.logged > 0)
  const colors = Object.fromEntries(ORDER.map((s, i) => [s, SERIES_COLORS[i]]))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>API-equivalent cost by token type</CardTitle>
        <CardDescription>
          Each {bucket}'s cost split into input, output, cache writes and cache reads.
          {anyLogged && ' Costs a tool logged per token type are shown as logged.'}
          {anyEstimated && ' Other splits are estimated from the token mix at list-price ratios; the totals are unchanged.'}
        </CardDescription>
        {anyEstimated && (
          <CardAction>
            <Badge variant="warning">{anyLogged ? 'Partly estimated' : 'Estimated split'}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
        <Legend items={ORDER.map((s) => ({ key: s, color: colors[s] }))} />
        <StackedTimeChart points={points} series={ORDER} metric="cost" bucket={bucket} colorOf={(s) => colors[s]} />
      </CardContent>
      <CardContent className="overflow-x-auto px-0 py-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2.5 pr-4 pl-6 font-medium">Token type</th>
              <th className="px-4 py-2.5 text-right font-medium">API cost</th>
              <th className="px-4 py-2.5 text-right font-medium">Share</th>
              <th className="px-4 py-2.5 text-right font-medium">As logged</th>
              <th className="py-2.5 pr-6 pl-4 text-right font-medium">Estimated</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {totals.map((t) => (
              <tr key={t.key} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="py-2.5 pr-4 pl-6 font-medium">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colors[t.label] }} />
                    {t.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{formatUSD(t.total)}</td>
                <td className="px-4 py-2.5 text-right">{formatPercent(grand ? t.total / grand : undefined)}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{t.logged ? formatUSD(t.logged) : '–'}</td>
                <td className="py-2.5 pr-6 pl-4 text-right text-muted-foreground">
                  {t.estimated ? `${formatUSD(t.estimated)} (estimate)` : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
