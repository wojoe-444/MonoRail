import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Crosshair, ExternalLink, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

import { useCall } from '../api'
import { typeInfo } from '../catalog'
import { TypeTile } from '../parts'
import { openInCatalog } from '../tabs'
import type { OmEntity, OmLineage, OmLineageEdge, OmRef } from '../types'
import { displayName } from '../util'
import { ASSET_TYPES, assetTypesIn, fqnOf, serviceOf, useAssetSearch, type Asset } from './assets'
import { EmptyNote, ErrorNote, Loading } from './assets-parts'
import type { OmTabProps } from './types'

type Depth = '0' | '1' | '2' | '3'
const DEPTHS: { value: Depth; label: string }[] = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
]

/** How OpenMetadata names where an edge came from (LineageSource), in plain words. */
const LINEAGE_SOURCE: Record<string, string> = {
  Manual: 'Added by hand',
  ViewLineage: 'View',
  QueryLineage: 'Query',
  PipelineLineage: 'Pipeline',
  DashboardLineage: 'Dashboard',
  DbtLineage: 'dbt',
  SparkLineage: 'Spark',
  OpenLineage: 'OpenLineage',
  ExternalTableLineage: 'External table',
  CrossDatabaseLineage: 'Cross-database',
}

interface Picked {
  type: string
  id: string
  fqn: string
  name: string
}

/** Pick an asset and see where its data comes from and where it goes, as a graph. */
export default function LineageTab({ counts }: OmTabProps) {
  const types = useMemo(() => (counts.data ? assetTypesIn(counts.data) : null), [counts.data])
  const [picked, setPicked] = useState<Picked>()
  const [up, setUp] = useState<Depth>('2')
  const [down, setDown] = useState<Depth>('2')
  const pick = (r: { type: string; id: string; fullyQualifiedName?: string; name?: string; displayName?: string }) =>
    setPicked({ type: r.type, id: r.id, fqn: fqnOf(r), name: displayName(r) })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <AssetPicker types={types} picked={picked} onPick={(a) => pick({ ...a, type: a.assetType })} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Upstream steps</span>
          <Segmented aria-label="Upstream steps" value={up} onChange={setUp} options={DEPTHS} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Downstream steps</span>
          <Segmented aria-label="Downstream steps" value={down} onChange={setDown} options={DEPTHS} />
        </div>
      </div>
      {!picked ? (
        <Suggestions none={types?.length === 0} onPick={(a) => pick({ ...a, type: a.assetType })} />
      ) : (
        <LineageView key={`${picked.type}|${picked.id}`} picked={picked} up={Number(up)} down={Number(down)} onRecenter={pick} />
      )}
    </div>
  )
}

/** A search box over the data assets that picks one: searches the whole catalog in the backend. */
function AssetPicker({ types, picked, onPick }: { types: string[] | null; picked?: Picked; onPick: (a: Asset) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const search = useAssetSearch(q, open ? types : null, { limit: 12 })
  const hits = search.rows ?? []
  const loading = open && search.rows === undefined
  return (
    <div className="relative w-full max-w-md">
      <Label htmlFor="om-lineage-pick" className="mb-1 block text-xs font-normal text-muted-foreground">
        Asset
      </Label>
      <SearchField
        id="om-lineage-pick"
        role="combobox"
        aria-expanded={open}
        aria-controls="om-lineage-pick-list"
        autoComplete="off"
        placeholder={loading ? 'Reading the data assets…' : 'Search tables, dashboards, pipelines…'}
        value={open ? q : (picked?.fqn ?? '')}
        onFocus={() => {
          setOpen(true)
          setQ('')
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
      />
      {open && (
        <ul id="om-lineage-pick-list" role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 shadow-elevation-2">
          {hits.map((e) => (
            <li key={`${e.assetType}:${e.id}`} role="option" aria-selected={e.id === picked?.id}>
              <button
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => {
                  onPick(e)
                  setOpen(false)
                }}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted', e.id === picked?.id && 'bg-primary-soft')}
              >
                <TypeTile type={e.assetType} className="size-6" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{displayName(e)}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{fqnOf(e)}</span>
                </span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="px-2 py-3 text-center text-sm text-muted-foreground">{loading || search.loading ? 'Searching…' : (search.error ?? 'No assets match.')}</li>}
          {search.total > hits.length && <li className="px-2 py-1.5 text-center text-xs text-muted-foreground">{search.total - hits.length} more match: type more of the name</li>}
        </ul>
      )}
    </div>
  )
}

/** Before an asset is picked: a few changed lately to start from. */
function Suggestions({ none, onPick }: { none: boolean; onPick: (a: Asset) => void }) {
  const recent = useCall<(OmEntity & { entityType: string })[]>('recent', { size: 50 })
  const isAsset = (t: string) => (ASSET_TYPES as readonly string[]).includes(t)
  const start: Asset[] = (recent.data ?? []).filter((e) => isAsset(e.entityType)).slice(0, 6).map((e) => ({ ...e, assetType: e.entityType }))
  if (!recent.data && !recent.error && !none) return <Loading>Reading the data assets…</Loading>
  if (!none && !start.length) return <EmptyNote title="Pick an asset">Search above for the table, dashboard or pipeline to start from.</EmptyNote>
  if (none) return <EmptyNote title="No data assets yet">Lineage is drawn between data assets. Once ingestion has added some, pick one here.</EmptyNote>
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick an asset</CardTitle>
        <CardDescription>Search above, or start from one changed lately.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {start.map((e) => (
            <li key={`${e.assetType}:${e.id}`}>
              <button type="button" onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 ring-foreground/10 hover:bg-muted/50">
                <TypeTile type={e.assetType} className="size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{displayName(e)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {typeInfo(e.assetType)?.name}
                    {serviceOf(e) ? ` · ${serviceOf(e)}` : ''}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function LineageView({ picked, up, down, onRecenter }: { picked: Picked; up: number; down: number; onRecenter: (r: OmRef) => void }) {
  const q = useCall<OmLineage>('getLineage', { type: picked.type, id: picked.id, upstreamDepth: up, downstreamDepth: down })
  if (q.error) return <ErrorNote>{q.error}</ErrorNote>
  if (!q.data) return <Loading>Loading lineage…</Loading>
  if (q.data.missing === 'no-lineage-table')
    return (
      <EmptyNote title="No lineage table">
        This BigQuery dataset has no lineage table{q.data.layout ? ` (layout ${q.data.layout})` : ''}, so there is no lineage to show. Add it with Setup SQL on the Catalog tab and set the dataset's layout row to monorail.metadata/2; the next sync brings its edges here.
      </EmptyNote>
    )
  if (!q.data.upstreamEdges.length && !q.data.downstreamEdges.length)
    return (
      <EmptyNote title={`No lineage for ${picked.name}`}>
        {up === 0 && down === 0 ? 'Both depths are 0: raise one to follow the lineage.' : `Nothing is recorded as feeding this ${typeInfo(picked.type)?.name.toLowerCase() ?? 'asset'} or made from it.`}
      </EmptyNote>
    )
  return <Graph data={q.data} onRecenter={onRecenter} />
}

// ---------- The graph ----------

const NODE_W = 232
const NODE_H = 56
const COL_GAP = 88
const ROW_GAP = 20
const PAD = 24

interface Placed {
  ref: OmRef
  depth: number
  x: number
  y: number
}

/** Columns by steps from the asset: upstream to the left, downstream to the right. */
function layout(data: OmLineage) {
  const refs = new Map<string, OmRef>([[data.entity.id, data.entity], ...data.nodes.map((n) => [n.id, n] as const)])
  const depth = new Map<string, number>([[data.entity.id, 0]])
  const walk = (edges: OmLineageEdge[], upstream: boolean) => {
    let frontier = [data.entity.id]
    for (let d = 1; frontier.length; d++) {
      const next: string[] = []
      for (const at of frontier)
        for (const e of edges) {
          if ((upstream ? e.toEntity : e.fromEntity) !== at) continue
          const id = upstream ? e.fromEntity : e.toEntity
          if (depth.has(id)) continue
          depth.set(id, upstream ? -d : d)
          next.push(id)
        }
      frontier = next
    }
  }
  walk(data.upstreamEdges, true)
  walk(data.downstreamEdges, false)
  const edges = [...new Map([...data.upstreamEdges, ...data.downstreamEdges].map((e) => [`${e.fromEntity}>${e.toEntity}`, e])).values()].filter((e) => depth.has(e.fromEntity) && depth.has(e.toEntity))
  const cols = new Map<number, string[]>()
  for (const [id, d] of depth) cols.set(d, [...(cols.get(d) ?? []), id])
  const minD = Math.min(...cols.keys())
  const maxD = Math.max(...cols.keys())
  const tallest = Math.max(...[...cols.values()].map((c) => c.length))
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP
  const width = PAD * 2 + (maxD - minD + 1) * NODE_W + (maxD - minD) * COL_GAP
  const placed = new Map<string, Placed>()
  for (const [d, ids] of cols) {
    const ref = (id: string) => refs.get(id) ?? { id, type: 'unknown', name: id }
    ids.sort((a, b) => displayName(ref(a)).localeCompare(displayName(ref(b))))
    const colH = ids.length * NODE_H + (ids.length - 1) * ROW_GAP
    ids.forEach((id, i) =>
      placed.set(id, { ref: ref(id), depth: d, x: PAD + (d - minD) * (NODE_W + COL_GAP), y: (height - colH) / 2 + i * (NODE_H + ROW_GAP) }),
    )
  }
  return { placed, edges, width, height }
}

const edgeKey = (e: OmLineageEdge) => `${e.fromEntity}>${e.toEntity}`

function Graph({ data, onRecenter }: { data: OmLineage; onRecenter: (r: OmRef) => void }) {
  const { placed, edges, width, height } = useMemo(() => layout(data), [data])
  const [hover, setHover] = useState<string>()
  const [selected, setSelected] = useState<{ kind: 'node'; id: string } | { kind: 'edge'; key: string }>()
  const near = useMemo(() => {
    if (!hover) return undefined
    const s = new Set([hover])
    for (const e of edges) {
      if (e.fromEntity === hover) s.add(e.toEntity)
      if (e.toEntity === hover) s.add(e.fromEntity)
    }
    return s
  }, [hover, edges])
  const upCount = [...placed.values()].filter((p) => p.depth < 0).length
  const downCount = [...placed.values()].filter((p) => p.depth > 0).length
  const selNode = selected?.kind === 'node' ? placed.get(selected.id) : undefined
  const selEdge = selected?.kind === 'edge' ? edges.find((e) => edgeKey(e) === selected.key) : undefined

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <TypeTile type={data.entity.type} className="size-7" />
          {displayName(data.entity)}
        </CardTitle>
        <CardDescription>
          {upCount} upstream · {downCount} downstream · {edges.length} {edges.length === 1 ? 'edge' : 'edges'}. Hover an asset to see its neighbours; click an asset or an edge for details.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => openInCatalog({ type: data.entity.type, fqn: fqnOf(data.entity) })}>
            Open in Catalog <ExternalLink />
          </Button>
        </CardAction>
      </CardHeader>
      <div className="relative border-t bg-muted/30">
        <div className="overflow-auto">
          <div className="relative" style={{ width, height, minWidth: '100%' }}>
            <svg className="absolute inset-0" width={width} height={height} aria-hidden>
              <defs>
                <marker id="om-lineage-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--muted-foreground)" />
                </marker>
                <marker id="om-lineage-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--primary)" />
                </marker>
              </defs>
              {edges.map((e) => {
                const a = placed.get(e.fromEntity)
                const b = placed.get(e.toEntity)
                if (!a || !b) return null
                const x1 = a.x + NODE_W
                const y1 = a.y + NODE_H / 2
                const x2 = b.x
                const y2 = b.y + NODE_H / 2
                const mid = (x1 + x2) / 2
                const d = `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 2},${y2}`
                const key = edgeKey(e)
                const active = (selected?.kind === 'edge' && selected.key === key) || (hover && (e.fromEntity === hover || e.toEntity === hover))
                return (
                  <g key={key} className="pointer-events-auto cursor-pointer" onClick={() => setSelected({ kind: 'edge', key })}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                    <path
                      d={d}
                      fill="none"
                      stroke={active ? 'var(--primary)' : 'var(--muted-foreground)'}
                      strokeWidth={active ? 2 : 1.25}
                      opacity={near && !active ? 0.25 : 1}
                      markerEnd={`url(#${active ? 'om-lineage-arrow-active' : 'om-lineage-arrow'})`}
                    />
                  </g>
                )
              })}
            </svg>
            {[...placed.entries()].map(([id, p]) => {
              const root = p.depth === 0
              return (
                <button
                  key={id}
                  type="button"
                  title={p.ref.fullyQualifiedName}
                  onMouseEnter={() => setHover(id)}
                  onMouseLeave={() => setHover(undefined)}
                  onFocus={() => setHover(id)}
                  onBlur={() => setHover(undefined)}
                  onClick={() => setSelected({ kind: 'node', id })}
                  className={cn(
                    'absolute flex items-center gap-2 rounded-xl border bg-card px-3 text-left shadow-elevation-1 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    root && 'border-primary ring-2 ring-primary/30',
                    selected?.kind === 'node' && selected.id === id && 'border-primary',
                    near && !near.has(id) && 'opacity-40',
                  )}
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                >
                  <TypeTile type={p.ref.type} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(p.ref)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {typeInfo(p.ref.type)?.name ?? p.ref.type}
                      {p.ref.fullyQualifiedName?.includes('.') ? ` · ${p.ref.fullyQualifiedName.split('.').slice(-2, -1)[0]}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {selNode && <NodePanel p={selNode} onClose={() => setSelected(undefined)} onRecenter={onRecenter} />}
        {selEdge && <EdgePanel edge={selEdge} from={placed.get(selEdge.fromEntity)?.ref} to={placed.get(selEdge.toEntity)?.ref} onClose={() => setSelected(undefined)} />}
      </div>
    </Card>
  )
}

function Panel({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute top-3 right-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[min(24rem,calc(100%-1.5rem))] flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-4 shadow-elevation-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{sub}</div>
          <div className="truncate text-sm font-medium">{title}</div>
        </div>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>
      {children}
    </div>
  )
}

function NodePanel({ p, onClose, onRecenter }: { p: Placed; onClose: () => void; onRecenter: (r: OmRef) => void }) {
  const info = typeInfo(p.ref.type)
  const steps = Math.abs(p.depth)
  return (
    <Panel title={displayName(p.ref)} sub={info?.name ?? p.ref.type} onClose={onClose}>
      <p className="font-mono text-xs break-all text-muted-foreground">{p.ref.fullyQualifiedName}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{p.depth === 0 ? 'The picked asset' : `${steps} ${steps === 1 ? 'step' : 'steps'} ${p.depth < 0 ? 'upstream' : 'downstream'}`}</Badge>
        {p.ref.deleted && <Badge variant="outline">Deleted</Badge>}
      </div>
      {p.ref.description && <p className="line-clamp-4 text-sm">{p.ref.description}</p>}
      <div className="flex flex-wrap gap-2">
        {info && (
          <Button size="sm" variant="outline" onClick={() => openInCatalog({ type: p.ref.type, fqn: fqnOf(p.ref) })}>
            <ExternalLink /> Open in Catalog
          </Button>
        )}
        {p.depth !== 0 && info && (
          <Button size="sm" variant="ghost" onClick={() => onRecenter(p.ref)}>
            <Crosshair /> Center on it
          </Button>
        )}
      </div>
    </Panel>
  )
}

function EdgePanel({ edge, from, to, onClose }: { edge: OmLineageEdge; from?: OmRef; to?: OmRef; onClose: () => void }) {
  const d = edge.lineageDetails
  const short = (fqn?: string) => fqn?.split('.').pop() ?? ''
  const source = d?.source
  return (
    <Panel title={`${displayName(from)} → ${displayName(to)}`} sub="Lineage edge" onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {source && <Badge variant="secondary">{LINEAGE_SOURCE[source] ?? source}</Badge>}
        {d?.pipeline && (
          <Badge variant="outline" className="cursor-pointer" onClick={() => d.pipeline && openInCatalog({ type: d.pipeline.type, fqn: fqnOf(d.pipeline) })}>
            Pipeline: {displayName(d.pipeline)}
          </Badge>
        )}
      </div>
      {(edge.description || d?.description) && <p className="text-sm">{edge.description || d?.description}</p>}
      {!!d?.columnsLineage?.length && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Columns</div>
          {d.columnsLineage.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 font-mono text-xs">
              <span>{(c.fromColumns ?? []).map(short).join(', ')}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold">{short(c.toColumn)}</span>
              {c.function && <span className="text-muted-foreground">({c.function})</span>}
            </div>
          ))}
        </div>
      )}
      {d?.sqlQuery && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">SQL</div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{d.sqlQuery}</pre>
        </div>
      )}
      {!d?.sqlQuery && !d?.columnsLineage?.length && <p className="text-sm text-muted-foreground">No SQL or column mapping recorded for this edge.</p>}
    </Panel>
  )
}
