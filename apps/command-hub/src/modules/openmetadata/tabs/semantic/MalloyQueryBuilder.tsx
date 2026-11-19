import { useMemo, useState, type ReactNode } from 'react'
import { Check, Code2, Copy, Eye, Loader2, Play, Plus, RotateCcw, Sigma, Tag, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

import { takeMalloyDraft, type MalloyDraft } from './handoff'
import { MalloyBlockedCard } from './malloyBlocked'
import { malloyCall, type MalloyRun, type MalloySql } from './malloyClient'
import { MalloyCode } from './MalloyCode'
import { buildMalloyQuery, FILTER_OPS, needsValue, outputNames, pickFields, specReady, type FilterOp, type MalloyFilter, type PickField } from './malloyQuery'
import { malloyScanText } from './malloyFormat'
import { MalloyProblems, MalloyResults } from './MalloyResults'
import { MalloyFileProblems, MalloyStrip } from './MalloySources'
import { Empty } from './parts'
import { blockedReason, useMalloyModels, type MalloyModelsState, type MalloySourceEntry } from './useMalloyModels'

/**
 * The Malloy engine's Query builder: a model file and source, then fields
 * (group by, aggregate), filters, order and limit, or one of the source's
 * views. Shows the Malloy it writes, the SQL Malloy compiles with BigQuery's
 * dry-run estimate, and runs it when the connection allows.
 */
export function MalloyQueryTab() {
  const state = useMalloyModels()
  const [draft, setDraft] = useState<MalloyDraft | undefined>(takeMalloyDraft)
  const { status, listing, error, loading, reload } = state

  if (loading || (!status && !error)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Reading the Malloy models…
      </div>
    )
  }
  if (!status || !listing) return <p className="text-sm text-destructive">{error ?? 'The Malloy models could not be read.'}</p>
  const reason = blockedReason(status.block ?? listing.block)
  if (reason) return <MalloyBlockedCard reason={reason} onRetry={reload} />

  return (
    <div className="flex flex-col gap-6">
      <MalloyStrip state={state} />
      <MalloyFileProblems state={state} />
      {!state.sources.length ? (
        <Card>
          {state.compiling > 0 ? (
            <Empty icon={Loader2} title="Compiling the model files…" />
          ) : (
            <Empty icon={Code2} title="No Malloy sources to query">
              Define a source in a .malloy file of the models folder and reload.
            </Empty>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Pick a source, then fields to group by and aggregate, or one of its views. Malloy writes the SQL, joins included.</p>
            <Button className="ml-auto" variant="ghost" size="sm" onClick={() => setDraft({ path: draft?.path ?? '', source: draft?.source ?? '', key: Date.now() })} title="Clear the builder">
              <RotateCcw /> Start over
            </Button>
          </div>
          <Card className="gap-0 py-0">
            <Builder key={draft?.key ?? 'default'} state={state} initial={draft} />
          </Card>
        </div>
      )}
    </div>
  )
}

const KIND_ICON = { dimension: Tag, measure: Sigma, view: Eye } as const

function Builder({ state, initial }: { state: MalloyModelsState; initial?: MalloyDraft }) {
  const files = useMemo(() => [...new Set(state.sources.map((s) => s.path))].sort(), [state.sources])
  const firstEntry = (initial && state.sources.find((s) => s.path === initial.path && s.source.name === initial.source)) ?? (initial && state.sources.find((s) => s.source.name === initial.source)) ?? state.sources[0]
  const [path, setPath] = useState(firstEntry.path)
  const [sourceName, setSourceName] = useState(firstEntry.source.name)
  const entry: MalloySourceEntry | undefined = state.sources.find((s) => s.path === path && s.source.name === sourceName) ?? state.sources.find((s) => s.path === path)

  const [mode, setMode] = useState<'fields' | 'view'>(initial?.view ? 'view' : 'fields')
  const [view, setView] = useState<string | undefined>(initial?.view)
  const [dims, setDims] = useState<string[]>([])
  const [measures, setMeasures] = useState<string[]>([])
  const [filters, setFilters] = useState<MalloyFilter[]>([])
  const [orderBy, setOrderBy] = useState('')
  const [desc, setDesc] = useState(true)
  const [limit, setLimit] = useState('100')
  const [search, setSearch] = useState('')

  const [sql, setSql] = useState<MalloySql>()
  const [result, setResult] = useState<MalloyRun>()
  const [busy, setBusy] = useState<'sql' | 'run'>()
  const [failure, setFailure] = useState<string>()
  const [copied, setCopied] = useState(false)

  const fields = useMemo(() => (entry ? pickFields(entry.source, [...entry.siblings, ...state.sources.map((x) => x.source)]) : []), [entry, state.sources])
  const views = fields.filter((f) => f.kind === 'view')
  const filterable = fields.filter((f) => f.kind === 'dimension')

  function pickSource(p: string, name: string) {
    setPath(p)
    setSourceName(name)
    setDims([])
    setMeasures([])
    setFilters([])
    setOrderBy('')
    setView(undefined)
    setMode('fields')
    setSql(undefined)
    setResult(undefined)
  }

  if (!entry) return null

  const spec = {
    source: entry.source.name,
    view: mode === 'view' ? view : undefined,
    dims,
    measures,
    filters,
    orderBy: orderBy || undefined,
    desc,
    limit: Number(limit) > 0 ? Math.min(Number(limit), 100000) : undefined,
  }
  const ready = specReady(spec)
  const query = ready ? buildMalloyQuery(spec, fields) : ''
  const orderChoices = outputNames([...dims, ...measures]).map((n) => n.name)
  const status = state.status
  const runReason = !status?.run ? 'Running queries is off: turn on “Run queries on BigQuery” in the Malloy connection on Connections.' : !ready ? 'Pick a field or a view first.' : undefined

  const toggle = (f: PickField) => {
    if (f.kind === 'view') {
      setMode('view')
      setView(f.path)
      return
    }
    const set = f.kind === 'dimension' ? setDims : setMeasures
    set((xs) => (xs.includes(f.path) ? xs.filter((x) => x !== f.path) : [...xs, f.path]))
  }

  async function call(kind: 'sql' | 'run') {
    setBusy(kind)
    setFailure(undefined)
    try {
      if (kind === 'sql') setSql(await malloyCall('sql', { path: entry!.path, query }))
      else {
        const r = await malloyCall('run', { path: entry!.path, query })
        setResult(r)
        if (r.sql) setSql(r)
      }
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  function copy() {
    void navigator.clipboard?.writeText(query).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const s = search.trim().toLowerCase()
  const shown = fields.filter((f) => (mode === 'view' ? f.kind === 'view' : f.kind !== 'view') && (!s || f.path.toLowerCase().includes(s) || f.description?.toLowerCase().includes(s)))
  const groups: { label: string; items: PickField[] }[] =
    mode === 'view'
      ? [{ label: 'Views', items: shown }]
      : [
          { label: 'Dimensions', items: shown.filter((f) => !f.join && f.kind === 'dimension') },
          { label: 'Measures', items: shown.filter((f) => !f.join && f.kind === 'measure') },
          ...[...new Set(shown.filter((f) => f.join).map((f) => f.join!))].map((j) => ({ label: `Joined: ${j}`, items: shown.filter((f) => f.join === j) })),
        ]
  const estimate = sql?.estimate
  const overLimit = estimate?.bytes !== undefined && estimate.maxBytesBilled !== undefined && estimate.bytes > estimate.maxBytesBilled

  return (
    <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[360px_1fr]">
      {/* Builder */}
      <div className="flex min-w-0 flex-col gap-6 border-b px-6 py-6 lg:border-r lg:border-b-0">
        <Section label="Model file">
          <NativeSelect aria-label="Model file" value={path} onChange={(e) => pickSource(e.target.value, state.sources.find((x) => x.path === e.target.value)?.source.name ?? '')}>
            {files.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </NativeSelect>
        </Section>
        <Section label="Source">
          <NativeSelect aria-label="Source" value={entry.source.name} onChange={(e) => pickSource(path, e.target.value)}>
            {state.sources
              .filter((x) => x.path === path)
              .map((x) => (
                <option key={x.key} value={x.source.name} title={x.source.description}>
                  {x.source.name}
                </option>
              ))}
          </NativeSelect>
          {entry.source.tablePath && <p className="mt-1.5 truncate font-mono text-xs text-muted-foreground">{entry.source.tablePath}</p>}
        </Section>

        <Segmented
          aria-label="Query by"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fields', label: 'Fields' },
            { value: 'view', label: `Views ${views.length}`, disabled: !views.length, title: views.length ? undefined : 'This source has no views' },
          ]}
        />

        {mode === 'fields' && (dims.length > 0 || measures.length > 0) && (
          <Section label="Picked">
            <div className="flex flex-wrap gap-1.5">
              {[...dims.map((d) => ['dimension', d] as const), ...measures.map((m) => ['measure', m] as const)].map(([kind, p]) => {
                const Icon = KIND_ICON[kind]
                return (
                  <Badge key={p} variant={kind === 'measure' ? 'primary' : 'secondary'} className="gap-1 font-mono text-[11px]">
                    <Icon /> {p}
                    <button type="button" aria-label={`Remove ${p}`} className="ml-0.5 rounded hover:text-foreground" onClick={() => (kind === 'dimension' ? setDims : setMeasures)((xs) => xs.filter((x) => x !== p))}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          </Section>
        )}

        <Section label={mode === 'view' ? 'View' : 'Fields'}>
          <SearchField size="sm" aria-label="Search fields" placeholder="Search fields" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-2 flex max-h-80 flex-col gap-3 overflow-auto rounded-lg p-1 ring-1 ring-foreground/10">
            {groups
              .filter((g) => g.items.length)
              .map((g) => (
                <div key={g.label}>
                  <div className="px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g.label}</div>
                  {g.items.map((f) => {
                    const Icon = KIND_ICON[f.kind]
                    const on = f.kind === 'view' ? view === f.path : (f.kind === 'dimension' ? dims : measures).includes(f.path)
                    return (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => toggle(f)}
                        title={f.description}
                        aria-pressed={on}
                        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', on && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft')}
                      >
                        <Icon className="size-3.5 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
                        {f.type && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{f.type}</span>}
                        {on && <Check className="size-3.5 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            {!shown.length && <p className="px-2 py-3 text-xs text-muted-foreground">{s ? `Nothing matches “${search}”.` : 'No fields.'}</p>}
          </div>
        </Section>

        <Section label="Filters">
          <div className="flex flex-col gap-2">
            {filters.map((f, i) => {
              const set = (patch: Partial<MalloyFilter>) => setFilters((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)))
              return (
                <div key={i} className="flex flex-col gap-1.5 rounded-lg p-2 ring-1 ring-foreground/10">
                  <div className="flex gap-1.5">
                    <NativeSelect aria-label="Filter field" className="min-w-0 flex-1" value={f.field} onChange={(e) => set({ field: e.target.value })}>
                      <option value="">Field…</option>
                      {filterable.map((x) => (
                        <option key={x.path} value={x.path}>
                          {x.path}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button variant="ghost" size="icon" aria-label="Remove filter" onClick={() => setFilters((xs) => xs.filter((_, k) => k !== i))}>
                      <X />
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    <NativeSelect aria-label="Operator" className="w-32" value={f.op} onChange={(e) => set({ op: e.target.value as FilterOp })}>
                      {FILTER_OPS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </NativeSelect>
                    {needsValue(f.op) && <Input aria-label="Value" className="min-w-0 flex-1 font-mono text-xs" value={f.value} placeholder="value" onChange={(e) => set({ value: e.target.value })} />}
                  </div>
                </div>
              )
            })}
            <Button variant="outline" size="sm" className="self-start" disabled={!filterable.length} onClick={() => setFilters((xs) => [...xs, { field: '', op: '=', value: '' }])}>
              <Plus /> Add filter
            </Button>
          </div>
        </Section>

        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
          {mode === 'fields' && (
            <Section label="Order by">
              <div className="flex gap-1.5">
                <NativeSelect aria-label="Order by" className="min-w-0 flex-1" value={orderChoices.includes(orderBy) ? orderBy : ''} onChange={(e) => setOrderBy(e.target.value)}>
                  <option value="">Malloy's default</option>
                  {orderChoices.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
                <Segmented
                  aria-label="Direction"
                  value={desc ? 'desc' : 'asc'}
                  onChange={(v) => setDesc(v === 'desc')}
                  options={[
                    { value: 'desc', label: 'Desc', disabled: !orderBy },
                    { value: 'asc', label: 'Asc', disabled: !orderBy },
                  ]}
                />
              </div>
            </Section>
          )}
          <Section label="Limit" className={mode === 'view' ? 'col-span-2' : undefined}>
            <Input aria-label="Limit" type="number" min={1} className="w-24 font-mono text-xs" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Section>
        </div>
      </div>

      {/* Query, SQL and results */}
      <div className="flex min-w-0 flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Malloy</span>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="icon" disabled={!ready} onClick={copy} title="Copy the Malloy query">
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button variant="outline" size="sm" disabled={!ready || !!busy} onClick={() => void call('sql')}>
                {busy === 'sql' ? <Loader2 className="animate-spin" /> : <Code2 />} Show SQL
              </Button>
              <Button size="sm" disabled={!!runReason || !!busy} onClick={() => void call('run')} title={runReason}>
                {busy === 'run' ? <Loader2 className="animate-spin" /> : <Play />} Run
              </Button>
            </span>
          </div>
          {ready ? <MalloyCode text={query} numbers={false} className="max-h-64" /> : <p className="rounded-lg px-4 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">Pick fields to group by or aggregate, or a view, to write a query.</p>}
          {runReason && ready && <p className="text-xs text-muted-foreground">{runReason}</p>}
          {failure && <p className="text-sm text-destructive">{failure}</p>}
        </div>

        {sql && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">SQL</span>
              {estimate && (
                <span className={cn('text-xs', overLimit ? 'text-warning-soft-foreground' : 'text-muted-foreground')}>
                  {malloyScanText(estimate)}
                  {overLimit && ': over the scan limit, so BigQuery would refuse it'}
                </span>
              )}
              {sql.sql && (
                <Button className="ml-auto" size="sm" variant="ghost" onClick={() => void navigator.clipboard?.writeText(sql.sql!)}>
                  <Copy /> Copy
                </Button>
              )}
            </div>
            {sql.sql && <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 px-4 py-3 font-mono text-xs whitespace-pre ring-1 ring-foreground/10">{sql.sql}</pre>}
            {!sql.ok && !result && <MalloyProblems problems={sql.problems} />}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Results</span>
            {result.block === 'run-off' ? <MalloyProblems problems={result.problems} /> : <MalloyResults result={result} />}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      {children}
    </div>
  )
}
