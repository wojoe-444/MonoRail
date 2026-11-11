import { Legend } from '@/components/charts/Legend'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

import { modelFamily, SOURCE_LABELS } from '../facts'
import type { UsageFact } from '../types'

const OUTPUT_COLOR = 'var(--series-1)'
const COST_COLOR = 'var(--series-2)'

/**
 * S3: share of output against share of cost, per model family, as a pair of
 * bars. Both bars are shares of the same window totals, so pairs compare
 * directly. A family used through a second source is its own, marked pair.
 */
export function FamilyShareCard({ facts }: { facts: UsageFact[] }) {
  const totalOut = facts.reduce((a, f) => a + f.outputTokens, 0)
  const totalCost = facts.reduce((a, f) => a + f.cost, 0)
  const map = new Map<string, { family: string; source: UsageFact['source']; output: number; cost: number }>()
  for (const f of facts) {
    const family = modelFamily(f.model)
    const k = `${family}|${f.source}`
    const row = map.get(k) ?? { family, source: f.source, output: 0, cost: 0 }
    row.output += f.outputTokens
    row.cost += f.cost
    map.set(k, row)
  }
  const rows = [...map.values()]
    .map((r) => ({ ...r, outShare: totalOut ? r.output / totalOut : 0, costShare: totalCost ? r.cost / totalCost : 0 }))
    .sort((a, b) => b.costShare - a.costShare)
  const max = Math.max(0.0001, ...rows.flatMap((r) => [r.outShare, r.costShare]))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Share of output vs. share of cost</CardTitle>
        <CardDescription>
          By model family. A family whose cost bar is much longer than its output bar costs more than its share of the
          work.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        <Legend
          items={[
            { key: 'out', label: 'Share of output tokens', color: OUTPUT_COLOR },
            { key: 'cost', label: 'Share of API-equivalent cost', color: COST_COLOR },
          ]}
        />
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No usage in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-48 pb-2 font-medium">Family</th>
                <th className="pb-2 font-medium">Output · cost</th>
                <th className="w-20 pb-2 text-right font-medium">Output</th>
                <th className="w-20 pb-2 text-right font-medium">Cost</th>
                <th className="w-24 pb-2 text-right font-medium">Cost ÷ output</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => {
                const ratio = r.outShare ? r.costShare / r.outShare : undefined
                return (
                  <tr key={`${r.family}|${r.source}`} className="border-t">
                    <td className="py-2.5 pr-4 font-medium">
                      {r.family}
                      {r.source !== 'claude-code' && (
                        <span className="ml-2 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          {SOURCE_LABELS[r.source]}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col gap-1" aria-label={`Output ${formatPercent(r.outShare)}, cost ${formatPercent(r.costShare)}`}>
                        <div className="h-2.5 rounded-r-[4px]" style={{ width: `${(r.outShare / max) * 100}%`, background: OUTPUT_COLOR, minWidth: r.outShare ? 2 : 0 }} />
                        <div className="h-2.5 rounded-r-[4px]" style={{ width: `${(r.costShare / max) * 100}%`, background: COST_COLOR, minWidth: r.costShare ? 2 : 0 }} />
                      </div>
                    </td>
                    <td className="py-2.5 text-right">{formatPercent(r.outShare)}</td>
                    <td className="py-2.5 text-right">{formatPercent(r.costShare)}</td>
                    <td className={cn('py-2.5 text-right font-medium', ratio !== undefined && ratio > 1.5 && 'text-warning-soft-foreground')}>
                      {ratio === undefined ? '–' : `${ratio.toFixed(1)}×`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
