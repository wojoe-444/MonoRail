import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Box, Database, FileCode2, KeyRound, Loader2, Network, RefreshCw, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

import { openTab } from '../../tabs'
import { openInMalloyQuery, takeMalloySource } from './handoff'
import type { MalloyModel } from './malloy'
import type { OutlineField } from './malloyClient'
import { Empty, Fact, Overline } from './parts'
import { MalloyBlockedCard } from './malloyBlocked'
import { blockedReason, countKinds, useMalloyModels, type MalloyModelsState, type MalloySourceEntry } from './useMalloyModels'

/**
 * The Malloy engine's Semantic models: every source in every model file, as
 * the Malloy compiler outlines it, then one source's table, key, joins and
 * fields. Read-only; "Query this source" hands it to the Query builder.
 */
export function MalloySemanticModels() {
  const state = useMalloyModels()
  const [open, setOpen] = useState<string | undefined>(() => {
    const s = takeMalloySource()
    return s && `${s.path}:${s.source}`
  })

  const { status, listing, error, loading, reload } = state
  if (loading || (!status && !error)) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Reading the Malloy models…
      </div>
    )
  }
  if (!status || !listing) return <p className="text-sm text-destructive">{error ?? 'The Malloy models could not be read.'}</p>
  const block = status.block ?? listing.block
  if (block) return <MalloyBlockedCard reason={blockedReason(block)!} onRetry={reload} />

  const entry = open ? (state.sources.find((s) => s.key === open) ?? state.sources.find((s) => s.source.name === open.split(':').pop())) : undefined
  if (entry) return <SourceDetail key={entry.key} entry={entry} state={state} onBack={() => setOpen(undefined)} onOpen={setOpen} />
  return <SourceGrid state={state} onOpen={setOpen} />
}

// --- Strip and problems ----------------------------------------------------

export function MalloyStrip({ state }: { state: MalloyModelsState }) {
  const { status, listing, sources, compiling, reload } = state
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Badge variant="secondary" className="font-mono">
        <FileCode2 /> {status?.folderName ?? listing?.folderName ?? 'Models'}
      </Badge>
      <span className="tabular-nums">{listing?.files.length ?? 0} model files</span>
      <span className="text-foreground/20">·</span>
      <span className="tabular-nums">{sources.length} sources</span>
      {status?.project && (
        <>
          <span className="text-foreground/20">·</span>
          <span>
            Billed to <span className="font-mono text-xs">{status.project}</span>
          </span>
        </>
      )}
      <span className="ml-auto flex items-center gap-3 text-xs">
        {status?.run ? (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success" /> Runs on BigQuery
          </Badge>
        ) : (
          <Badge variant="secondary" title="Turn on “Run queries on BigQuery” in Malloy settings">
            Queries off
          </Badge>
        )}
        {compiling > 0 && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" /> Compiling {compiling} {compiling === 1 ? 'file' : 'files'}
          </span>
        )}
        <Button variant="ghost" size="sm" disabled={compiling > 0} onClick={reload} title="Lists and compiles the model files again">
          <RefreshCw /> Reload
        </Button>
      </span>
    </div>
  )
}

export function MalloyFileProblems({ state }: { state: MalloyModelsState }) {
  const files = Object.entries(state.compiled).filter(([, c]) => c.problems.some((p) => p.severity === 'error') || (!c.ok && c.block))
  const big = state.listing?.files.filter((f) => f.tooLarge) ?? []
  if (!files.length && !big.length && !state.listing?.truncated) return null
  return (
    <Card className="gap-3 px-6 py-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4 text-warning" /> Some model files did not compile
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {files.map(([path, c]) => (
          <li key={path} className="flex flex-col gap-0.5">
            <span className="font-mono text-xs">{path}</span>
            {c.block === 'no-gcloud' && <span className="text-muted-foreground">No Google Cloud login: Malloy could not read the table schemas.</span>}
            {c.problems
              .filter((p) => p.severity === 'error')
              .slice(0, 5)
              .map((p, i) => (
                <span key={i} className="text-muted-foreground">
                  {p.line ? <span className="font-mono text-xs">{`${p.file && p.file !== path ? `${p.file}:` : 'line '}${p.line}: `}</span> : null}
                  {p.message}
                </span>
              ))}
          </li>
        ))}
        {big.map((f) => (
          <li key={f.path} className="text-muted-foreground">
            <span className="font-mono text-xs text-foreground">{f.path}</span> is too large to read.
          </li>
        ))}
        {state.listing?.truncated && <li className="text-muted-foreground">The folder has more model files than MonoRail lists; some are left out.</li>}
      </ul>
    </Card>
  )
}

// --- Grid ------------------------------------------------------------------

function SourceGrid({ state, onOpen }: { state: MalloyModelsState; onOpen: (key: string) => void }) {
  const [search, setSearch] = useState('')
  const s = search.trim().toLowerCase()
  const list = state.sources.filter(({ source: x, path }) => !s || [x.name, x.description, x.tablePath, path].some((v) => v?.toLowerCase().includes(s)) || x.fields.some((f) => f.name.toLowerCase().includes(s)))

  return (
    <div className="flex flex-col gap-6">
      <MalloyStrip state={state} />
      <MalloyFileProblems state={state} />
      {!state.sources.length ? (
        <Card>
          {state.compiling > 0 ? (
            <Empty icon={Loader2} title="Compiling the model files…" />
          ) : (
            <Empty icon={Network} title="No Malloy sources">
              Sources defined in the .malloy files of the models folder show up here.
            </Empty>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchField className="w-full max-w-xs" aria-label="Search sources" placeholder="Search sources" value={search} onChange={(e) => setSearch(e.target.value)} />
            <p className="text-sm text-muted-foreground">Each source is a table with dimensions to group by, measures to aggregate, views and joins.</p>
          </div>
          {list.length ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {list.map((e) => (
                <SourceCard key={e.key} entry={e} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No source matches “{search}”.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SourceCard({ entry, onOpen }: { entry: MalloySourceEntry; onOpen: (key: string) => void }) {
  const s = entry.source
  const n = countKinds(s.fields)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">
          <button type="button" className="hover:underline" onClick={() => onOpen(entry.key)}>
            {s.name}
          </button>
        </CardTitle>
        <CardDescription className="line-clamp-2">{s.description ?? 'No description'}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => onOpen(entry.key)}>
            Open <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Overline>Table</Overline>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
              <Database className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate" title={s.tablePath}>
                {s.tablePath ?? '—'}
              </span>
            </span>
          </div>
          <div>
            <Overline>Primary key</Overline>
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <KeyRound className="size-3.5 text-muted-foreground" />
              {s.primaryKey ?? <span className="text-muted-foreground">None</span>}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          <Count n={n.dimension} label="dimensions" />
          <Count n={n.measure} label="measures" />
          <Count n={n.view} label="views" />
          <Count n={n.join} label="joins" />
        </div>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <FileCode2 className="size-3.5 shrink-0" />
          <span className="truncate font-mono">{entry.path}</span>
        </span>
      </CardContent>
    </Card>
  )
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-medium">{n}</span> <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

// --- Detail ----------------------------------------------------------------

type Section = 'dimension' | 'measure' | 'view'
const SECTION_LABEL: Record<Section, string> = { dimension: 'Dimensions', measure: 'Measures', view: 'Views' }

function SourceDetail({ entry, state, onBack, onOpen }: { entry: MalloySourceEntry; state: MalloyModelsState; onBack: () => void; onOpen: (key: string) => void }) {
  const s = entry.source
  const n = countKinds(s.fields)
  const [section, setSection] = useState<Section>(n.dimension ? 'dimension' : n.measure ? 'measure' : 'view')
  const joins = s.fields.filter((f) => f.kind === 'join')
  const parsed = useMemo(() => definitionsOf(state.parsed, entry), [state.parsed, entry])
  const fields = s.fields.filter((f) => f.kind === section)

  const targetOf = (j: OutlineField) => {
    const name = j.source ?? j.name
    return state.sources.find((x) => x.source.name === name && x.path === entry.path) ?? state.sources.find((x) => x.source.name === name)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" aria-label="All sources" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Malloy source</span>
          <h2 className="font-mono text-xl font-semibold">{s.name}</h2>
          {s.description && <p className="max-w-3xl text-sm text-muted-foreground">{s.description}</p>}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openTab('malloy')}>
            <FileCode2 /> Open in Malloy models
          </Button>
          <Button onClick={() => openInMalloyQuery({ path: entry.path, source: s.name })}>
            <SlidersHorizontal /> Query this source
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Table" value={s.tablePath ?? '—'} mono />
        <Fact label="Primary key" value={s.primaryKey ?? 'None'} mono />
        <Fact label="Connection" value={s.connection ?? '—'} mono />
        <Fact label="File" value={`${entry.path}${s.line ? `:${s.line}` : ''}`} mono />
      </div>

      {joins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Joins</CardTitle>
            <CardDescription>Sources joined in, whose fields this source can use as join.field.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {joins.map((j) => {
                const target = targetOf(j)
                return (
                  <li key={j.name} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <Network className="size-4 text-muted-foreground" />
                    <span className="font-mono">{j.name}</span>
                    <Badge variant="secondary">{relationshipLabel(j.relationship)}</Badge>
                    <span className="text-muted-foreground">→</span>
                    {target ? (
                      <button type="button" className="font-mono text-primary hover:underline" onClick={() => onOpen(target.key)}>
                        {target.source.name}
                      </button>
                    ) : (
                      <span className="font-mono">{j.source ?? j.name}</span>
                    )}
                    {(j.tablePath ?? target?.source.tablePath) && <span className="font-mono text-xs text-muted-foreground">{j.tablePath ?? target?.source.tablePath}</span>}
                    {j.description && <span className="w-full pl-7 text-muted-foreground">{j.description}</span>}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
          <Segmented
            aria-label="Field kind"
            value={section}
            onChange={setSection}
            options={(['dimension', 'measure', 'view'] as Section[]).map((k) => ({ value: k, label: `${SECTION_LABEL[k]} ${n[k]}` }))}
          />
        </div>
        {fields.length ? (
          <ul className="divide-y">
            {fields.map((f) => {
              const def = parsed.get(f.name)
              return (
                <li key={f.name} className="flex flex-col gap-1.5 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{f.name}</span>
                    {f.type && (
                      <Badge variant={f.kind === 'measure' ? 'primary' : 'secondary'} className="font-mono text-[11px]">
                        {f.type}
                      </Badge>
                    )}
                    {f.line && <span className="ml-auto font-mono text-xs text-muted-foreground">line {f.line}</span>}
                  </div>
                  {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                  {def && <pre className={cn('max-h-40 overflow-auto rounded-md bg-muted/40 px-3 py-2 font-mono text-xs whitespace-pre-wrap ring-1 ring-foreground/10')}>{def}</pre>}
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty icon={Box} title={`No ${SECTION_LABEL[section].toLowerCase()}`} />
        )}
      </Card>
    </div>
  )
}

function relationshipLabel(r?: string) {
  if (r === 'one') return 'join one'
  if (r === 'many') return 'join many'
  if (r === 'cross') return 'join cross'
  return r ?? 'join'
}

/** Definition text per field name, from the tolerant reader's view of the source's file. */
function definitionsOf(models: MalloyModel[], entry: MalloySourceEntry): Map<string, string> {
  const file = entry.source.file ?? entry.path
  const src = models.find((m) => m.path === file)?.sources.find((x) => x.name === entry.source.name) ?? models.flatMap((m) => m.sources).find((x) => x.name === entry.source.name)
  return new Map((src?.fields ?? []).map((f) => [f.name, f.definition]))
}
