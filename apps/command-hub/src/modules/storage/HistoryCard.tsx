import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, colorForSeries, gridProps } from '@/components/charts/palette'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { formatBytes } from '@/lib/format'

import type { DriveGoal, StorageHistory } from './types'

type Metric = 'drives' | 'folders'
type View = 'chart' | 'table'

/** Folders drawn as lines: the largest ones in the newest scan. The table lists them all. */
const MAX_LINES = 6

const dateTime = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

interface Series {
  key: string
  label: string
}

interface Row {
  t: number
  values: Record<string, number | undefined>
  truncated?: Record<string, boolean>
}

/**
 * Storage over time, from the saved history: free space per drive (every scan
 * plus a background sample every few hours) or folder sizes (scans only).
 */
export function HistoryCard({ history, error, goals = {} }: { history?: StorageHistory; error?: Error; goals?: Record<string, DriveGoal> }) {
  const [metric, setMetric] = useState<Metric>('drives')
  const [view, setView] = useState<View>('chart')
  /** One drive at a time, so a small drive and its goal are not squashed by a big one. */
  const [driveFilter, setDriveFilter] = useState('all')
  const snapshots = useMemo(() => history?.snapshots ?? [], [history])

  const { series, rows, empty } = useMemo(() => {
    if (metric === 'drives') {
      // Drives ranked once by size, so a drive keeps its color.
      const sizes = new Map<string, number>()
      for (const s of snapshots) for (const d of s.drives) sizes.set(d.id, Math.max(sizes.get(d.id) ?? 0, d.total))
      const series: Series[] = [...sizes.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([id]) => ({ key: id, label: goals[id] ? `${id} free (goal ${formatBytes(goals[id].freeBytes)})` : `${id} free` }))
      const rows: Row[] = snapshots.map((s) => ({ t: Date.parse(s.takenAt), values: Object.fromEntries(s.drives.map((d) => [d.id, d.free])) }))
      return { series, rows, empty: rows.length === 0 }
    }
    const scans = snapshots.filter((s) => s.kind === 'scan')
    const last = scans.at(-1)
    const labels = new Map<string, string>()
    for (const s of scans) for (const l of s.locations ?? []) labels.set(l.id, l.label)
    // Ranked on the newest scan (the full dataset), never repainted by the view.
    const ranked = [...(last?.locations ?? [])].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).map((l) => l.id)
    const all = [...ranked, ...[...labels.keys()].filter((id) => !ranked.includes(id))]
    const series: Series[] = all.map((id) => ({ key: id, label: labels.get(id) ?? id }))
    const rows: Row[] = scans.map((s) => ({
      t: Date.parse(s.takenAt),
      values: Object.fromEntries((s.locations ?? []).map((l) => [l.id, l.bytes])),
      truncated: Object.fromEntries((s.locations ?? []).map((l) => [l.id, l.truncated])),
    }))
    return { series, rows, empty: rows.length === 0 }
  }, [metric, snapshots, goals])

  const allLines = metric === 'folders' ? series.slice(0, MAX_LINES) : series.slice(0, 6)
  // Colors come from the full list, so picking one drive never repaints it.
  const order = allLines.map((s) => s.key)
  const shownDrive = metric === 'drives' && allLines.some((s) => s.key === driveFilter) ? driveFilter : 'all'
  const lines = shownDrive === 'all' ? allLines : allLines.filter((s) => s.key === shownDrive)
  const scanCount = snapshots.filter((s) => s.kind === 'scan').length
  const first = snapshots[0]
  // Goals are drawn as dashed lines in their drive's color, on the drive chart only.
  const goalLines = metric === 'drives' ? lines.filter((s) => goals[s.key]).map((s) => ({ key: s.key, bytes: goals[s.key].freeBytes })) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Over time</CardTitle>
        <CardDescription>
          {metric === 'drives'
            ? `Free space per drive, saved with every scan and sampled every 6 hours while MonoRail runs.${goalLines.length ? ' Dashed lines are your free-space goals.' : ''}`
            : `Folder sizes from each scan you ran${series.length > MAX_LINES ? ` (the ${MAX_LINES} largest drawn; the table has all)` : ''}.`}
          {first && ` Since ${dateOnly.format(new Date(first.takenAt))}, ${scanCount} ${scanCount === 1 ? 'scan' : 'scans'}.`}
        </CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          {metric === 'drives' && view === 'chart' && allLines.length > 1 && (
            <Segmented
              aria-label="Drive"
              value={shownDrive}
              onChange={setDriveFilter}
              options={[{ value: 'all', label: 'All' }, ...allLines.map((s) => ({ value: s.key, label: s.key }))]}
            />
          )}
          <Segmented
            aria-label="What to show"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'drives', label: 'Drive space' },
              { value: 'folders', label: 'Folders' },
            ]}
          />
          <Segmented
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
          />
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4">
        {!history ? (
          <p className="text-sm text-muted-foreground">{error ? error.message : 'Loading…'}</p>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">
            {metric === 'drives'
              ? 'Nothing saved yet. History starts with your first scan, and drive space is also sampled every 6 hours while MonoRail runs.'
              : 'Nothing saved yet. Each scan you run is kept here, so you can see which folders grow.'}
          </p>
        ) : view === 'chart' ? (
          <>
            {lines.length > 1 && <Legend shape="line" items={lines.map((s) => ({ key: s.key, label: s.label, color: colorForSeries(order, s.key) }))} />}
            <HistoryChart rows={rows} lines={lines} order={order} goals={goalLines} />
          </>
        ) : (
          <HistoryTable rows={rows} series={series} />
        )}
      </CardContent>
    </Card>
  )
}

function HistoryChart({ rows, lines, order, goals }: { rows: Row[]; lines: Series[]; order: string[]; goals: { key: string; bytes: number }[] }) {
  const data = rows.map((r) => ({ t: r.t, ...Object.fromEntries(lines.map((s) => [s.key, r.values[s.key] ?? null])) }))
  const fewPoints = rows.length <= 12
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          {...axisProps}
          tickFormatter={(t: number) => dateOnly.format(new Date(t))}
          minTickGap={32}
          axisLine={{ stroke: 'var(--chart-axis)' }}
        />
        <YAxis {...axisProps} axisLine={false} width={64} tickFormatter={(v: number) => formatBytes(v)} />
        <Tooltip
          cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <ChartTooltipContent
                title={dateTime.format(new Date(Number(label)))}
                rows={lines
                  .filter((s) => typeof payload[0]?.payload?.[s.key] === 'number')
                  .map((s) => ({ key: s.key, label: s.label, value: formatBytes(payload[0].payload[s.key]), color: colorForSeries(order, s.key) }))}
              />
            )
          }}
        />
        {goals.map((g) => (
          <ReferenceLine
            key={`goal-${g.key}`}
            y={g.bytes}
            ifOverflow="extendDomain"
            stroke={colorForSeries(order, g.key)}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{ value: `${g.key} goal`, position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 11 }}
          />
        ))}
        {lines.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={colorForSeries(order, s.key)}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={fewPoints ? { r: 3, fill: colorForSeries(order, s.key), strokeWidth: 0 } : false}
            activeDot={{ r: 4, fill: colorForSeries(order, s.key), stroke: 'var(--card)', strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function HistoryTable({ rows, series }: { rows: Row[]; series: Series[] }) {
  const newestFirst = [...rows].reverse().slice(0, 200)
  return (
    <div className="max-h-96 overflow-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium whitespace-nowrap">Taken</th>
            {series.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {newestFirst.map((r) => (
            <tr key={r.t} className="hover:bg-muted/50">
              <td className="px-3 py-1.5 whitespace-nowrap">{dateTime.format(new Date(r.t))}</td>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                  {r.values[s.key] === undefined ? '–' : `${r.truncated?.[s.key] ? '≥ ' : ''}${formatBytes(r.values[s.key])}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing the newest 200 of {rows.length}.</p>}
    </div>
  )
}
