import { useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, Copy, Download, FileJson, Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { ChartTooltipContent } from '@/components/charts/ChartTooltip'
import { Legend } from '@/components/charts/Legend'
import { axisProps, gridProps, SERIES_COLORS } from '@/components/charts/palette'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

import { durationMs, formatBytes, formatCount, formatMs, formatTime, NUMERIC_TYPES, rowsAsObjects, toCsv, downloadText } from './format'
import { flatColumns } from './columns'
import { Pager, ResultGrid } from './ResultGrid'
import type { BqCell, BqField, BqJob, BqJobRef, BqStage } from './types'

export interface RunState {
  status: 'running' | 'done' | 'error' | 'cancelled'
  startedAt: number
  endedAt?: number
  job?: BqJobRef
  info?: BqJob
  fields: BqField[]
  rows: BqCell[][]
  totalRows?: number
  /** tokens[i] is the page token that loads page i (page 0 has none). */
  tokens: (string | undefined)[]
  page: number
  error?: string
  bytes?: number
  cacheHit?: boolean
  dml?: number
}

type View = 'info' | 'results' | 'json' | 'plan' | 'chart'

interface Props {
  run?: RunState
  pageSize: number
  onPageSize: (n: number) => void
  onPage: (dir: 1 | -1) => void
  paging: boolean
  now: number
}

export function ResultsPanel({ run, pageSize, onPageSize, onPage, paging, now }: Props) {
  const [view, setView] = useState<View>('results')

  if (!run) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Query results</p>
        <p>Run a query to see its results here. Ctrl+Enter runs the editor, or only the text you selected.</p>
      </div>
    )
  }

  const elapsed = (run.endedAt ?? now) - run.startedAt
  const start = run.page * pageSize

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
        <h2 className="text-sm font-semibold">Query results</h2>
        <Segmented<View>
          aria-label="Results view"
          value={view}
          onChange={setView}
          options={[
            { value: 'info', label: 'Job information' },
            { value: 'results', label: 'Results' },
            { value: 'json', label: 'JSON' },
            { value: 'plan', label: 'Execution details' },
            { value: 'chart', label: 'Chart' },
          ]}
        />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {run.status === 'running' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Running… {formatMs(elapsed)}
            </span>
          ) : run.status === 'done' ? (
            <span>
              Query completed in {formatMs(elapsed)}
              {run.cacheHit ? ' (results cached)' : run.bytes !== undefined ? `, ${formatBytes(run.bytes)} processed` : ''}
            </span>
          ) : run.status === 'cancelled' ? (
            <span>Cancelled</span>
          ) : null}
          {run.status === 'done' && run.rows.length > 0 && <SaveResults fields={run.fields} rows={run.rows} />}
        </div>
      </div>

      {run.status === 'error' && (
        <div role="alert" className="m-4 flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive-soft-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <pre className="font-sans whitespace-pre-wrap">{run.error}</pre>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {view === 'info' ? (
          <JobInfo run={run} elapsed={elapsed} />
        ) : view === 'plan' ? (
          <ExecutionDetails info={run.info} elapsed={elapsed} />
        ) : run.status === 'running' ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Waiting for the job to finish…
          </div>
        ) : run.status === 'error' ? null : run.dml !== undefined && !run.fields.length ? (
          <p className="p-6 text-sm">This statement affected {formatCount(run.dml)} rows.</p>
        ) : view === 'results' ? (
          <>
            <ResultGrid fields={run.fields} rows={run.rows} startIndex={start} className="flex-1" />
            <Pager
              start={start}
              count={run.rows.length}
              total={run.totalRows}
              pageSize={pageSize}
              onPageSize={onPageSize}
              canPrev={run.page > 0}
              canNext={!!run.tokens[run.page + 1]}
              onPrev={() => onPage(-1)}
              onNext={() => onPage(1)}
              busy={paging}
            />
          </>
        ) : view === 'json' ? (
          <pre className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs">{JSON.stringify(rowsAsObjects(run.fields, run.rows), null, 2)}</pre>
        ) : (
          <ResultChart fields={run.fields} rows={run.rows} />
        )}
      </div>
    </div>
  )
}

function SaveResults({ fields, rows }: { fields: BqField[]; rows: BqCell[][] }) {
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          <Download /> Save results <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">The {rows.length.toLocaleString()} rows on this page</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => downloadText(`bq-results-${stamp()}.csv`, toCsv(fields, rows), 'text/csv')}>
          <Download /> CSV file
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadText(`bq-results-${stamp()}.json`, JSON.stringify(rowsAsObjects(fields, rows), null, 2), 'application/json')}>
          <FileJson /> JSON file
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(toCsv(fields, rows).replace(/,/g, '\t'))}>
          <Copy /> Copy to clipboard (for a spreadsheet)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Rows({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(10rem,14rem)_1fr] text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="border-b px-4 py-2 text-muted-foreground">{k}</dt>
          <dd className="min-w-0 border-b px-4 py-2 break-all">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function JobInfo({ run, elapsed }: { run: RunState; elapsed: number }) {
  const j = run.info
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Rows
        items={[
          ['Job ID', run.job ? <span key="v" className="font-mono text-xs">{`${run.job.projectId}:${run.job.location ?? ''}.${run.job.jobId}`}</span> : '—'],
          ['User', j?.user ?? '—'],
          ['Location', run.job?.location ?? '—'],
          ['Creation time', formatTime(j?.creationTime)],
          ['Start time', formatTime(j?.startTime)],
          ['End time', formatTime(j?.endTime)],
          ['Duration', formatMs(durationMs(j?.startTime, j?.endTime) ?? elapsed)],
          ['Bytes processed', run.cacheHit ? '0 B (results cached)' : formatBytes(j?.totalBytesProcessed ?? run.bytes)],
          ['Bytes billed', formatBytes(j?.totalBytesBilled)],
          ['Slot milliseconds', formatCount(j?.totalSlotMs)],
          ['Job priority', 'INTERACTIVE'],
          ['Use legacy SQL', j?.useLegacySql ? 'true' : 'false'],
          ['Statement type', j?.statementType ?? '—'],
          ['Destination table', j?.destinationTable ? <span key="v" className="font-mono text-xs">{j.destinationTable}</span> : '—'],
          ['Status', j?.state ? <Badge key="v" variant={j.error ? 'destructive' : j.state === 'DONE' ? 'success' : 'info'}>{j.error ? 'Failed' : j.state}</Badge> : run.status],
        ]}
      />
    </div>
  )
}

const PHASES = [
  { key: 'waitMsAvg', label: 'Wait' },
  { key: 'readMsAvg', label: 'Read' },
  { key: 'computeMsAvg', label: 'Compute' },
  { key: 'writeMsAvg', label: 'Write' },
] as const

function ExecutionDetails({ info, elapsed }: { info?: BqJob; elapsed: number }) {
  const stages = info?.stages ?? []
  const [open, setOpen] = useState<Set<string>>(new Set())
  const max = Math.max(1, ...stages.map((s) => PHASES.reduce((a, p) => a + (s[p.key] ?? 0), 0)))
  const shuffled = stages.reduce((a, s) => a + (s.shuffleOutputBytes ?? 0), 0)
  if (!info) return <p className="p-6 text-sm text-muted-foreground">Execution details appear once the job has started.</p>
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Elapsed time', formatMs(durationMs(info.startTime, info.endTime) ?? elapsed)],
          ['Slot time consumed', formatMs(info.totalSlotMs)],
          ['Bytes shuffled', formatBytes(shuffled)],
          ['Bytes processed', formatBytes(info.totalBytesProcessed)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg p-3 ring-1 ring-foreground/10">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{k}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      {stages.length ? (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Stages</h3>
            <Legend items={PHASES.map((p, i) => ({ key: p.key, label: `${p.label} (avg)`, color: SERIES_COLORS[i] }))} />
          </div>
          <ul className="mt-2 divide-y rounded-lg ring-1 ring-foreground/10">
            {stages.map((s) => (
              <StageRow key={s.id} s={s} max={max} open={open.has(s.id)} onToggle={() => setOpen((o) => new Set(o.has(s.id) ? [...o].filter((x) => x !== s.id) : [...o, s.id]))} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">BigQuery gave no query plan for this job (cached results and some statements have none).</p>
      )}
    </div>
  )
}

function StageRow({ s, max, open, onToggle }: { s: BqStage; max: number; open: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-[1.25rem_minmax(10rem,16rem)_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent/50">
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="truncate font-medium">{s.name}</span>
        <span className="flex h-3 overflow-hidden rounded-sm bg-muted" aria-label="Average time per phase">
          {PHASES.map((p, i) => (
            <span key={p.key} title={`${p.label}: ${formatMs(s[p.key])}`} style={{ width: `${((s[p.key] ?? 0) / max) * 100}%`, background: SERIES_COLORS[i] }} />
          ))}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatCount(s.recordsRead)} in · {formatCount(s.recordsWritten)} out
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t bg-muted/30 px-10 py-3 text-xs md:grid-cols-2">
          <table className="w-full">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left font-medium">Phase</th>
                <th className="text-right font-medium">Avg</th>
                <th className="text-right font-medium">Max</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {PHASES.map((p) => (
                <tr key={p.key}>
                  <td className="font-sans">{p.label}</td>
                  <td className="text-right">{formatMs(s[p.key])}</td>
                  <td className="text-right">{formatMs(s[p.key.replace('Avg', 'Max') as keyof BqStage] as number | undefined)}</td>
                </tr>
              ))}
              <tr>
                <td className="font-sans">Slot time</td>
                <td className="text-right" colSpan={2}>
                  {formatMs(s.slotMs)}
                </td>
              </tr>
            </tbody>
          </table>
          <ul className="flex flex-col gap-1">
            {s.steps.map((st, i) => (
              <li key={i}>
                <span className="font-semibold">{st.kind}</span>
                {st.substeps.map((x, j) => (
                  <div key={j} className="truncate pl-3 font-mono text-muted-foreground" title={x}>
                    {x}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

const MAX_SERIES = SERIES_COLORS.length

function ResultChart({ fields, rows }: { fields: BqField[]; rows: BqCell[][] }) {
  const cols = useMemo(() => flatColumns(fields), [fields])
  const numeric = cols.filter((c) => NUMERIC_TYPES.has(c.type))
  const dims = cols.filter((c) => !NUMERIC_TYPES.has(c.type))
  const [x, setX] = useState<string>(() => dims[0]?.label ?? cols[0]?.label ?? '')
  const [ys, setYs] = useState<string[]>(() => numeric.filter((c) => c.label !== x).slice(0, 2).map((c) => c.label))
  const [kind, setKind] = useState<'bar' | 'line'>('bar')
  const xCol = cols.find((c) => c.label === x)
  const shown = ys.filter((y) => numeric.some((c) => c.label === y)).slice(0, MAX_SERIES)
  const data = useMemo(
    () =>
      rows.map((r) => {
        const o: Record<string, string | number | null> = { __x: xCol ? String(xCol.get(r) ?? 'null') : '' }
        for (const y of shown) {
          const v = cols.find((c) => c.label === y)?.get(r)
          o[y] = v === null || v === undefined ? null : Number(v)
        }
        return o
      }),
    [rows, xCol, shown, cols],
  )
  if (!numeric.length) return <p className="p-6 text-sm text-muted-foreground">A chart needs at least one numeric column in the results.</p>
  const color = (y: string) => SERIES_COLORS[shown.indexOf(y)]
  const Chart = kind === 'bar' ? BarChart : LineChart
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">X axis</span>
          <NativeSelect className="h-8 w-48" value={x} onChange={(e) => setX(e.target.value)}>
            {cols.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">Values</span>
          {numeric.map((c) => {
            const on = shown.includes(c.label)
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={on}
                disabled={!on && shown.length >= MAX_SERIES}
                onClick={() => setYs(on ? ys.filter((y) => y !== c.label) : [...ys, c.label])}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs', on ? 'border-transparent bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground disabled:opacity-40')}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <Segmented aria-label="Chart type" className="ml-auto" value={kind} onChange={setKind} options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }]} />
      </div>
      {shown.length > 1 && <Legend shape={kind === 'line' ? 'line' : 'rect'} items={shown.map((y) => ({ key: y, color: color(y) }))} />}
      <div className="min-h-[240px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="__x" {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={64} tickFormatter={(v: number) => Intl.NumberFormat(undefined, { notation: 'compact' }).format(v)} />
            <Tooltip
              cursor={kind === 'bar' ? { fill: 'var(--muted)' } : undefined}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipContent
                    title={String(label)}
                    rows={payload.map((p) => ({ key: String(p.dataKey), label: String(p.dataKey), value: p.value === null || p.value === undefined ? 'null' : Number(p.value).toLocaleString(), color: color(String(p.dataKey)) }))}
                  />
                ) : null
              }
            />
            {shown.map((y) =>
              kind === 'bar' ? <Bar key={y} dataKey={y} fill={color(y)} maxBarSize={24} radius={[2, 2, 0, 0]} /> : <Line key={y} dataKey={y} stroke={color(y)} strokeWidth={2} dot={false} type="monotone" />,
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Charts the {rows.length.toLocaleString()} rows on this page. The Results tab shows them as a table.</p>
    </div>
  )
}
