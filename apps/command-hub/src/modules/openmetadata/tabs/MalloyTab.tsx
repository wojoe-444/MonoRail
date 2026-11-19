import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Box, Settings2, CheckCircle2, Cloud, Columns3, Database, FileCode2, FileWarning, KeyRound, Loader2, Network, Play, RefreshCw, Sigma, Table2, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { formatBytes, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { findSource, parseMalloy, type MalloyModel } from './semantic/malloy'
import { MalloyBlockedCard } from './semantic/malloyBlocked'
import { openMalloySettings, useMalloySettingsVersion } from './semantic/malloySettings'
import { malloyCall, malloyName, type MalloyCompiled, type MalloyProblem, type MalloyStatus } from './semantic/malloyClient'
import { MalloyCode } from './semantic/MalloyCode'
import { malloyStarterQuery, malloyViewModel, type MalloyViewField, type MalloyViewModel, type MalloyViewSource } from './semantic/malloyOutline'
import { MalloyProblems } from './semantic/MalloyResults'
import type { MalloyFile, MalloyListing } from './semantic/malloyTypes'
import { useMalloyBench, type MalloyBench } from './semantic/malloyBench'
import { MalloyWorkbench } from './semantic/MalloyWorkbench'
import { Empty, Overline } from './semantic/parts'
import type { OmTabProps } from './types'

/**
 * The Malloy models in the folder picked in Malloy settings, compiled by the real
 * Malloy compiler (backend module `malloy`) and run on BigQuery with the
 * user's gcloud login. The compiler's outline is the authority for sources,
 * fields, types and joins; a small tolerant reader supplies each field's
 * definition text and stands in while compiling or when compiling fails.
 * Read-only: no file is ever written. Malloy ships with MonoRail: nothing is
 * read until a models folder is picked, and nothing runs unless "Run queries" is on.
 */
export default function MalloyTab(_props: OmTabProps) {
  const [data, setData] = useState<{ status: MalloyStatus; listing: MalloyListing }>()
  const [error, setError] = useState<string>()
  const [fetching, setFetching] = useState(true)
  const [gen, setGen] = useState(0)
  const bench = useMalloyBench()
  const settingsVersion = useMalloySettingsVersion()

  useEffect(() => {
    let live = true
    Promise.all([malloyCall('status'), malloyCall('listModels')])
      .then(([status, listing]) => {
        if (!live) return
        setData({ status, listing })
        setError(undefined)
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setFetching(false))
    return () => {
      live = false
    }
  }, [gen, settingsVersion])

  const reload = () => {
    setFetching(true)
    setGen((g) => g + 1)
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error && !fetching ? (
          <>
            <AlertTriangle className="size-4 text-warning" /> {error}
            <Button variant="ghost" size="sm" onClick={reload}>
              <RefreshCw /> Try again
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin" /> Looking for Malloy models…
          </>
        )}
      </div>
    )
  }
  const { status, listing } = data
  if (status.block === 'not-set-up' || listing.block === 'not-set-up') return <MalloyBlockedCard reason="not-set-up" onRetry={reload} />
  if (status.block === 'no-folder' || listing.block === 'no-project') return <MalloyBlockedCard reason="no-folder" onRetry={reload} />

  return <MalloyBrowser key={listing.readAt} status={status} listing={listing} fetching={fetching} onReload={reload} bench={bench} />
}

type View = 'workbench' | 'outline' | 'text'
type Compiled = Record<string, { result?: MalloyCompiled; error?: string }>

function MalloyBrowser({ status, listing, fetching, onReload, bench }: { status: MalloyStatus; listing: MalloyListing; fetching: boolean; onReload: () => void; bench: MalloyBench }) {
  const parsed = useMemo(() => listing.files.filter((f) => f.text !== undefined).map((f) => parseMalloy(f.path, f.text!)), [listing])
  const readable = useMemo(() => listing.files.filter((f) => !f.tooLarge), [listing])
  const big = listing.files.filter((f) => f.tooLarge)
  const requested = useRef(new Set<string>())
  const [compiled, setCompiled] = useState<Compiled>({})
  const first = parsed.find((m) => m.sources.length || m.queries.length) ?? parsed[0]
  const [sel, setSel] = useState<{ path: string; source?: string } | undefined>(first && { path: first.path })
  const [view, setView] = useState<View>('workbench')
  const [focus, setFocus] = useState<{ line: number; key: number } | undefined>()
  const [search, setSearch] = useState('')

  // Compile the open model once per listing (the backend also keeps it while the file is unchanged).
  const openPath = sel?.path
  useEffect(() => {
    if (!openPath || requested.current.has(openPath) || !readable.some((f) => f.path === openPath)) return
    requested.current.add(openPath)
    malloyCall('compile', { path: openPath })
      .then((result) => setCompiled((c) => ({ ...c, [openPath]: { result } })))
      .catch((e: unknown) => setCompiled((c) => ({ ...c, [openPath]: { error: e instanceof Error ? e.message : String(e) } })))
  }, [openPath, readable])

  const models = useMemo(() => {
    const out = new Map<string, MalloyViewModel>()
    for (const f of readable) out.set(f.path, malloyViewModel(f.path, parsed.find((m) => m.path === f.path), compiled[f.path]?.result))
    return out
  }, [readable, parsed, compiled])

  const ownSources = (path: string) => (models.get(path)?.sources ?? []).filter((s) => !s.imported)
  const sourceCount = readable.reduce((n, f) => n + ownSources(f.path).length, 0)

  const s = search.trim().toLowerCase()
  const shown = readable
    .map((f) => ({ f, sources: ownSources(f.path).filter((x) => !s || x.name.toLowerCase().includes(s) || f.path.toLowerCase().includes(s) || x.fields.some((y) => y.name.toLowerCase().includes(s))) }))
    .filter((x) => !s || x.sources.length || x.f.path.toLowerCase().includes(s))

  const goTo = (line: number, file?: string) => {
    if (file && file !== sel?.path && readable.some((f) => f.path === file)) setSel({ path: file })
    setView('text')
    setFocus({ line, key: Date.now() })
  }
  const openSource = (path: string, source?: string) => {
    setSel({ path, source })
    setView('outline')
  }

  const file = listing.files.find((f) => f.path === sel?.path)
  const model = sel ? models.get(sel.path) : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="font-mono">
          <FileCode2 /> {listing.folderName ?? status.folderName ?? 'Models'}
        </Badge>
        <span className="tabular-nums">
          {listing.files.length} Malloy file{listing.files.length === 1 ? '' : 's'}
        </span>
        <span className="text-foreground/20">·</span>
        <span className="tabular-nums">{sourceCount} sources</span>
        {status.project && (
          <>
            <span className="text-foreground/20">·</span>
            <span className="flex items-center gap-1.5" title="The Google Cloud project queries are billed to">
              <Cloud className="size-3.5" /> <span className="font-mono text-xs">{status.project}</span>
            </span>
          </>
        )}
        <span className="ml-auto flex items-center gap-3 text-xs">
          {status.gcloud === false && <Badge variant="warning">No Google Cloud login</Badge>}
          {status.run ? (
            <Badge variant="success" title={status.maxBytesBilled ? `At most ${formatBytes(status.maxBytesBilled)} scanned per query` : undefined}>
              <span className="size-1.5 rounded-full bg-success" /> Queries on
            </Badge>
          ) : (
            <Badge variant="secondary" title="Turn on “Run queries on BigQuery” in Malloy settings">
              Queries off
            </Badge>
          )}
          <span>Read {formatRelative(listing.readAt)}</span>
          <Button variant="ghost" size="sm" onClick={openMalloySettings} title="Models folder, billing project, running queries and the scan limit">
            <Settings2 /> Settings
          </Button>
          <Button variant="ghost" size="sm" disabled={fetching} onClick={onReload} title="Read the folder and compile again">
            {fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reload
          </Button>
        </span>
      </div>

      {status.gcloud === false && <MalloyBlockedCard reason="no-gcloud" onRetry={onReload} compact />}

      {listing.truncated && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">The folder holds more than this tab reads (200 files). Only the first ones found are shown.</p>
      )}

      {!listing.files.length ? (
        <Card>
          <Empty icon={FileCode2} title={`No Malloy files in ${listing.folderName ?? 'the models folder'}`}>
            .malloy files anywhere in the models folder show up here (folders starting with a dot, node_modules and target are skipped).
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[300px_1fr]">
          <Card className="gap-3 py-4">
            <div className="px-4">
              <SearchField size="sm" aria-label="Search Malloy sources" placeholder="Search sources and fields" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-col gap-3 px-2">
              {shown.map(({ f, sources }) => {
                const c = compiled[f.path]
                const bad = c?.result && !c.result.ok
                return (
                  <div key={f.path} className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSel({ path: f.path })}
                      className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors', sel?.path === f.path && !sel.source ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted')}
                      title={f.path}
                    >
                      <FileCode2 className="size-3.5 shrink-0" />
                      <span className="truncate">{f.path}</span>
                      {bad && <AlertTriangle className="ml-auto size-3.5 shrink-0 text-destructive" aria-label="Did not compile" />}
                    </button>
                    {sources.map((x) => (
                      <button
                        key={x.name}
                        type="button"
                        onClick={() => openSource(f.path, x.name)}
                        className={cn('ml-4 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors', sel?.path === f.path && sel.source === x.name ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted')}
                      >
                        <Box className="size-3.5 shrink-0 opacity-60" />
                        <span className="truncate font-mono">{x.name}</span>
                        <span className="ml-auto text-[11px] tabular-nums opacity-60">{x.fields.filter((y) => !y.column).length}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
              {big.map((f) => (
                <div key={f.path} className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs text-muted-foreground" title={`${formatBytes(f.size)}: over the size this tab reads`}>
                  <FileWarning className="size-3.5 shrink-0 text-warning" />
                  <span className="truncate">{f.path}</span>
                </div>
              ))}
              {!shown.length && <p className="px-2 text-sm text-muted-foreground">Nothing matches.</p>}
            </div>
          </Card>

          {sel && model && file ? (
            <ModelPanel
              path={sel.path}
              file={file}
              model={model}
              compile={compiled[sel.path]}
              parsed={parsed}
              source={sel.source}
              status={status}
              bench={bench}
              view={view}
              setView={setView}
              focus={focus}
              goTo={goTo}
              openSource={openSource}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

// --- One model ---------------------------------------------------------------

interface PanelProps {
  path: string
  file: MalloyFile
  model: MalloyViewModel
  compile?: { result?: MalloyCompiled; error?: string }
  parsed: MalloyModel[]
  source?: string
  status: MalloyStatus
  bench: MalloyBench
  view: View
  setView: (v: View) => void
  focus?: { line: number; key: number }
  goTo: (line: number, file?: string) => void
  openSource: (path: string, source?: string) => void
}

function ModelPanel({ path, file, model, compile, parsed, source, status, bench, view, setView, focus, goTo, openSource }: PanelProps) {
  const src = source ? model.sources.find((x) => x.name === source) : undefined
  const own = model.sources.filter((x) => !x.imported)
  const starter = useMemo(() => malloyStarterQuery(model), [model])
  const problems = compile?.result?.problems ?? []
  const onProblem = (p: MalloyProblem) => p.line !== undefined && goTo(p.line, p.file ?? path)
  const toBench = (query: string, run?: boolean) => {
    setView('workbench')
    if (run) void bench.call(path, status.run ? 'run' : 'sql', query)
    else bench.patch(path, { query })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Malloy model</span>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-xl font-semibold break-all">{path}</h2>
          <CompileBadge compile={compile} />
        </div>
        <span className="text-sm text-muted-foreground">
          {own.length} sources · {model.queries.length} queries{file.size ? ` · ${formatBytes(file.size)}` : ''}
          {file.modifiedAt ? ` · changed ${formatRelative(file.modifiedAt)}` : ''}
        </span>
      </div>

      {compile?.error && <p className="rounded-lg bg-destructive-soft/60 px-3 py-2 text-sm text-destructive-soft-foreground">{compile.error}</p>}
      {problems.length > 0 && (
        <div className="flex flex-col gap-2">
          <MalloyProblems problems={problems} onLine={onProblem} />
          {model.from === 'read' && <p className="text-xs text-muted-foreground">Until it compiles, the outline below is what MonoRail could read from the file itself; types and table columns are missing.</p>}
        </div>
      )}

      <Segmented<View>
        className="w-fit"
        aria-label="What to show"
        value={view}
        onChange={setView}
        options={[
          { value: 'workbench', label: 'Workbench' },
          { value: 'outline', label: src ? `Source: ${src.name}` : `Sources ${own.length}` },
          { value: 'text', label: 'Source text' },
        ]}
      />

      {view === 'workbench' && <MalloyWorkbench path={path} model={model} status={status} bench={bench} starter={starter} />}

      {view === 'outline' &&
        (src ? (
          <SourceDetail key={`${path}:${src.name}`} path={path} source={src} model={model} parsed={parsed} goTo={goTo} openSource={openSource} toBench={toBench} />
        ) : (
          <ModelOutline path={path} model={model} goTo={goTo} openSource={openSource} toBench={toBench} />
        ))}

      {view === 'text' && file.text !== undefined && <MalloyCode text={file.text} mark={src && !src.imported && src.line ? [src.line, src.endLine ?? src.line] : undefined} focus={focus} className="max-h-[640px]" />}
    </div>
  )
}

function CompileBadge({ compile }: { compile?: { result?: MalloyCompiled; error?: string } }) {
  if (!compile) {
    return (
      <Badge variant="secondary">
        <Loader2 className="animate-spin" /> Compiling
      </Badge>
    )
  }
  if (compile.result?.ok) {
    return (
      <Badge variant="success" title="Sources, fields and types come from the Malloy compiler">
        <CheckCircle2 /> Compiled
      </Badge>
    )
  }
  const n = compile.result?.problems.filter((p) => p.severity === 'error').length ?? 0
  return (
    <Badge variant="destructive" title="Showing what MonoRail could read from the file itself">
      <AlertTriangle /> {n ? `${n} problem${n === 1 ? '' : 's'}` : 'Not compiled'}
    </Badge>
  )
}

function ModelOutline({ path, model, goTo, openSource, toBench }: { path: string; model: MalloyViewModel; goTo: (line: number, file?: string) => void; openSource: (path: string, source?: string) => void; toBench: (q: string, run?: boolean) => void }) {
  const own = model.sources.filter((s) => !s.imported)
  const imported = model.sources.filter((s) => s.imported)
  const row = (s: MalloyViewSource) => (
    <button key={s.name} type="button" onClick={() => openSource(s.imported && s.file ? s.file : path, s.name)} className="flex items-center gap-3 py-2 text-left first:pt-0 last:pb-0 hover:text-primary">
      <Box className="size-4 text-muted-foreground" />
      <span className="flex min-w-0 flex-col">
        <span className="font-mono text-sm font-medium">{s.name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{s.table ?? (s.extends ? `extends ${s.extends}` : s.imported ? `from ${s.file}` : '')}</span>
      </span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{s.fields.filter((f) => !f.column).length} fields</span>
    </button>
  )
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
          <CardDescription>A source is a table (or another source) with keys, joins, dimensions, measures and views.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col divide-y">
            {own.map(row)}
            {!own.length && <span className="text-sm text-muted-foreground">No sources in this file.</span>}
          </div>
          {imported.length > 0 && (
            <div>
              <Overline>Imported</Overline>
              <div className="flex flex-col divide-y">{imported.map(row)}</div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Named queries</CardTitle>
          <CardDescription>Queries the file defines with query:. Run one with run: and its name.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {model.queries.map((q) => (
            <div key={q.name} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 font-mono text-sm font-medium">
                {q.name}
                {q.line !== undefined && (
                  <button type="button" className="text-xs font-normal text-muted-foreground hover:underline" onClick={() => goTo(q.line!, path)}>
                    line {q.line}
                  </button>
                )}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => toBench(`run: ${malloyName(q.name)}`, true)}>
                  <Play /> Run
                </Button>
              </span>
              {q.expr && <span className="font-mono text-xs break-all text-muted-foreground">{q.expr}</span>}
            </div>
          ))}
          {!model.queries.length && <span className="text-sm text-muted-foreground">No named queries.</span>}
        </CardContent>
      </Card>
    </div>
  )
}

// --- One source ----------------------------------------------------------------

type SourceView = 'fields' | 'joins'

const KINDS: { kind: MalloyViewField['kind']; label: string; icon: typeof Tag; help: string }[] = [
  { kind: 'dimension', label: 'Dimensions', icon: Tag, help: 'Values to group by and filter on.' },
  { kind: 'measure', label: 'Measures', icon: Sigma, help: 'Aggregates: sums, counts, averages and expressions over them.' },
  { kind: 'view', label: 'Views', icon: Table2, help: 'Saved queries on this source, run as source -> view.' },
]

function SourceDetail({
  path,
  source: s,
  model,
  parsed,
  goTo,
  openSource,
  toBench,
}: {
  path: string
  source: MalloyViewSource
  model: MalloyViewModel
  parsed: MalloyModel[]
  goTo: (line: number, file?: string) => void
  openSource: (path: string, source?: string) => void
  toBench: (q: string, run?: boolean) => void
}) {
  const [view, setView] = useState<SourceView>('fields')
  const defined = s.fields.filter((f) => !f.column)
  const columns = s.fields.filter((f) => f.column)
  const parent = s.extends ? findSource(parsed, s.extends, path) : undefined
  const extendedBy = parsed.flatMap((m) => m.sources.filter((x) => x.extends === s.name).map((x) => ({ path: m.path, name: x.name })))
  const where = s.file ?? path
  const open = (name?: string) => {
    if (!name) return undefined
    const inModel = model.sources.find((x) => x.name === name)
    if (inModel) return () => openSource(inModel.imported && inModel.file ? inModel.file : path, name)
    const found = findSource(parsed, name, path)
    return found ? () => openSource(found.model.path, found.source.name) : undefined
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Malloy source {s.imported && <Badge variant="outline">Imported</Badge>}
          </span>
          <h3 className="font-mono text-lg font-semibold">{s.name}</h3>
          {s.description && <p className="max-w-3xl text-sm text-muted-foreground">{s.description}</p>}
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => toBench(malloyStarterQuery(model, s.name))}>
          <Play /> Query this source
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <Overline>{s.extends ? 'Extends' : 'Table'}</Overline>
            {s.extends ? (
              parent ? (
                <button type="button" className="flex items-center gap-1.5 font-mono text-sm hover:underline" onClick={() => openSource(parent.model.path, parent.source.name)}>
                  <Box className="size-3.5 text-muted-foreground" /> {s.extends}
                </button>
              ) : (
                <span className="font-mono text-sm">{s.extends}</span>
              )
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm" title={s.table}>
                <Database className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.table ?? '—'}</span>
              </span>
            )}
            {s.extends && s.table && <span className="block truncate font-mono text-xs text-muted-foreground">{s.table}</span>}
            {s.connection && <span className="text-xs text-muted-foreground">on connection {s.connection}</span>}
          </div>
          <div>
            <Overline>Primary key</Overline>
            <span className="flex items-center gap-1.5 font-mono text-sm">
              <KeyRound className="size-3.5 text-muted-foreground" />
              {s.primaryKey ?? <span className="text-muted-foreground">None</span>}
            </span>
          </div>
          <div className="min-w-0">
            <Overline>Defined in</Overline>
            {s.line !== undefined ? (
              <button type="button" className="truncate font-mono text-sm hover:underline" onClick={() => goTo(s.line!, where)} title="Show in the source text">
                {where}:{s.line}
              </button>
            ) : (
              <span className="font-mono text-sm">{where}</span>
            )}
          </div>
          <div>
            <Overline>Fields</Overline>
            <span className="text-sm tabular-nums">
              {KINDS.map((k) => `${defined.filter((f) => f.kind === k.kind).length} ${k.label.toLowerCase()}`).join(' · ')}
              {columns.length > 0 && ` · ${columns.length} columns`}
            </span>
          </div>
        </CardContent>
      </Card>

      <Segmented<SourceView>
        className="w-fit"
        aria-label="Fields or joins"
        value={view}
        onChange={setView}
        options={[
          { value: 'fields', label: `Fields ${defined.length}` },
          { value: 'joins', label: `Joins ${s.joins.length}` },
        ]}
      />

      {view === 'fields' && (
        <div className="flex flex-col gap-6">
          {KINDS.map((k) => {
            const list = defined.filter((f) => f.kind === k.kind)
            if (!list.length) return null
            return (
              <Card key={k.kind} className="gap-0 py-0">
                <CardHeader className="px-6 py-4">
                  <CardTitle className="flex items-center gap-2">
                    <k.icon className="size-4 text-muted-foreground" /> {k.label} <span className="text-sm font-normal text-muted-foreground tabular-nums">{list.length}</span>
                  </CardTitle>
                  <CardDescription>{k.help}</CardDescription>
                </CardHeader>
                <div className="flex flex-col divide-y border-t">
                  {list.map((f) => (
                    <FieldRow key={f.name} field={f} path={where} onLine={goTo} onRun={f.kind === 'view' ? () => toBench(`run: ${malloyName(s.name)} -> ${malloyName(f.name)}`, true) : undefined} />
                  ))}
                </div>
              </Card>
            )
          })}
          {columns.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="px-6 py-4">
                <CardTitle className="flex items-center gap-2">
                  <Columns3 className="size-4 text-muted-foreground" /> Table columns <span className="text-sm font-normal text-muted-foreground tabular-nums">{columns.length}</span>
                </CardTitle>
                <CardDescription>Columns the compiler read from BigQuery. Each is a dimension too.</CardDescription>
              </CardHeader>
              <div className="flex flex-wrap gap-1.5 border-t px-6 py-4">
                {columns.map((c) => (
                  <Badge key={c.name} variant="secondary" className="font-mono text-[11px]" title={c.description}>
                    {c.name} <span className="opacity-60">{c.type}</span>
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {!defined.length && !columns.length && (
            <Card>
              <Empty icon={Tag} title="No fields of its own">
                {s.extends ? `It uses every field of ${s.extends}.` : 'Every column of the table can still be used as a dimension.'}
              </Empty>
            </Card>
          )}
        </div>
      )}

      {view === 'joins' && (
        <Card className="gap-0 py-0">
          {s.joins.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Join</th>
                    <th className="px-3 py-2 font-medium">Kind</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">On</th>
                    <th className="px-3 py-2 text-right font-medium">Fields</th>
                    <th className="px-6 py-2 font-medium">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {s.joins.map((j) => {
                    const go = open(j.source)
                    return (
                      <tr key={j.name} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-6 py-2 font-mono text-xs">{j.name}</td>
                        <td className="px-3 py-2">
                          {j.relationship && (
                            <Badge variant={j.relationship === 'many' ? 'primary' : 'secondary'} className="font-mono">
                              join_{j.relationship}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {go ? (
                            <button type="button" className="hover:underline" onClick={go}>
                              {j.source}
                            </button>
                          ) : (
                            <span title={j.tablePath}>{j.source ?? j.tablePath ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{j.on ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{j.fields?.length ?? '—'}</td>
                        <td className="px-6 py-2">
                          {j.line !== undefined && (
                            <button type="button" className="font-mono text-xs text-muted-foreground hover:underline" onClick={() => goTo(j.line!, j.file ?? where)}>
                              {j.line}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Network} title="No joins">
              join_one:, join_many: and join_cross: bring other sources into this one.
            </Empty>
          )}
          {extendedBy.length > 0 && (
            <p className="border-t px-6 py-3 text-xs text-muted-foreground">
              Extended by{' '}
              {extendedBy.map((x, i) => (
                <span key={`${x.path}:${x.name}`}>
                  {i > 0 && ', '}
                  <button type="button" className="font-mono text-foreground hover:underline" onClick={() => openSource(x.path, x.name)}>
                    {x.name}
                  </button>
                </span>
              ))}
              .
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function FieldRow({ field: f, path, onLine, onRun }: { field: MalloyViewField; path: string; onLine: (line: number, file?: string) => void; onRun?: () => void }) {
  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{f.name}</span>
        {f.type && (
          <Badge variant="outline" className="font-mono text-[11px]">
            {f.type}
          </Badge>
        )}
        {f.kind === 'measure' && f.definition && /\{\s*where:/.test(f.definition) && <Badge variant="info">filtered</Badge>}
        <span className="ml-auto flex items-center gap-2">
          {onRun && (
            <Button variant="ghost" size="sm" onClick={onRun}>
              <Play /> Run
            </Button>
          )}
          {f.line !== undefined && (
            <button type="button" className="font-mono text-xs text-muted-foreground hover:underline" onClick={() => onLine(f.line!, f.file ?? path)} title="Show in the source text">
              line {f.line}
            </button>
          )}
        </span>
      </div>
      {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
      {f.definition && <MalloyCode text={f.definition} numbers={false} className="py-2" />}
    </div>
  )
}
