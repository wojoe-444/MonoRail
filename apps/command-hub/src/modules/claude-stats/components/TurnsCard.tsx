import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { formatCount } from '@/lib/format'

import { MIN_TURN_PASSES, turnDash, turnLines, type TurnLine } from '../context'
import type { ScanTurnRow } from '../types'

function LineKey({ line, order }: { line: TurnLine; order: string[] }) {
  return (
    <svg aria-hidden width="20" height="8" className="shrink-0">
      <line x1="1" y1="4" x2="19" y2="4" stroke={colorForSeries(order, line.series)} strokeWidth="2" strokeDasharray={turnDash(line)} strokeLinecap="round" />
    </svg>
  )
}

/**
 * C2-C4: average prompt size by turn, one smooth line per model and harness.
 * Turn 1 is a session's first pass, or the first pass after a compaction.
 * Optionally split by start condition. A turn range slider narrows the x-axis.
 * Follows the date range and source filter, not the per-model chart toggles.
 */
export function TurnsCard({ turns, order }: { turns: ScanTurnRow[]; order: string[] }) {
  const [split, setSplit] = useState(false)
  const { lines, maxTurn } = useMemo(() => turnLines(turns, order, split), [turns, order, split])
  const [range, setRange] = useState<[number, number] | null>(null)
  const [lo, hi] = range ? [Math.min(range[0], maxTurn), Math.min(range[1], maxTurn)] : [1, maxTurn]
  const all = lo === 1 && hi === maxTurn

  const inRange = (l: TurnLine) => [...l.points.keys()].some((t) => t >= lo && t <= hi)
  const shown = lines.filter(inRange)
  const notPlotted = lines.filter((l) => !inRange(l))

  const data = useMemo(() => {
    const rows = []
    for (let t = lo; t <= hi; t++) {
      const row: Record<string, number | null> & { turn: number } = { turn: t }
      for (const l of shown) row[l.key] = l.points.get(t) ?? null
      rows.push(row)
    }
    return rows
  }, [lo, hi, shown])

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Average prompt size by turn</CardTitle>
        <CardDescription>
          How the prompt grows over a conversation. Turn 1 is a session's first pass through the model, or the first
          pass after a compaction. A turn needs at least {MIN_TURN_PASSES} passes to be plotted. Claude Code lines are
          solid, other harnesses dashed.
        </CardDescription>
      </CardHeader>
      {lines.length === 0 ? (
        <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No main-thread turns in this range.</CardContent>
      ) : (
        <>
          <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex min-w-64 flex-1 items-center gap-3 text-sm text-muted-foreground">
                <span className="whitespace-nowrap">
                  Turns <span className="font-medium text-foreground tabular-nums">{lo}–{hi}</span>
                </span>
                <Slider
                  className="max-w-80"
                  min={1}
                  max={Math.max(maxTurn, 2)}
                  step={1}
                  minStepsBetweenThumbs={1}
                  value={[lo, hi]}
                  onValueChange={(v) => setRange([v[0], v[1]])}
                  thumbLabels={['First turn shown', 'Last turn shown']}
                  disabled={maxTurn < 2}
                />
                <Button variant="outline" size="sm" disabled={all} onClick={() => setRange(null)}>
                  Show all turns
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={split} onCheckedChange={setSplit} />
                Split by start condition
              </label>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {shown.map((l) => (
                <span key={l.key} className="flex items-center gap-1.5">
                  <LineKey line={l} order={order} />
                  {l.label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="turn" type="number" domain={[lo, hi]} allowDecimals={false} {...axisProps} axisLine={{ stroke: 'var(--chart-axis)' }} />
                <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={formatCount} />
                <Tooltip
                  cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
                  content={({ active, label }) => {
                    if (!active) return null
                    const t = label as number
                    const rows = shown
                      .filter((l) => l.points.has(t))
                      .map((l) => ({
                        key: l.key,
                        label: `${l.label} (${formatCount(l.counts.get(t) ?? 0)} passes)`,
                        value: formatCount(l.points.get(t)!),
                        color: colorForSeries(order, l.series),
                      }))
                    return <ChartTooltipContent title={`Turn ${t}`} rows={rows.length ? rows : [{ key: 'none', label: 'No plotted line', value: '–' }]} />
                  }}
                />
                {shown.map((l) => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    stroke={colorForSeries(order, l.series)}
                    strokeWidth={2}
                    strokeDasharray={turnDash(l)}
                    dot={false}
                    activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {notPlotted.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Not plotted (no turn with {MIN_TURN_PASSES}+ passes{all ? '' : ' in this turn range'}):{' '}
                {notPlotted.map((l) => l.label).join(', ')}.
              </p>
            )}
          </CardContent>
          <CardContent className="overflow-x-auto px-0 py-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 pr-4 pl-6 font-medium">Line</th>
                  <th className="px-4 py-2.5 text-right font-medium">Passes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Turns plotted</th>
                  <th className="px-4 py-2.5 text-right font-medium">Turn {lo}</th>
                  <th className="py-2.5 pr-6 pl-4 text-right font-medium">Turn {hi}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {lines.map((l) => {
                  const plotted = [...l.points.keys()].filter((t) => t >= lo && t <= hi).length
                  const at = (t: number) => (l.points.has(t) ? formatCount(l.points.get(t)!) : '–')
                  return (
                    <tr key={l.key} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 pr-4 pl-6 font-medium">
                        <span className="flex items-center gap-2">
                          <LineKey line={l} order={order} />
                          {l.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatCount(l.passes)}</td>
                      <td className="px-4 py-2.5 text-right">{plotted}</td>
                      <td className="px-4 py-2.5 text-right">{at(lo)}</td>
                      <td className="py-2.5 pr-6 pl-4 text-right">{at(hi)}</td>
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
