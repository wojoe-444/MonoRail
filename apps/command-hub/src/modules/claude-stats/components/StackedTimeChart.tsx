import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { formatCount, formatShortDate, formatUSD } from '@/lib/format'

import type { Bucket, Metric, TimePoint } from '../transform'

interface Props {
  points: TimePoint[]
  series: string[]
  metric: Metric
  bucket: Bucket
  /** Color per series; defaults to the fixed series palette in `series` order. */
  colorOf?: (series: string) => string
  /** Value formatter; defaults to dollars for cost and counts otherwise. */
  format?: (v: number) => string
  /** Fixed top of the y-axis, e.g. 1 for shares. */
  yMax?: number
}

interface BarShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: TimePoint
}

/**
 * Stacked columns by series. Only the top visible segment of each column gets
 * the 4px rounded data-end; segments are separated by a 2px surface gap.
 */
export function StackedTimeChart({ points, series, metric, bucket, colorOf = (s) => colorForSeries(series, s), format, yMax }: Props) {
  const fmt = format ?? (metric === 'cost' ? (v: number) => formatUSD(v, { compact: true }) : formatCount)
  const data = points.map((p) => ({ ...p, ...Object.fromEntries(series.map((s) => [`v:${s}`, p.values[s] ?? 0])) }))

  const topSeries = (p: TimePoint) => {
    for (let i = series.length - 1; i >= 0; i--) if ((p.values[series[i]] ?? 0) > 0) return series[i]
    return undefined
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="date"
          {...axisProps}
          tickFormatter={formatShortDate}
          minTickGap={24}
          axisLine={{ stroke: 'var(--chart-axis)' }}
        />
        <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={fmt} domain={[0, yMax ?? 'auto']} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as TimePoint | undefined) : undefined
            if (!p) return null
            const rows = [...series]
              .reverse()
              .filter((s) => (p.values[s] ?? 0) > 0)
              .map((s) => ({ key: s, label: s, value: fmt(p.values[s]), color: colorOf(s) }))
            return (
              <ChartTooltipContent
                title={bucket === 'week' ? `Week of ${formatShortDate(p.date)}` : formatShortDate(p.date)}
                rows={rows.length ? rows : [{ key: 'none', label: 'No usage', value: fmt(0) }]}
                footer={
                  <>
                    Total <span className="font-semibold text-foreground">{fmt(p.total)}</span>
                    {p.costPerMOutput !== undefined && <> · {formatUSD(p.costPerMOutput)} / M output</>}
                  </>
                }
              />
            )
          }}
        />
        {series.map((s) => (
          <Bar
            key={s}
            dataKey={`v:${s}`}
            name={s}
            stackId="a"
            fill={colorOf(s)}
            maxBarSize={24}
            isAnimationActive={false}
            shape={(props: BarShapeProps) => {
              const { x = 0, y = 0, width = 0, height = 0, fill, payload } = props
              if (height <= 0 || width <= 0) return <g />
              const top = payload && topSeries(payload) === s
              // 2px surface gap: trim the bottom of every segment except the baseline one.
              const gap = s === series.find((k) => (payload?.values[k] ?? 0) > 0) ? 0 : 2
              const h = Math.max(height - gap, 1)
              const r = top ? Math.min(4, h, width / 2) : 0
              const path = r
                ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`
                : `M${x},${y} H${x + width} V${y + h} H${x} Z`
              return <path d={path} fill={fill} />
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
