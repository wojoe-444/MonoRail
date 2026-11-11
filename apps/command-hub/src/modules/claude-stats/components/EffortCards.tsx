import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { formatCount, formatPercent, formatUSD } from '@/lib/format'

import { StackedTimeChart } from './StackedTimeChart'
import { costPerCall, effortColor, effortKey, effortName, effortRows, thinkingShare, type EffortRow } from '../effort'
import { seriesOf, timeSeries, type Bucket, type DateWindow, type Metric, type TimePoint } from '../transform'
import type { UsageFact } from '../types'

const dash = <span className="text-muted-foreground">–</span>

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
}

function thinkingCell(r: EffortRow | undefined) {
  const share = thinkingShare(r)
  if (share === undefined) return dash
  return (
    <span title={`${formatCount(r!.thinking)} thinking of ${formatCount(r!.thinkingOutput)} output tokens`}>
      {r!.thinkingEstimated > 0 ? '~' : ''}
      {formatPercent(share)}
    </span>
  )
}

/**
 * Spend or output over time split by effort level, optionally as each
 * period's share (how the mix shifts). The table gives each level's calls,
 * thinking share, cost per call and cost per million output tokens.
 */
export function EffortTimeCard({
  facts,
  window,
  bucket,
  levels,
}: {
  facts: UsageFact[]
  window: DateWindow
  bucket: Bucket
  /** Every level, ranked on the full dataset so filters never repaint one. */
  levels: string[]
}) {
  const [metric, setMetric] = useState<Metric>('cost')
  const [share, setShare] = useState(false)
  const color = (l: string) => effortColor(levels, l)

  const points = useMemo<TimePoint[]>(() => {
    const raw = timeSeries(facts, window, levels.map(effortName), (f) => effortName(effortKey(f)), metric, bucket)
    if (!share) return raw
    return raw.map((p) => ({
      ...p,
      values: Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, p.total ? v / p.total : 0])),
      total: p.total ? 1 : 0,
    }))
  }, [facts, window, levels, metric, bucket, share])

  const rows = useMemo(() => effortRows(facts, effortKey), [facts])
  const present = levels.filter((l) => rows.has(l))
  const total = [...rows.values()].reduce((a, r) => a + r.cost, 0)
  const logged = present.some((l) => l !== 'Not logged')

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>
          {share ? 'Effort mix over time' : `${metric === 'cost' ? 'API-equivalent cost' : 'Output tokens'} by effort over time`}
        </CardTitle>
        <CardDescription>
          Claude Code's effort setting and pi's thinking level, as logged with each response, per {bucket}. Stronger color is more
          effort. Gemini CLI and older logs carry no level.
        </CardDescription>
        <CardAction className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={share} onCheckedChange={setShare} />
            Share
          </label>
          <Segmented
            aria-label="Effort chart metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'outputTokens', label: 'Output' },
              { value: 'cost', label: 'Cost' },
            ]}
          />
        </CardAction>
      </CardHeader>
      {!logged ? (
        <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No effort levels logged in this range.</CardContent>
      ) : (
        <>
          <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
            <Legend items={present.map((l) => ({ key: l, label: effortName(l), color: color(l) }))} />
            <StackedTimeChart
              points={points}
              series={present.map(effortName)}
              metric={metric}
              bucket={bucket}
              colorOf={(name) => color(present.find((l) => effortName(l) === name) ?? name)}
              format={share ? (v) => formatPercent(v) : undefined}
              yMax={share ? 1 : undefined}
            />
          </CardContent>
          <CardContent className="overflow-x-auto px-0 py-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-6 font-medium">Effort</th>
                  <th className="px-4 py-2.5 text-right font-medium">Model calls</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output</th>
                  <th className="px-4 py-2.5 text-right font-medium">Thinking share</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Share of cost</th>
                  <th className="px-4 py-2.5 text-right font-medium">Per call</th>
                  <th className="py-2.5 pr-6 pl-4 text-right font-medium">Per M output</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {present.map((l) => {
                  const r = rows.get(l)!
                  const pc = costPerCall(r)
                  return (
                    <tr key={l} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 pr-4 pl-6 font-medium">
                        <span className="flex items-center gap-2">
                          <Swatch color={color(l)} />
                          {effortName(l)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">{r.calls ? formatCount(r.calls) : dash}</td>
                      <td className="px-4 py-2.5 text-right">{formatCount(r.outputTokens)}</td>
                      <td className="px-4 py-2.5 text-right">{thinkingCell(r)}</td>
                      <td className="px-4 py-2.5 text-right">{formatUSD(r.cost)}</td>
                      <td className="px-4 py-2.5 text-right">{formatPercent(total ? r.cost / total : undefined)}</td>
                      <td className="px-4 py-2.5 text-right">{pc !== undefined ? formatUSD(pc, { compact: pc >= 1 }) : dash}</td>
                      <td className="py-2.5 pr-6 pl-4 text-right">{r.costPerMOutput !== undefined ? formatUSD(r.costPerMOutput) : dash}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </>
      )}
    </Card>
  )
}

/**
 * Thinking tokens as a share of output tokens, one bar per model. pi logs no
 * count, so its share is estimated from the thinking text and marked "~".
 */
export function ThinkingShareCard({ facts, order }: { facts: UsageFact[]; order: string[] }) {
  const rows = useMemo(() => effortRows(facts, (f) => seriesOf(f.model, order)), [facts, order])
  const models = [...new Set([...order, 'Other'])].filter((m) => thinkingShare(rows.get(m)) !== undefined)
  const data = models.map((m) => ({ model: m, share: thinkingShare(rows.get(m))!, est: rows.get(m)!.thinkingEstimated > 0 }))
  const withoutCount = [...new Set([...order, 'Other'])].filter((m) => rows.has(m) && thinkingShare(rows.get(m)) === undefined)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Thinking share of output by model</CardTitle>
        <CardDescription>
          How much of each model's output was reasoning. Claude Code and Gemini CLI log a count; pi's is estimated from the
          thinking text (~4 characters a token) and marked ~.
        </CardDescription>
      </CardHeader>
      {data.length === 0 ? (
        <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No thinking tokens logged in this range.</CardContent>
      ) : (
        <>
          <CardContent className="border-b px-6 py-5">
            <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40 + 32)}>
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} vertical horizontal={false} />
                <XAxis type="number" {...axisProps} axisLine={false} tickFormatter={(v: number) => formatPercent(v)} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="model" {...axisProps} axisLine={{ stroke: 'var(--chart-axis)' }} width={132} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  content={({ active, payload }) => {
                    const d = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
                    if (!d) return null
                    const r = rows.get(d.model)!
                    return (
                      <ChartTooltipContent
                        title={d.model}
                        rows={[
                          { key: 's', label: 'Thinking share', value: `${d.est ? '~' : ''}${formatPercent(d.share, 1)}`, color: colorForSeries(order, d.model) },
                          { key: 't', label: 'Thinking tokens', value: `${d.est ? '~' : ''}${formatCount(r.thinking)}` },
                          { key: 'o', label: 'Output tokens', value: formatCount(r.thinkingOutput) },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="share" maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.model} fill={colorForSeries(order, d.model)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardContent className="overflow-x-auto px-0 py-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-6 font-medium">Model</th>
                  <th className="px-4 py-2.5 text-right font-medium">Thinking</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output</th>
                  <th className="py-2.5 pr-6 pl-4 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.map((d) => {
                  const r = rows.get(d.model)!
                  return (
                    <tr key={d.model} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 pr-4 pl-6 font-medium">
                        <span className="flex items-center gap-2">
                          <Swatch color={colorForSeries(order, d.model)} />
                          {d.model}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {d.est ? '~' : ''}
                        {formatCount(r.thinking)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCount(r.thinkingOutput)}</td>
                      <td className="py-2.5 pr-6 pl-4 text-right">{thinkingCell(r)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {withoutCount.length > 0 && (
              <p className="border-t px-6 py-3 text-xs text-muted-foreground">No thinking logged: {withoutCount.join(', ')}.</p>
            )}
          </CardContent>
        </>
      )}
    </Card>
  )
}

/**
 * Cost per model call (one response, so one turn of the agent loop) or per
 * million output tokens, by model and effort level. Comparing within a model
 * keeps the model's price out of the effect of effort.
 */
export function EffortCostCard({ facts, order, levels }: { facts: UsageFact[]; order: string[]; levels: string[] }) {
  const [per, setPer] = useState<'call' | 'mOutput'>('call')
  const rows = useMemo(() => effortRows(facts, (f) => `${seriesOf(f.model, order)}|${effortKey(f)}`), [facts, order])
  const valueOf = (r: EffortRow | undefined) => (per === 'call' ? costPerCall(r) : r?.costPerMOutput)
  const cell = (m: string, l: string) => rows.get(`${m}|${l}`)

  // Only models with at least one logged level are worth comparing.
  const models = [...new Set([...order, 'Other'])].filter((m) => levels.some((l) => l !== 'Not logged' && valueOf(cell(m, l)) !== undefined))
  const shownLevels = levels.filter((l) => models.some((m) => valueOf(cell(m, l)) !== undefined))
  const data = models.map((m) => ({ model: m, ...Object.fromEntries(shownLevels.map((l) => [l, valueOf(cell(m, l)) ?? null])) }))
  const color = (l: string) => effortColor(levels, l)
  const fmt = (v: number) => formatUSD(v, { compact: per === 'mOutput' || v >= 1 })

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Cost {per === 'call' ? 'per model call' : 'per million output tokens'} by effort</CardTitle>
        <CardDescription>
          Each model's levels side by side, so the model's price doesn't hide the effect of effort. A call is one model
          response, so one turn of the agent loop.
        </CardDescription>
        <CardAction>
          <Segmented
            aria-label="Cost basis"
            value={per}
            onChange={setPer}
            options={[
              { value: 'call', label: 'Per call' },
              { value: 'mOutput', label: 'Per M output' },
            ]}
          />
        </CardAction>
      </CardHeader>
      {models.length === 0 ? (
        <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No effort levels logged in this range.</CardContent>
      ) : (
        <>
          <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
            <Legend items={shownLevels.map((l) => ({ key: l, label: effortName(l), color: color(l) }))} />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={2}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="model" {...axisProps} axisLine={{ stroke: 'var(--chart-axis)' }} interval={0} />
                <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={fmt} />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  content={({ active, label }) => {
                    if (!active) return null
                    const m = label as string
                    const tips = shownLevels
                      .map((l) => ({ l, r: cell(m, l) }))
                      .filter(({ r }) => valueOf(r) !== undefined)
                      .map(({ l, r }) => ({
                        key: l,
                        label: `${effortName(l)} (${per === 'call' ? `${formatCount(r!.calls)} calls` : `${formatCount(r!.outputTokens)} output`})`,
                        value: fmt(valueOf(r)!),
                        color: color(l),
                      }))
                    return <ChartTooltipContent title={m} rows={tips} />
                  }}
                />
                {shownLevels.map((l) => (
                  <Bar key={l} dataKey={l} fill={color(l)} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardContent className="overflow-x-auto px-0 py-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-6 font-medium">Model</th>
                  {shownLevels.map((l) => (
                    <th key={l} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      {effortName(l)}
                    </th>
                  ))}
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {models.map((m) => (
                  <tr key={m} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                    <td className="py-2.5 pr-4 pl-6 font-medium whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Swatch color={colorForSeries(order, m)} />
                        {m}
                      </span>
                    </td>
                    {shownLevels.map((l) => {
                      const r = cell(m, l)
                      const v = valueOf(r)
                      return (
                        <td
                          key={l}
                          className="px-3 py-2.5 text-right"
                          title={r ? `${formatUSD(r.cost)} over ${formatCount(r.calls)} calls, ${formatCount(r.outputTokens)} output tokens` : undefined}
                        >
                          {v !== undefined ? fmt(v) : dash}
                        </td>
                      )
                    })}
                    <td />
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
