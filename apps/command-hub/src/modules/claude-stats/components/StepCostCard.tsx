import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { formatCount, formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import { costByStep, indexTo100, MIN_STEP_OUTPUT } from '../context'
import { stepLabel } from '../pricing'
import type { UsageFact } from '../types'

/**
 * P2 + P3: cost per million output tokens by context step (50K bands of
 * prompt size), one line per model. Steps with too little output are skipped
 * so a handful of requests can't swing a line. Controls: per-model show/hide,
 * square-root scale, and "average each model to 100".
 */
export function StepCostCard({ facts, order }: { facts: UsageFact[]; order: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [sqrt, setSqrt] = useState(false)
  const [indexed, setIndexed] = useState(false)

  const { steps, cells } = useMemo(() => costByStep(facts, order), [facts, order])
  const plotted = cells.filter((c) => c.perM !== undefined)
  const present = order.filter((s) => plotted.some((c) => c.series === s))
  const visible = present.filter((s) => !hidden.has(s))
  const means = useMemo(() => indexTo100(cells), [cells])
  const valueOf = (series: string, perM: number) => (indexed ? (perM / means.get(series)!) * 100 : perM)
  const fmt = (v: number) => (indexed ? v.toFixed(0) : formatUSD(v))

  const data = steps.map((step) => {
    const row: Record<string, number | null> & { step: number } = { step }
    for (const s of present) {
      const c = cells.find((x) => x.series === s && x.step === step)
      row[s] = c?.perM !== undefined ? valueOf(s, c.perM) : null
    }
    return row
  })

  const toggle = (s: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Cost per million output tokens by prompt size</CardTitle>
        <CardDescription>
          Prompt size is input plus cache writes plus cache reads, grouped in 50K steps. Steps with under{' '}
          {formatCount(MIN_STEP_OUTPUT)} output tokens are left out.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
        {present.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No prompt-size step has {formatCount(MIN_STEP_OUTPUT)} output tokens in this range yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Models shown">
                {present.map((s) => {
                  const on = !hidden.has(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(s)}
                      className={cn(
                        'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        on ? 'bg-card text-foreground' : 'bg-muted text-muted-foreground line-through',
                      )}
                    >
                      <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: on ? colorForSeries(order, s) : 'currentColor' }} />
                      {s}
                    </button>
                  )
                })}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <label className="flex items-center gap-2">
                  <Switch checked={sqrt} onCheckedChange={setSqrt} />
                  Square-root scale
                </label>
                <label className="flex items-center gap-2">
                  <Switch checked={indexed} onCheckedChange={setIndexed} />
                  Average each model to 100
                </label>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="step" {...axisProps} tickFormatter={(s: number) => stepLabel(s)} axisLine={{ stroke: 'var(--chart-axis)' }} minTickGap={16} />
                <YAxis {...axisProps} axisLine={false} width={56} scale={sqrt ? 'sqrt' : 'auto'} domain={[0, 'auto']} tickFormatter={fmt} />
                {indexed && <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1} />}
                <Tooltip
                  cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const step = label as number
                    return (
                      <ChartTooltipContent
                        title={`Prompt ${stepLabel(step)}`}
                        rows={visible
                          .map((s) => cells.find((c) => c.series === s && c.step === step))
                          .filter((c) => c?.perM !== undefined)
                          .map((c) => ({ key: c!.series, label: c!.series, value: fmt(valueOf(c!.series, c!.perM!)), color: colorForSeries(order, c!.series) }))}
                        footer={indexed ? '100 = the model’s average over its plotted steps' : 'API-equivalent $ per M output tokens'}
                      />
                    )
                  }}
                />
                {visible.map((s) => (
                  <Line
                    key={s}
                    type="monotone"
                    dataKey={s}
                    stroke={colorForSeries(order, s)}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: colorForSeries(order, s), strokeWidth: 0 }}
                    activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
      {present.length > 0 && (
        <CardContent className="overflow-x-auto px-0 py-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2.5 pr-4 pl-6 font-medium">Model</th>
                {steps.map((s) => (
                  <th key={s} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                    {stepLabel(s)}
                  </th>
                ))}
                <th className="w-6" />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {visible.map((s) => (
                <tr key={s} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 pr-4 pl-6 font-medium whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colorForSeries(order, s) }} />
                      {s}
                    </span>
                  </td>
                  {steps.map((step) => {
                    const c = cells.find((x) => x.series === s && x.step === step)
                    return (
                      <td
                        key={step}
                        className="px-3 py-2.5 text-right"
                        title={c ? `${formatUSD(c.cost)} for ${formatCount(c.output)} output tokens` : undefined}
                      >
                        {c?.perM !== undefined ? fmt(valueOf(s, c.perM)) : <span className="text-muted-foreground">–</span>}
                      </td>
                    )
                  })}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      )}
    </Card>
  )
}
