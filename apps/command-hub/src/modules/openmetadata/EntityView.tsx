import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, Check, ChevronLeft, Copy, Loader2, Pencil } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { openWiki } from '@/modules/wiki/store'
import { STANDARD, docsTarget, standardField } from '@/standard'

import { call, canEdit, errorText, useCall } from './api'
import { GROUPS, adopted, typeInfo } from './catalog'
import { LineageGraph } from './lineage-graph/LineageGraph'
import { Owners, Tags, TypeTile } from './parts'
import { ago, displayName, formatTime, tierOf, type View } from './util'
import type { OmColumn, OmEntity, OmLineage, OmLineageEdge, OmRef } from './types'

type Tab = 'details' | 'schema' | 'relationships' | 'lineage' | 'versions' | 'json'

/** Lineage is drawn between data and AI assets, as in OpenMetadata. */
const LINEAGE_TYPES = new Set(GROUPS.filter((g) => g.id === 'assets' || g.id === 'ai').flatMap((g) => g.types.map((t) => t.type)))

/**
 * Any OpenMetadata entity, the way OpenMetadata stores it: who owns it, its
 * tier and tags, its description (editable), every other field, its columns
 * or fields, the entities it refers to, its lineage (data and AI assets),
 * its versions and the raw JSON.
 */
export function EntityView({ type, fqn, onOpen }: { type: string; fqn: string; onOpen: (v: View) => void }) {
  const info = typeInfo(type)
  const q = useCall<OmEntity>('get', { type, fqn })
  const [tab, setTab] = useState<Tab>('details')
  const [editing, setEditing] = useState(false)
  const entity = q.data

  const back = (
    <button type="button" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onOpen({ type })}>
      <ChevronLeft className="size-3" aria-hidden /> {info?.plural ?? type}
    </button>
  )
  if (!entity)
    return (
      <div className="flex flex-col gap-4">
        {back}
        {q.error ? (
          <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">
            {q.error}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}
      </div>
    )

  const refs = referencesOf(entity)
  const schema = schemaOf(entity)
  const tier = tierOf(entity.tags)
  const def = adopted(type)

  return (
    <div className="flex flex-col gap-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <TypeTile type={type} className="size-10" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-tight">{displayName(entity)}</h2>
              {tier && <Badge variant="primary">{tier.tagFQN.replace('Tier.', '')}</Badge>}
              {entity.deleted && <Badge variant="destructive">Deleted</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{info?.name ?? type}</span>
              <span aria-hidden>·</span>
              <span className="truncate font-mono">{entity.fullyQualifiedName}</span>
              {entity.version !== undefined && (
                <Badge variant="outline" className="font-mono">
                  v{entity.version}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {def && (
          <Button variant="outline" size="sm" onClick={() => { const t = docsTarget(def.docs); openWiki(t.id, t.anchor) }}>
            <BookOpen /> {def.name} in the standard
          </Button>
        )}
      </div>

      <Card className="py-0">
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Owners">{'owners' in entity ? <Owners owners={entity.owners} /> : <Muted>Not on this type</Muted>}</Fact>
          <Fact label="Tags and terms">{'tags' in entity ? <Tags tags={entity.tags} /> : <Muted>Not on this type</Muted>}</Fact>
          <Fact label="Domains">{entity.domains?.length ? <span className="truncate text-sm">{entity.domains.map((d) => displayName(d)).join(', ')}</span> : <Muted>None</Muted>}</Fact>
          <Fact label="Updated">
            <span className="text-sm">
              {ago(entity.updatedAt) || '–'}
              {entity.updatedBy && <span className="text-muted-foreground"> by {entity.updatedBy}</span>}
            </span>
          </Fact>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          {canEdit() && (
            <CardAction>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Edit description" onClick={() => setEditing(true)}>
                    <Pencil />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit description</TooltipContent>
              </Tooltip>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <Description text={entity.description} />
        </CardContent>
      </Card>
      {editing && <DescriptionDialog onClose={() => setEditing(false)} type={type} entity={entity} onSaved={q.reload} />}

      <div className="flex flex-col gap-4">
        <Segmented
          className="w-fit max-w-full overflow-x-auto"
          aria-label="What to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'details', label: 'Details' },
            ...(schema ? [{ value: 'schema' as const, label: `${schema.label} ${schema.count}` }] : []),
            { value: 'relationships', label: `Relationships ${refs.reduce((n, [, r]) => n + r.length, 0)}` },
            ...(LINEAGE_TYPES.has(type) ? [{ value: 'lineage' as const, label: 'Lineage' }] : []),
            { value: 'versions', label: 'Versions' },
            { value: 'json', label: 'JSON' },
          ]}
        />
        {tab === 'details' && <Details type={type} entity={entity} />}
        {tab === 'schema' && schema && <SchemaList columns={schema.columns} />}
        {tab === 'relationships' && <Relationships refs={refs} onOpen={onOpen} />}
        {tab === 'lineage' && <Lineage type={type} entity={entity} onOpen={onOpen} />}
        {tab === 'versions' && <Versions type={type} entity={entity} />}
        {tab === 'json' && <JsonCard entity={entity} />}
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-sm text-muted-foreground">{children}</span>

/** OpenMetadata descriptions are Markdown. Links and images are shown, never followed or fetched. */
function Description({ text }: { text?: string }) {
  if (!text?.trim()) return <p className="text-sm text-muted-foreground italic">No description yet.</p>
  return (
    <div className="max-w-none text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <span className="text-primary underline underline-offset-2" title={href}>
              {children}
            </span>
          ),
          img: ({ alt }) => <span className="text-muted-foreground">[image: {alt || 'no description'}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** Mounted only while open, so the draft starts from the current text. */
function DescriptionDialog({ onClose, type, entity, onSaved }: { onClose: () => void; type: string; entity: OmEntity; onSaved: () => void }) {
  const [draft, setDraft] = useState(entity.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      await call('setDescription', { type, id: entity.id, description: draft })
      onClose()
      onSaved()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Description of {displayName(entity)}</DialogTitle>
          <DialogDescription>Markdown. Saved to OpenMetadata, which keeps the old text as a version.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="om-description">Description</Label>
          <Textarea id="om-description" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || draft === (entity.description ?? '')} onClick={() => void save()}>
            {saving && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Field helpers ----------

/** Shown elsewhere on the page, so not in Details. */
const SHOWN_ELSEWHERE = new Set(['name', 'displayName', 'description', 'fullyQualifiedName', 'tags', 'owners', 'domains', 'changeDescription', 'incrementalChangeDescription', 'extension', 'href', 'entityType', 'columns', 'fields', 'updatedAt', 'updatedBy', 'version', 'deleted'])

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isRef = (v: unknown): v is OmRef => isObject(v) && typeof v.id === 'string' && typeof v.type === 'string'
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (isObject(v) && !Object.keys(v).length)
const isScalar = (v: unknown) => ['string', 'number', 'boolean'].includes(typeof v)
const humanize = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

function formatValue(key: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number' && /(At|Date|Time|time|timestamp|Ts)$/.test(key) && v > 1e11) return formatTime(v)
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

/** Every top-level field holding an entity reference or a list of them. */
function referencesOf(entity: OmEntity): [string, OmRef[]][] {
  const out: [string, OmRef[]][] = []
  for (const [k, v] of Object.entries(entity)) {
    if (isRef(v)) out.push([k, [v]])
    else if (Array.isArray(v) && v.length && v.every(isRef)) out.push([k, v])
  }
  return out
}

/** The columns or fields an entity has, wherever its type keeps them. */
function schemaOf(entity: OmEntity): { label: string; columns: OmColumn[]; count: number } | undefined {
  const at = (v: unknown) => (Array.isArray(v) && v.length ? (v as OmColumn[]) : undefined)
  const sub = (k: string, f: string) => (isObject(entity[k]) ? at((entity[k] as Record<string, unknown>)[f]) : undefined)
  const tableLike = at(entity.columns) ?? sub('dataModel', 'columns')
  const columns = tableLike ?? at(entity.fields) ?? sub('messageSchema', 'schemaFields') ?? sub('responseSchema', 'schemaFields')
  if (!columns) return undefined
  const count = (cs: OmColumn[]): number => cs.reduce((n, c) => n + 1 + count(c.children ?? []), 0)
  return { label: tableLike ? 'Columns' : 'Fields', columns, count: count(columns) }
}

// ---------- Tabs ----------

function Details({ type, entity }: { type: string; entity: OmEntity }) {
  const entries = Object.entries(entity).filter(([k, v]) => !SHOWN_ELSEWHERE.has(k) && !isEmpty(v))
  const scalars = entries.filter(([, v]) => isScalar(v))
  const structured = entries.filter(([, v]) => !isScalar(v) && !isRef(v) && !(Array.isArray(v) && v.every(isRef)))
  const extension = isObject(entity.extension) ? Object.entries(entity.extension) : []
  const def = adopted(type)
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
          <CardDescription>
            Every simple field OpenMetadata returned.{def && ` Descriptions come from the MonoRail standard (OpenMetadata ${STANDARD.openMetadata.version}).`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            {scalars.map(([k, v]) => {
              const field = def ? standardField(type, k) : undefined
              return (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground" title={field?.description}>
                    {humanize(k)}
                  </dt>
                  <dd className={typeof v === 'string' && v.length > 60 ? 'text-sm break-words' : 'truncate text-sm'} title={String(v)}>
                    {k === 'id' ? <span className="font-mono text-xs">{String(v)}</span> : formatValue(k, v)}
                  </dd>
                  {field && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{field.description}</p>}
                </div>
              )
            })}
          </dl>
        </CardContent>
      </Card>
      {extension.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom properties</CardTitle>
            <CardDescription>Fields added to this type in OpenMetadata (its extension).</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {extension.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{humanize(k)}</dt>
                  <dd className="text-sm break-words">{isScalar(v) ? formatValue(k, v) : <Json value={v} />}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
      {structured.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Structured fields</CardTitle>
            <CardDescription>Nested settings and records, as JSON.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {structured.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-1">
                <div className="text-xs text-muted-foreground">{humanize(k)}</div>
                <Json value={v} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const Json = ({ value }: { value: unknown }) => <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>

function Relationships({ refs, onOpen }: { refs: [string, OmRef[]][]; onOpen: (v: View) => void }) {
  if (!refs.length) return <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">This entity refers to no other entity.</p>
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {refs.map(([k, list]) => (
        <Card key={k}>
          <CardHeader>
            <CardTitle>{humanize(k)}</CardTitle>
            <CardDescription>
              {list.length} {list.length === 1 ? 'reference' : 'references'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {list.map((r) => (
                <RefRow key={`${r.type}:${r.id}`} r={r} onOpen={onOpen} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** One referenced entity in a list; opens it when the page knows its type. */
function RefRow({ r, onOpen, children }: { r: OmRef; onOpen: (v: View) => void; children?: ReactNode }) {
  const known = !!typeInfo(r.type)
  const body = (
    <>
      <TypeTile type={r.type} className="size-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{displayName(r)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {typeInfo(r.type)?.name ?? r.type}
          {r.fullyQualifiedName && <> · <span className="font-mono">{r.fullyQualifiedName}</span></>}
        </span>
      </span>
      {children}
      {r.deleted && <Badge variant="outline">Deleted</Badge>}
    </>
  )
  return (
    <li>
      {known ? (
        <button type="button" className="flex w-full min-w-0 items-center gap-3 rounded-md py-2 text-left hover:bg-muted/50" onClick={() => onOpen({ type: r.type, fqn: r.fullyQualifiedName ?? r.name ?? r.id })}>
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-3 py-2">{body}</div>
      )}
    </li>
  )
}

type Depth = '1' | '2' | '3'
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

/** One side of the lineage: each entity once, with how many steps away it is and the edge that reached it first. */
function sideOf(data: OmLineage, upstream: boolean): { ref: OmRef; steps: number; edge: OmLineageEdge }[] {
  const nodes = new Map(data.nodes.map((n) => [n.id, n]))
  const edges = upstream ? data.upstreamEdges : data.downstreamEdges
  const out: { ref: OmRef; steps: number; edge: OmLineageEdge }[] = []
  const seen = new Set([data.entity.id])
  let frontier = [data.entity.id]
  for (let steps = 1; frontier.length; steps++) {
    const next: string[] = []
    for (const at of frontier) {
      for (const e of edges.filter((x) => (upstream ? x.toEntity : x.fromEntity) === at)) {
        const id = upstream ? e.fromEntity : e.toEntity
        if (seen.has(id)) continue
        seen.add(id)
        next.push(id)
        out.push({ ref: nodes.get(id) ?? { id, type: 'unknown', name: id }, steps, edge: e })
      }
    }
    frontier = next
  }
  return out
}

/**
 * What the entity is made from (upstream) and what is made from it
 * (downstream), from OpenMetadata's lineage edges. Depth 1 by default; up to
 * 3 levels, OpenMetadata's limit.
 */
function Lineage({ type, entity, onOpen }: { type: string; entity: OmEntity; onOpen: (v: View) => void }) {
  // The graph reveals neighbours as you click, so it loads all 3 steps up front.
  const [depth, setDepth] = useState<Depth>('3')
  const [shape, setShape] = useState<'graph' | 'list'>('graph')
  const q = useCall<OmLineage>('getLineage', { type, id: entity.id, upstreamDepth: Number(depth), downstreamDepth: Number(depth) })
  const graphNodes = useMemo(() => (q.data ? [q.data.entity, ...q.data.nodes] : []), [q.data])
  const graphEdges = useMemo(() => (q.data ? [...q.data.upstreamEdges, ...q.data.downstreamEdges] : []), [q.data])
  const depthPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        className="w-fit"
        aria-label="Show lineage as"
        value={shape}
        onChange={setShape}
        options={[
          { value: 'graph', label: 'Graph' },
          { value: 'list', label: 'List' },
        ]}
      />
      <Segmented
        className="w-fit"
        aria-label="How many steps to follow"
        value={depth}
        onChange={setDepth}
        options={[
          { value: '1', label: '1 step' },
          { value: '2', label: '2 steps' },
          { value: '3', label: '3 steps' },
        ]}
      />
    </div>
  )
  if (q.error) return <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">{q.error}</p>
  if (!q.data)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading lineage…
      </p>
    )
  if (q.data.missing === 'no-lineage-table')
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        This BigQuery dataset has no lineage table{q.data.layout ? ` (layout ${q.data.layout})` : ''}, so there is no lineage to show. Add it with Setup SQL at the top of the page and set the dataset's layout row to monorail.metadata/2; the next sync brings its edges here.
      </p>
    )
  const up = sideOf(q.data, true)
  const down = sideOf(q.data, false)
  if (!up.length && !down.length)
    return (
      <div className="flex flex-col gap-4">
        {depthPicker}
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">No lineage is recorded for this {typeInfo(type)?.name.toLowerCase() ?? 'entity'}.</p>
      </div>
    )
  if (shape === 'graph')
    return (
      <div className="flex flex-col gap-4">
        {depthPicker}
        <LineageGraph
          nodes={graphNodes}
          edges={graphEdges}
          rootId={q.data.entity.id}
          onOpen={(ref) => {
            if (typeInfo(ref.type)) onOpen({ type: ref.type, fqn: ref.fullyQualifiedName ?? ref.name ?? ref.id })
          }}
        />
        <p className="text-xs text-muted-foreground">
          {up.length} upstream · {down.length} downstream. Click an asset to show what it connects to; open it from its controls. The List view shows the same assets as rows.
        </p>
      </div>
    )
  const side = (title: string, description: string, icon: ReactNode, rows: ReturnType<typeof sideOf>, none: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <ul className="flex flex-col divide-y">
            {rows.map(({ ref, steps, edge }) => {
              const source = edge.lineageDetails?.source
              return (
                <RefRow key={ref.id} r={ref} onOpen={onOpen}>
                  {source && <Badge variant="outline">{LINEAGE_SOURCE[source] ?? source}</Badge>}
                  {steps > 1 && (
                    <Badge variant="secondary" className="font-mono">
                      {steps} steps
                    </Badge>
                  )}
                </RefRow>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{none}</p>
        )}
      </CardContent>
    </Card>
  )
  return (
    <div className="flex flex-col gap-4">
      {depthPicker}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {side('Upstream', `${up.length} ${up.length === 1 ? 'asset' : 'assets'} this one is made from`, <ArrowUpFromLine className="size-4 text-muted-foreground" aria-hidden />, up, 'Nothing upstream: this is where the data starts.')}
        {side('Downstream', `${down.length} ${down.length === 1 ? 'asset' : 'assets'} made from this one`, <ArrowDownToLine className="size-4 text-muted-foreground" aria-hidden />, down, 'Nothing downstream yet.')}
      </div>
    </div>
  )
}

function SchemaList({ columns }: { columns: OmColumn[] }) {
  const rows: { col: OmColumn; depth: number }[] = []
  const walk = (cs: OmColumn[], depth: number) => {
    for (const c of cs) {
      rows.push({ col: c, depth })
      if (c.children?.length) walk(c.children, depth + 1)
    }
  }
  walk(columns, 0)
  return (
    <Card className="gap-0 py-2">
      <ul className="flex flex-col divide-y">
        {rows.map(({ col, depth }, i) => {
          const indent: CSSProperties = { paddingLeft: `${1.5 + depth * 1.25}rem` }
          return (
            <li key={col.fullyQualifiedName ?? `${col.name}-${i}`} style={indent} className="grid grid-cols-1 gap-x-6 gap-y-1 py-3 pr-6 md:grid-cols-[minmax(0,1fr)_8rem_minmax(0,2fr)]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{col.displayName || col.name}</span>
                {col.constraint && col.constraint !== 'NULL' && <Badge variant="outline">{col.constraint.replace('_', ' ').toLowerCase()}</Badge>}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">{col.dataTypeDisplay ?? col.dataType ?? '–'}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="line-clamp-2 text-sm text-muted-foreground">{col.description || '–'}</span>
                {!!col.tags?.length && <Tags tags={col.tags} />}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Versions({ type, entity }: { type: string; entity: OmEntity }) {
  const q = useCall<OmEntity[]>('versions', { type, id: entity.id, at: entity.version })
  if (q.error) return <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">{q.error}</p>
  if (!q.data)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading versions…
      </p>
    )
  return (
    <Card>
      <CardContent>
        <ol className="relative flex flex-col gap-4 border-l pl-6">
          {q.data.map((v) => {
            const ch = v.changeDescription
            const fields = [
              ...(ch?.fieldsAdded ?? []).map((f) => `added ${f.name}`),
              ...(ch?.fieldsUpdated ?? []).map((f) => `changed ${f.name}`),
              ...(ch?.fieldsDeleted ?? []).map((f) => `removed ${f.name}`),
            ]
            return (
              <li key={v.version} className="relative">
                <span className="absolute top-1.5 -left-[1.9rem] size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="font-mono">
                    v{v.version}
                  </Badge>
                  <span className="font-medium">{v.updatedBy}</span>
                  {v.updatedAt && <span className="text-xs text-muted-foreground">{formatTime(v.updatedAt)}</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{fields.length ? fields.join(', ').replace(/\./g, ' › ') : v.version === 0.1 ? 'Created' : 'No field changes recorded'}</p>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

function JsonCard({ entity }: { entity: OmEntity }) {
  const [copied, setCopied] = useState(false)
  const text = JSON.stringify(entity, null, 2)
  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON</CardTitle>
        <CardDescription>The entity exactly as OpenMetadata returned it.</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{text}</pre>
      </CardContent>
    </Card>
  )
}
