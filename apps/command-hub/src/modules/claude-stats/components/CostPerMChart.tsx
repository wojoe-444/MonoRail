import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { axisProps, gridProps } from '@/components/charts/palette'
import { formatCount, formatShortDate, formatUSD } from '@/lib/format'

import type { Bucket, TimePoint } from '../transform'

interface Props {
  points: TimePoint[]
  bucket: Bucket
  /** Period average, drawn as a reference line. */
  average?: number
  height?: number
}

/** Single-series line of API-equivalent $ per million output tokens. Gaps where there was no output. */
export function CostPerMChart({ points, bucket, average, height = 260 }: Props) {
  const data = points.map((p) => ({ date: p.date, value: p.costPerMOutput ?? null, p }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="date"
          {...axisProps}
          tickFormatter={formatShortDate}
          minTickGap={24}
          axisLine={{ stroke: 'var(--chart-axis)' }}
        />
        <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={(v: number) => formatUSD(v)} />
        {average !== undefined && (
          <ReferenceLine
            y={average}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            strokeWidth={1}
            label={{
              value: `Avg ${formatUSD(average)}`,
              position: 'insideBottomLeft',
              fill: 'var(--muted-foreground)',
              fontSize: 11,
            }}
          />
        )}
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload?.p as TimePoint | undefined) : undefined
            if (!p) return null
            return (
              <ChartTooltipContent
                title={bucket === 'week' ? `Week of ${formatShortDate(p.date)}` : formatShortDate(p.date)}
                rows={[
                  {
                    key: 'v',
                    label: 'per M output tokens',
                    value: formatUSD(p.costPerMOutput),
                    color: 'var(--series-1)',
                  },
                ]}
                footer={
                  <>
                    {formatUSD(p.cost)} for {formatCount(p.outputTokens)} output tokens
                  </>
                }
              />
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--card)', strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
