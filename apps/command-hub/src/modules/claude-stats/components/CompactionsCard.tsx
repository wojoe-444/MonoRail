import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCount } from '@/lib/format'

import { compactionStats, compactionStepLabel, UNKNOWN } from '../context'
import type { ScanCompaction } from '../types'

const UNKNOWN_COLOR = 'var(--muted-foreground)'

/**
 * C1: compactions grouped by the context size they compacted from, one bar
 * per model (the model running just before the compaction). A compaction
 * with no earlier model is shown as unknown, never dropped.
 */
export function CompactionsCard({ compactions, order }: { compactions: ScanCompaction[]; order: string[] }) {
  const stats = compactionStats(compactions, order)
  const colorOf = (s: string) => (s === UNKNOWN ? UNKNOWN_COLOR : colorForSeries(order, s))
  const data = stats.bars.map((b) => ({ step: b.step, ...b.values }))

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Compactions by context size</CardTitle>
        <CardDescription>
          {formatCount(stats.total)} compactions, grouped by the prompt size they compacted from and the model running
          just before.
        </CardDescription>
      </CardHeader>
      {stats.total === 0 ? (
        <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No compactions in this range.</CardContent>
      ) : (
        <>
          <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
            {stats.series.length > 1 && <Legend items={stats.series.map((s) => ({ key: s, color: colorOf(s) }))} />}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="step" {...axisProps} tickFormatter={(s: number) => compactionStepLabel(s)} axisLine={{ stroke: 'var(--chart-axis)' }} />
                <YAxis {...axisProps} axisLine={false} width={40} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  content={({ active, label }) => {
                    if (!active) return null
                    const b = stats.bars.find((x) => x.step === label)
                    if (!b) return null
                    return (
                      <ChartTooltipContent
                        title={`Compacted from ${compactionStepLabel(b.step)}`}
                        rows={stats.series
                          .filter((s) => b.values[s] > 0)
                          .map((s) => ({ key: s, label: s, value: formatCount(b.values[s]), color: colorOf(s) }))}
                      />
                    )
                  }}
                />
                {stats.series.map((s) => (
                  <Bar key={s} dataKey={s} fill={colorOf(s)} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardContent className="overflow-x-auto px-0 py-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-6 font-medium">Model before compaction</th>
                  <th className="px-4 py-2.5 text-right font-medium">Compactions</th>
                  <th className="px-4 py-2.5 text-right font-medium">Manual</th>
                  <th className="py-2.5 pr-6 pl-4 text-right font-medium">Median context</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {stats.table.map((r) => (
                  <tr key={r.series} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 pr-4 pl-6 font-medium">
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colorOf(r.series) }} />
                        {r.series}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCount(r.total)}</td>
                    <td className="px-4 py-2.5 text-right">{formatCount(r.manual)}</td>
                    <td className="py-2.5 pr-6 pl-4 text-right">{r.medianContext === undefined ? '–' : formatCount(r.medianContext)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </>
      )}
    </Card>
  )
}
