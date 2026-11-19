import { useMemo, useState } from 'react'
import { Box, Database, FileCode2, FileWarning, KeyRound, Loader2, Network, RefreshCw, Sigma, Table2, Tag } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { formatBytes, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isDesktop, useModuleQuery } from '@/modules/client'

import { findSource, parseMalloy, type MalloyField, type MalloyFieldKind, type MalloyModel, type MalloySource } from './semantic/malloy'
import { MalloyCode } from './semantic/MalloyCode'
import { sampleListing } from './semantic/malloySample'
import type { MalloyFile, MalloyListing } from './semantic/malloyTypes'
import { Empty, Overline } from './semantic/parts'
import { BlockedCard } from './semantic/project'
import type { OmTabProps } from './types'

/**
 * A read-only browser for the Malloy files in the MetricFlow connection's
 * project folder (Semantic backend `malloyModels`). MonoRail runs no Malloy:
 * each file is parsed here by a small tolerant reader and shown next to its
 * text. Nothing is read until the MetricFlow connection is added.
 */
export default function MalloyTab(_props: OmTabProps) {
  const q = useModuleQuery<MalloyListing>('semantic', 'malloyModels')
  const listing = isDesktop() ? q.data : sampleListing
  const error = q.error?.message
  const fetching = q.fetching
  const load = () => q.refresh()

  if (!listing) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? error : (<><Loader2 className="size-4 animate-spin" /> Looking for Malloy files…</>)}
      </div>
    )
  }
  if (listing.block === 'not-set-up') {
    return (
      <BlockedCard
        block="not-set-up"
        onRetry={() => void load()}
        body="This tab shows the Malloy files (.malloy) kept in your dbt project folder. It reads the folder of the MetricFlow connection, so add that connection on Connections first. Until then MonoRail looks at nothing. MonoRail never runs Malloy: it only shows what the files define."
      />
    )
  }
  if (listing.block === 'no-project') return <BlockedCard block="no-project" onRetry={() => void load()} body="The folder in the MetricFlow connection was not found. Pick it again on Connections." />

  return <MalloyBrowser listing={listing} fetching={fetching} onReload={() => void load()} />
}

function MalloyBrowser({ listing, fetching, onReload }: { listing: MalloyListing; fetching: boolean; onReload: () => void }) {
  const models = useMemo(() => listing.files.filter((f) => f.text !== undefined).map((f) => parseMalloy(f.path, f.text!)), [listing])
  const big = listing.files.filter((f) => f.tooLarge)
  const sourceCount = models.reduce((n, m) => n + m.sources.length, 0)
  const first = models.find((m) => m.sources.length) ?? models[0]
  const [sel, setSel] = useState<{ path: string; source?: string } | undefined>(first && { path: first.path, source: first.sources[0]?.name })
  const [search, setSearch] = useState('')

  const model = models.find((m) => m.path === sel?.path)
  const source = model?.sources.find((s) => s.name === sel?.source)
  const file = listing.files.find((f) => f.path === sel?.path)
  const s = search.trim().toLowerCase()
  const shown = models
    .map((m) => ({ m, sources: m.sources.filter((x) => !s || x.name.toLowerCase().includes(s) || m.path.toLowerCase().includes(s) || x.fields.some((f) => f.name.toLowerCase().includes(s))) }))
    .filter((x) => !s || x.sources.length || x.m.path.toLowerCase().includes(s))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="font-mono">
          <FileCode2 /> {listing.folderName ?? 'Project'}
        </Badge>
        <span className="tabular-nums">{listing.files.length} Malloy files</span>
        <span className="text-foreground/20">·</span>
        <span className="tabular-nums">{sourceCount} sources</span>
        <span className="text-foreground/20">·</span>
        <span>Read only: MonoRail shows what the files define and runs no Malloy</span>
        <span className="ml-auto flex items-center gap-3 text-xs">
          <span>Read {formatRelative(listing.readAt)}</span>
          <Button variant="ghost" size="sm" disabled={!isDesktop() || fetching} onClick={onReload} title="Read the .malloy files again">
            {fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reload
          </Button>
        </span>
      </div>

      {listing.truncated && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">The folder holds more than this tab reads (200 files). Only the first ones found are shown.</p>
      )}

      {!listing.files.length ? (
        <Card>
          <Empty icon={FileCode2} title={`No Malloy files in ${listing.folderName ?? 'the project folder'}`}>
            .malloy files anywhere in the MetricFlow connection&apos;s project folder show up here (folders starting with a dot, node_modules and target are skipped).
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[300px_1fr]">
          <Card className="gap-3 py-4">
            <div className="px-4">
              <SearchField size="sm" aria-label="Search Malloy sources" placeholder="Search sources and fields" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex flex-col gap-3 px-2">
              {shown.map(({ m, sources }) => (
                <div key={m.path} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setSel({ path: m.path })}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors', sel?.path === m.path && !sel.source ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted')}
                    title={m.path}
                  >
                    <FileCode2 className="size-3.5 shrink-0" />
                    <span className="truncate">{m.path}</span>
                  </button>
                  {sources.map((x) => (
                    <button
                      key={x.name}
                      type="button"
                      onClick={() => setSel({ path: m.path, source: x.name })}
                      className={cn('ml-4 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors', sel?.path === m.path && sel.source === x.name ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted')}
                    >
                      <Box className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate font-mono">{x.name}</span>
                      <span className="ml-auto text-[11px] tabular-nums opacity-60">{x.fields.length}</span>
                    </button>
                  ))}
                </div>
              ))}
              {big.map((f) => (
                <div key={f.path} className="flex items-center gap-2 px-2 py-1.5 font-mono text-xs text-muted-foreground" title={`${formatBytes(f.size)}: over the 512 KB this tab reads`}>
                  <FileWarning className="size-3.5 shrink-0 text-warning" />
                  <span className="truncate">{f.path}</span>
                </div>
              ))}
              {!shown.length && <p className="px-2 text-sm text-muted-foreground">Nothing matches.</p>}
            </div>
          </Card>

          {model && source ? (
            <SourceDetail key={`${model.path}:${source.name}`} model={model} source={source} file={file} models={models} onOpen={(path, name) => setSel({ path, source: name })} />
          ) : model ? (
            <FileOverview key={model.path} model={model} file={file} onOpen={(name) => setSel({ path: model.path, source: name })} />
          ) : null}
        </div>
      )}
    </div>
  )
}

// --- One file --------------------------------------------------------------

function FileOverview({ model, file, onOpen }: { model: MalloyModel; file?: MalloyFile; onOpen: (source: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Malloy model</span>
        <h2 className="font-mono text-xl font-semibold break-all">{model.path}</h2>
        <span className="text-sm text-muted-foreground">
          {model.sources.length} sources · {model.queries.length} queries{file?.size ? ` · ${formatBytes(file.size)}` : ''}
          {file?.modifiedAt ? ` · changed ${formatRelative(file.modifiedAt)}` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>A source is a table (or another source) with keys, joins, dimensions, measures and views.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {model.sources.map((s) => (
              <button key={s.name} type="button" onClick={() => onOpen(s.name)} className="flex items-center gap-3 py-2 text-left first:pt-0 last:pb-0 hover:text-primary">
                <Box className="size-4 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-sm font-medium">{s.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{s.table ?? (s.extends ? `extends ${s.extends}` : s.base)}</span>
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{s.fields.length} fields</span>
              </button>
            ))}
            {!model.sources.length && <span className="text-sm text-muted-foreground">No sources in this file.</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Queries and imports</CardTitle>
            <CardDescription>Named queries the file defines and the files it imports.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {model.queries.map((q) => (
              <div key={q.name} className="flex flex-col gap-1">
                <span className="font-mono text-sm font-medium">
                  {q.name} <span className="text-xs font-normal text-muted-foreground">line {q.line}</span>
                </span>
                <span className="font-mono text-xs break-all text-muted-foreground">{q.expr}</span>
              </div>
            ))}
            {!model.queries.length && <span className="text-sm text-muted-foreground">No named queries.</span>}
            {model.imports.length > 0 && (
              <div>
                <Overline>Imports</Overline>
                <div className="flex flex-wrap gap-1.5">
                  {model.imports.map((i) => (
                    <Badge key={i} variant="outline" className="font-mono">
                      {i}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {file?.text !== undefined && <MalloyCode text={file.text} className="max-h-[560px]" />}
    </div>
  )
}

// --- One source ------------------------------------------------------------

type View = 'fields' | 'joins' | 'source'

const KINDS: { kind: MalloyFieldKind; label: string; icon: typeof Tag; help: string }[] = [
  { kind: 'dimension', label: 'Dimensions', icon: Tag, help: 'Values to group by and filter on. Every column of the table is a dimension too.' },
  { kind: 'measure', label: 'Measures', icon: Sigma, help: 'Aggregates: sums, counts, averages and expressions over them.' },
  { kind: 'view', label: 'Views', icon: Table2, help: 'Saved queries on this source, run as source -> view.' },
]

function SourceDetail({ model, source: s, file, models, onOpen }: { model: MalloyModel; source: MalloySource; file?: MalloyFile; models: MalloyModel[]; onOpen: (path: string, source: string) => void }) {
  const [view, setView] = useState<View>('fields')
  const [focus, setFocus] = useState<{ line: number; key: number }>({ line: s.line, key: 0 })
  const parent = s.extends ? findSource(models, s.extends, model.path) : undefined
  const extendedBy = models.flatMap((m) => m.sources.filter((x) => x.extends === s.name).map((x) => ({ path: m.path, name: x.name })))
  const goTo = (line: number) => {
    setView('source')
    setFocus({ line, key: Date.now() })
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Malloy source</span>
        <h2 className="font-mono text-xl font-semibold">{s.name}</h2>
        {s.description && <p className="max-w-3xl text-sm text-muted-foreground">{s.description}</p>}
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <Overline>{s.extends ? 'Extends' : 'Table'}</Overline>
            {s.extends ? (
              parent ? (
                <button type="button" className="flex items-center gap-1.5 font-mono text-sm hover:underline" onClick={() => onOpen(parent.model.path, parent.source.name)}>
                  <Box className="size-3.5 text-muted-foreground" /> {s.extends}
                </button>
              ) : (
                <span className="font-mono text-sm">{s.extends}</span>
              )
            ) : (
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm" title={s.base}>
                <Database className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.table ?? s.base}</span>
              </span>
            )}
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
            <button type="button" className="truncate font-mono text-sm hover:underline" onClick={() => goTo(s.line)} title="Show in the source text">
              {model.path}:{s.line}
            </button>
          </div>
          <div>
            <Overline>Fields</Overline>
            <span className="text-sm tabular-nums">
              {KINDS.map((k) => `${s.fields.filter((f) => f.kind === k.kind).length} ${k.label.toLowerCase()}`).join(' · ')}
            </span>
          </div>
        </CardContent>
      </Card>

      <Segmented<View>
        className="w-fit"
        aria-label="What to show"
        value={view}
        onChange={setView}
        options={[
          { value: 'fields', label: `Fields ${s.fields.length}` },
          { value: 'joins', label: `Joins ${s.joins.length}` },
          { value: 'source', label: 'Source text' },
        ]}
      />

      {view === 'fields' &&
        (s.fields.length ? (
          <div className="flex flex-col gap-6">
            {KINDS.map((k) => {
              const list = s.fields.filter((f) => f.kind === k.kind)
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
                      <FieldRow key={f.name} field={f} onLine={goTo} />
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card>
            <Empty icon={Tag} title="No fields of its own">
              {s.extends ? `It uses every field of ${s.extends}.` : 'Every column of the table can still be used as a dimension.'}
            </Empty>
          </Card>
        ))}

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
                    <th className="px-6 py-2 font-medium">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {s.joins.map((j) => {
                    const target = findSource(models, j.target, model.path)
                    return (
                      <tr key={j.name} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-6 py-2 font-mono text-xs">{j.name}</td>
                        <td className="px-3 py-2">
                          <Badge variant={j.kind === 'many' ? 'primary' : 'secondary'} className="font-mono">
                            join_{j.kind}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {target ? (
                            <button type="button" className="hover:underline" onClick={() => onOpen(target.model.path, target.source.name)}>
                              {j.target}
                            </button>
                          ) : (
                            <span title="Not defined in the files MonoRail read">{j.target}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{j.on ?? (j.with ? `with ${j.with}` : '—')}</td>
                        <td className="px-6 py-2">
                          <button type="button" className="font-mono text-xs text-muted-foreground hover:underline" onClick={() => goTo(j.line)}>
                            {j.line}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {extendedBy.length > 0 && (
                <p className="border-t px-6 py-3 text-xs text-muted-foreground">
                  Extended by{' '}
                  {extendedBy.map((x, i) => (
                    <span key={`${x.path}:${x.name}`}>
                      {i > 0 && ', '}
                      <button type="button" className="font-mono text-foreground hover:underline" onClick={() => onOpen(x.path, x.name)}>
                        {x.name}
                      </button>
                    </span>
                  ))}
                  .
                </p>
              )}
            </div>
          ) : (
            <Empty icon={Network} title="No joins">
              join_one:, join_many: and join_cross: bring other sources into this one.
            </Empty>
          )}
        </Card>
      )}

      {view === 'source' && file?.text !== undefined && <MalloyCode text={file.text} mark={[s.line, s.endLine]} focus={focus} className="max-h-[640px]" />}
    </div>
  )
}

function FieldRow({ field: f, onLine }: { field: MalloyField; onLine: (line: number) => void }) {
  return (
    <div className="flex flex-col gap-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{f.name}</span>
        {f.kind === 'measure' && /\{\s*where:/.test(f.expr) && <Badge variant="info">filtered</Badge>}
        <button type="button" className="ml-auto font-mono text-xs text-muted-foreground hover:underline" onClick={() => onLine(f.line)} title="Show in the source text">
          line {f.line}
        </button>
      </div>
      {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
      <MalloyCode text={f.definition} numbers={false} className="py-2" />
    </div>
  )
}
