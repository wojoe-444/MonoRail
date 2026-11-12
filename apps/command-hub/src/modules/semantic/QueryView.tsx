import { useMemo, useState } from 'react'
import { Check, Code2, Copy, Loader2, Play, Plus, Sigma, Table2, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, colorForSeries, gridProps, SERIES_COLORS } from '@/components/charts/palette'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import { filterToWhere, GRAINS, mfCommand, sharedDimensions, shortName, type FilterOp, type FilterRow } from './query'
import { sampleExplain, sampleQuery } from './sample'
import type { ExplainResult, QueryRequest, QueryResult, SemanticProject, TimeGrain } from './types'

export interface QueryDraft {
  key?: number
  metrics: string[]
  groupBy: string[]
  where?: string[]
}

type Grain = TimeGrain | 'none'
const OPS: FilterOp[] = ['=', '!=', 'in', '>', '>=', '<', '<=']
const MAX_SERIES = 5

function splitDraft(d?: QueryDraft): { grain: Grain; dims: string[] } {
  const t = d?.groupBy.find((g) => g.startsWith('metric_time'))
  const grain = (t?.split('__')[1] as TimeGrain | undefined) ?? (t ? 'day' : d ? 'none' : 'week')
  return { grain, dims: d?.groupBy.filter((g) => !g.startsWith('metric_time')) ?? [] }
}

export function QueryView({ project, initial }: { project: SemanticProject; initial?: QueryDraft }) {
  const desktop = isDesktop()
  const start = splitDraft(initial)
  const [metrics, setMetrics] = useState<string[]>(initial?.metrics ?? ['revenue', 'orders'].filter((m) => project.metrics.some((x) => x.name === m)))
  const [grain, setGrain] = useState<Grain>(start.grain)
  const [dims, setDims] = useState<string[]>(initial ? start.dims : ['order__channel'].filter((d) => project.dimensions.some((x) => x.name === d)))
  const [filters, setFilters] = useState<FilterRow[]>([])
  const [rawWhere] = useState<string[]>(initial?.where ?? [])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [order, setOrder] = useState('')
  const [desc, setDesc] = useState(false)
  const [limit, setLimit] = useState('500')

  const [result, setResult] = useState<QueryResult>()
  const [sql, setSql] = useState<string>()
  const [busy, setBusy] = useState<'run' | 'sql'>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const chosen = project.metrics.filter((m) => metrics.includes(m.name))
  const available = sharedDimensions(chosen, project.dimensions)
  const canRun = project.metricflow.canRun && project.metricflow.found

  const req: QueryRequest = {
    metrics,
    groupBy: [...(grain !== 'none' ? [`metric_time__${grain}`] : []), ...dims],
    where: [...rawWhere, ...filters.filter((f) => f.dimension && f.value.trim()).map((f) => filterToWhere(f, project.dimensions))],
    start: from || undefined,
    end: to || undefined,
    orderBy: order ? [`${desc ? '-' : ''}${order}`] : [],
    limit: Number(limit) > 0 ? Math.min(Number(limit), 10000) : undefined,
  }

  async function run(kind: 'run' | 'sql') {
    setBusy(kind)
    setError(undefined)
    try {
      if (kind === 'run') {
        setResult(desktop ? await invokeModule<QueryResult>('semantic', 'query', req) : sampleQuery(req))
      } else {
        setSql((desktop ? await invokeModule<ExplainResult>('semantic', 'explain', req) : sampleExplain(req)).sql)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  function copy() {
    void navigator.clipboard?.writeText(mfCommand(req)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const orderChoices = [...req.groupBy, ...metrics]

  return (
    <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[340px_1fr]">
      {/* Builder */}
      <div className="flex flex-col gap-6 border-b px-6 py-6 lg:border-r lg:border-b-0">
        <Section label="Metrics">
          <div className="flex flex-wrap gap-1.5">
            {metrics.map((m) => (
              <Badge key={m} variant="secondary" className="gap-1 font-mono text-[11px]">
                <Sigma /> {m}
                <button type="button" aria-label={`Remove ${m}`} onClick={() => setMetrics(metrics.filter((x) => x !== m))} className="opacity-60 hover:opacity-100">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <NativeSelect value="" onChange={(e) => e.target.value && setMetrics([...metrics, e.target.value])} aria-label="Add a metric">
            <option value="">Add a metric…</option>
            {project.metrics
              .filter((m) => !metrics.includes(m.name))
              .map((m) => (
                <option key={m.name} value={m.name}>
                  {m.label ?? m.name} ({m.type})
                </option>
              ))}
          </NativeSelect>
        </Section>

        <Section label="Over time">
          <NativeSelect value={grain} aria-label="Time grain" onChange={(e) => setGrain(e.target.value as Grain)}>
            <option value="none">Not over time</option>
            {GRAINS.map((g) => (
              <option key={g} value={g}>
                By {g} (metric_time__{g})
              </option>
            ))}
          </NativeSelect>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </Section>

        <Section label="Group by">
          <div className="flex flex-wrap gap-1.5">
            {dims.map((d) => (
              <Badge key={d} variant="outline" className="gap-1 font-mono text-[11px]">
                {d}
                <button type="button" aria-label={`Remove ${d}`} onClick={() => setDims(dims.filter((x) => x !== d))} className="opacity-60 hover:opacity-100">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <NativeSelect value="" onChange={(e) => e.target.value && setDims([...dims, e.target.value])} aria-label="Add a dimension">
            <option value="">Add a dimension…</option>
            {available
              .filter((d) => !dims.includes(d.name))
              .map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                  {d.type === 'time' ? ' (time)' : ''}
                </option>
              ))}
          </NativeSelect>
          {metrics.length > 1 && <p className="text-xs text-muted-foreground">Only dimensions every chosen metric can be split by.</p>}
        </Section>

        <Section
          label="Filters"
          action={
            <Button size="sm" variant="ghost" onClick={() => setFilters([...filters, { dimension: available.find((d) => d.type === 'categorical')?.name ?? '', op: '=', value: '' }])}>
              <Plus /> Add
            </Button>
          }
        >
          {rawWhere.map((w) => (
            <code key={w} className="rounded-md bg-muted px-2 py-1.5 text-[11px] break-all">
              {w}
            </code>
          ))}
          {filters.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_1fr_auto] items-center gap-1.5">
              <NativeSelect value={f.dimension} aria-label="Dimension" onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, dimension: e.target.value } : x)))}>
                {available.map((d) => (
                  <option key={d.name} value={d.name}>
                    {shortName(d.name)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={f.op} aria-label="Operator" onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, op: e.target.value as FilterOp } : x)))}>
                {OPS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </NativeSelect>
              <Input value={f.value} placeholder={f.op === 'in' ? 'a, b' : 'value'} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <Button size="icon" variant="ghost" aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          {!filters.length && !rawWhere.length && <p className="text-xs text-muted-foreground">No filters.</p>}
        </Section>

        <Section label="Sort and limit">
          <div className="grid grid-cols-[1fr_auto_80px] gap-1.5">
            <NativeSelect value={order} aria-label="Sort by" onChange={(e) => setOrder(e.target.value)}>
              <option value="">Default order</option>
              {orderChoices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" size="sm" className="h-9" disabled={!order} onClick={() => setDesc(!desc)} title="Sort direction">
              {desc ? 'Desc' : 'Asc'}
            </Button>
            <Input inputMode="numeric" aria-label="Row limit" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))} />
          </div>
        </Section>

        <div className="mt-auto flex flex-col gap-2">
          {!canRun && (
            <div className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
              {project.metricflow.canRun
                ? 'The mf command was not found in the project’s Python environment or on PATH.'
                : 'Running queries is off. Turn on “Run queries with MetricFlow” in the MetricFlow connection: MonoRail then runs your own mf command (Python) in the project folder, which queries your warehouse.'}{' '}
              You can still copy the command.
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!metrics.length || !canRun || !!busy} onClick={() => void run('run')}>
              {busy === 'run' ? <Loader2 className="animate-spin" /> : <Play />} Run query
            </Button>
            <Button variant="outline" disabled={!metrics.length || !canRun || !!busy} onClick={() => void run('sql')} title="Ask MetricFlow for the SQL without running it">
              {busy === 'sql' ? <Loader2 className="animate-spin" /> : <Code2 />} SQL
            </Button>
            <Button variant="ghost" size="icon" disabled={!metrics.length} onClick={copy} title="Copy as an mf query command">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex min-w-0 flex-col gap-6 px-6 py-6">
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs whitespace-pre-wrap text-destructive">{error}</p>}
        {sql && <SqlPanel sql={sql} onClose={() => setSql(undefined)} />}
        {result ? (
          <Results result={result} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Table2 className="size-8 opacity-40" />
            <p>Pick metrics and dimensions, then run the query.</p>
            <p className="max-w-md font-mono text-xs break-all opacity-80">{metrics.length ? mfCommand(req) : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-6 items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function SqlPanel({ sql, onClose }: { sql: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg ring-1 ring-foreground/10">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">SQL from MetricFlow</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(sql)}>
            <Copy /> Copy
          </Button>
          <Button size="icon" variant="ghost" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      <pre className="max-h-64 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed">{sql}</pre>
    </div>
  )
}

// --- Results ---------------------------------------------------------------

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function fmt(v: string | number | null): string {
  if (v === null || v === undefined) return '—'
  return typeof v === 'number' ? num.format(v) : v
}

function Results({ result }: { result: QueryResult }) {
  const { columns, rows } = result
  const timeCol = columns.find((c) => c.startsWith('metric_time'))
  const numericCols = columns.filter((c, i) => c !== timeCol && rows.some((r) => typeof r[i] === 'number'))
  const catCols = columns.filter((c) => c !== timeCol && !numericCols.includes(c))
  const [chartMetric, setChartMetric] = useState(numericCols[0])
  const metric = numericCols.includes(chartMetric) ? chartMetric : numericCols[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground tabular-nums">
          {rows.length.toLocaleString()} rows · {(result.ms / 1000).toFixed(1)} s{result.truncated ? ' · cut to the row limit' : ''}
        </span>
        {numericCols.length > 1 && (
          <Segmented className="ml-auto" aria-label="Metric to chart" value={metric} onChange={setChartMetric} options={numericCols.map((c) => ({ value: c, label: c }))} />
        )}
      </div>
      {metric && <ResultChart result={result} timeCol={timeCol} catCols={catCols} metric={metric} />}
      <ResultTable result={result} />
    </div>
  )
}

function ResultChart({ result, timeCol, catCols, metric }: { result: QueryResult; timeCol?: string; catCols: string[]; metric: string }) {
  const { columns, rows } = result
  const mi = columns.indexOf(metric)
  const ti = timeCol ? columns.indexOf(timeCol) : -1
  const catIdx = catCols.map((c) => columns.indexOf(c))
  const label = (r: (string | number | null)[]) => (catIdx.length ? catIdx.map((i) => String(r[i] ?? '—')).join(' · ') : metric)

  // Rank series once on the whole result so colors stay put.
  const order = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of rows) totals.set(label(r), (totals.get(label(r)) ?? 0) + (Number(r[mi]) || 0))
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, metric])
  const shown = order.slice(0, MAX_SERIES)
  const keyOf = (k: string) => (shown.includes(k) ? k : 'Other')
  const keys = order.length > MAX_SERIES ? [...shown, 'Other'] : shown

  if (ti >= 0) {
    const byTime = new Map<string, Record<string, number | string>>()
    for (const r of rows) {
      const t = String(r[ti])
      const row = byTime.get(t) ?? { t }
      const k = keyOf(label(r))
      row[k] = ((row[k] as number) ?? 0) + (Number(r[mi]) || 0)
      byTime.set(t, row)
    }
    const data = [...byTime.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)))
    return (
      <div className="flex flex-col gap-3">
        {keys.length > 1 && <Legend items={keys.map((k) => ({ key: k, label: k, color: colorForSeries(shown, k) }))} />}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="t" {...axisProps} minTickGap={24} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => num.format(v)} />
              <Tooltip content={<SeriesTooltip shown={shown} />} />
              {keys.map((k) => (
                <Line key={k} dataKey={k} name={k} stroke={colorForSeries(shown, k)} strokeWidth={2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (!catIdx.length) return null
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(label(r), (totals.get(label(r)) ?? 0) + (Number(r[mi]) || 0))
  const data = order.slice(0, 12).map((k) => ({ k, v: totals.get(k) ?? 0 }))
  return (
    <div style={{ height: Math.max(120, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} horizontal={false} vertical />
          <XAxis type="number" {...axisProps} tickFormatter={(v: number) => num.format(v)} />
          <YAxis type="category" dataKey="k" {...axisProps} width={120} />
          <Tooltip content={<SeriesTooltip />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="v" name={metric} fill={SERIES_COLORS[0]} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: { dataKey?: string | number; name?: string; value?: number; payload?: { k?: string } }[]
  shown?: string[]
}

function SeriesTooltip({ active, label, payload, shown }: TipProps) {
  if (!active || !payload?.length) return null
  const rows = [...payload]
    .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    .map((p) => ({ key: String(p.dataKey), label: String(p.name), value: num.format(Number(p.value) || 0), color: shown ? colorForSeries(shown, String(p.name)) : SERIES_COLORS[0] }))
  return <ChartTooltipContent title={String(payload[0].payload?.k ?? label ?? '')} rows={rows} />
}

function ResultTable({ result }: { result: QueryResult }) {
  const numeric = result.columns.map((_, i) => result.rows.some((r) => typeof r[i] === 'number'))
  return (
    <div className="max-h-96 overflow-auto rounded-lg ring-1 ring-foreground/10">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b">
            {result.columns.map((c, i) => (
              <th key={c} className={cn('px-3 py-2 font-mono text-xs font-medium whitespace-nowrap text-muted-foreground', numeric[i] ? 'text-right' : 'text-left')}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.slice(0, 500).map((r, ri) => (
            <tr key={ri} className="border-b last:border-0 hover:bg-muted/40">
              {r.map((v, i) => (
                <td key={i} className={cn('px-3 py-1.5 whitespace-nowrap', numeric[i] ? 'text-right font-mono text-xs tabular-nums' : '')}>
                  {fmt(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.rows.length > 500 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing the first 500 of {result.rows.length.toLocaleString()} rows.</p>}
    </div>
  )
}
