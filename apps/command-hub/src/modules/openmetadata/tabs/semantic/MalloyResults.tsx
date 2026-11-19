import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, gridProps, SERIES_COLORS } from '@/components/charts/palette'
import { cn } from '@/lib/utils'

import type { MalloyProblem, MalloyResultField, MalloyRun } from './malloyClient'
import { malloyScanText } from './malloyFormat'


/*
 * The result of a Malloy run: a facts line (rows, truncated, time, bytes),
 * a bar chart when there is one dimension and at least one measure, and a
 * table of every row beside it. Shared by the Malloy tab's workbench and the
 * Query builder.
 */

const num = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
/** Bars charted at most; the table always has every row. */
const MAX_BARS = 25

/** Compiler or BigQuery problems as a list; `onLine` makes line numbers clickable. */
export function MalloyProblems({ problems, onLine, className }: { problems: MalloyProblem[]; onLine?: (p: MalloyProblem) => void; className?: string }) {
  if (!problems.length) return null
  return (
    <ul className={cn('flex flex-col gap-1.5 rounded-lg bg-destructive-soft/60 px-3 py-2 text-sm text-destructive-soft-foreground', className)}>
      {problems.map((p, i) => (
        <li key={i} className="flex items-start gap-2">
          <AlertTriangle className={cn('mt-0.5 size-3.5 shrink-0', p.severity !== 'error' && 'opacity-60')} />
          <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{p.message}</span>
          {p.line !== undefined &&
            (onLine ? (
              <button type="button" onClick={() => onLine(p)} className="shrink-0 font-mono text-xs underline-offset-2 hover:underline" title="Show in the source text">
                {p.file ? `${p.file}:` : 'line '}
                {p.line}
              </button>
            ) : (
              <span className="shrink-0 font-mono text-xs opacity-80">
                {p.file ? `${p.file}:` : 'line '}
                {p.line}
              </span>
            ))}
        </li>
      ))}
    </ul>
  )
}

function cellText(v: unknown, field: MalloyResultField): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'number') return num.format(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') {
    const s = JSON.stringify(v)
    return s.length > 160 ? `${s.slice(0, 157)}…` : s
  }
  const s = String(v)
  return field.type === 'timestamp' && /T00:00:00(\.0+)?Z?$/.test(s) ? s.slice(0, 10) : s
}

const isNumeric = (f: MalloyResultField) => f.type === 'number'
const isFlat = (f: MalloyResultField) => f.type !== 'nested' && f.type !== 'view'

export function MalloyResults({ result }: { result: MalloyRun }) {
  const fields = useMemo(() => result.fields ?? [], [result.fields])
  const rows = useMemo(() => result.rows ?? [], [result.rows])

  const facts = [
    `${num.format(rows.length)} row${rows.length === 1 ? '' : 's'}`,
    result.truncated && result.totalRows !== undefined ? `of ${num.format(result.totalRows)} (cut at ${num.format(rows.length)})` : result.truncated ? '(cut)' : undefined,
    result.ms !== undefined ? `${result.ms < 1000 ? `${result.ms} ms` : `${(result.ms / 1000).toFixed(1)} s`}` : undefined,
    malloyScanText(result.estimate),
  ].filter(Boolean) as string[]

  const dims = fields.filter((f) => !f.isMeasure && isFlat(f))
  const measures = fields.filter((f) => f.isMeasure && isNumeric(f)).slice(0, SERIES_COLORS.length)
  const chartable = dims.length === 1 && measures.length > 0 && fields.every(isFlat) && rows.length > 0

  if (!result.ok && !rows.length) return <MalloyProblems problems={result.problems} />

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {facts.map((t, i) => (
          <span key={i} className={cn('flex items-center gap-3', i === 1 && result.truncated && 'text-warning-soft-foreground')}>
            {i > 0 && <span className="text-foreground/20">·</span>}
            {t}
          </span>
        ))}
      </div>
      {result.problems.length > 0 && <MalloyProblems problems={result.problems} />}
      {!fields.length ? (
        <p className="text-sm text-muted-foreground">The query returned no columns.</p>
      ) : (
        <div className={cn('grid min-w-0 grid-cols-1 items-start gap-6', chartable && 'xl:grid-cols-2')}>
          {chartable && <ResultBars rows={rows} dim={dims[0]} measures={measures} />}
          <ResultTable fields={fields} rows={rows} />
        </div>
      )}
    </div>
  )
}

function ResultTable({ fields, rows }: { fields: MalloyResultField[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="max-h-[480px] min-w-0 overflow-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="text-left text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]">
            {fields.map((f) => (
              <th key={f.name} className={cn('px-3 py-2 font-medium whitespace-nowrap', isNumeric(f) && 'text-right')} title={`${f.type}${f.isMeasure ? ', measure' : ''}`}>
                <span className="font-mono">{f.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
              {fields.map((f) => {
                const v = r[f.name]
                return (
                  <td key={f.name} className={cn('px-3 py-1.5 font-mono text-xs whitespace-nowrap', isNumeric(f) && 'text-right tabular-nums', (v === null || v === undefined) && 'text-muted-foreground/60')}>
                    {cellText(v, f)}
                  </td>
                )
              })}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={fields.length} className="px-3 py-6 text-center text-sm text-muted-foreground">
                No rows.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: { dataKey?: string | number; name?: string; value?: number; color?: string }[]
}

function BarTip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <ChartTooltipContent
      title={String(label ?? '')}
      rows={payload.map((p) => ({ key: String(p.dataKey), label: String(p.name ?? p.dataKey), value: num.format(Number(p.value) || 0), color: p.color }))}
    />
  )
}

function ResultBars({ rows, dim, measures }: { rows: Record<string, unknown>[]; dim: MalloyResultField; measures: MalloyResultField[] }) {
  // Rows keep the query's own order (its order_by); only the first ones are charted.
  const data = rows.slice(0, MAX_BARS).map((r) => {
    const v = r[dim.name]
    const out: Record<string, string | number> = { k: v === null || v === undefined ? '∅' : cellText(v, dim) }
    measures.forEach((m, i) => (out[`m${i}`] = Number(r[m.name]) || 0))
    return out
  })
  const barSize = Math.max(6, Math.min(24, Math.floor(24 / measures.length)))
  const rowHeight = Math.max(28, barSize * measures.length + 12)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {measures.length > 1 && <Legend items={measures.map((m, i) => ({ key: m.name, color: SERIES_COLORS[i] }))} />}
      <div style={{ height: Math.max(120, data.length * rowHeight + 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid {...gridProps} horizontal={false} vertical />
            <XAxis type="number" {...axisProps} tickFormatter={(v: number) => compact.format(v)} />
            <YAxis type="category" dataKey="k" {...axisProps} width={128} interval={0} />
            <Tooltip content={<BarTip />} cursor={{ fill: 'var(--muted)' }} />
            {measures.map((m, i) => (
              <Bar key={m.name} dataKey={`m${i}`} name={m.name} fill={SERIES_COLORS[i]} barSize={barSize} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {rows.length > MAX_BARS && <p className="text-xs text-muted-foreground">The chart shows the first {MAX_BARS} rows; the table has all {num.format(rows.length)}.</p>}
    </div>
  )
}
