import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Copy, Loader2, Pencil, TriangleAlert } from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { StatTile } from '@/components/charts/StatTile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes, formatCount } from '@/lib/format'
import { openWiki } from '@/modules/wiki/store'
import { docsTarget } from '@/standard'

import { canEdit, useCall, type CallState } from './api'
import { adopted, typeInfo } from './catalog'
import { changeSummary, isRef, referencesOf, sideOf } from './entity'
import { Description, DescriptionDialog, Details, JsonCard, Lineage, Relationships, Versions } from './EntityView'
import { endProducts } from './lineage'
import { Owners, TypeTile } from './parts'
import { ColumnsTab, TagList } from './TableColumns'
import { FillBar, KeyBadge, TestBadge, TestMark, TypeChip } from './table-parts'
import { filledShare, firstLine, flattenColumns, rowTrend, tableTests, testCounts, type TableColumn, type TableTest } from './table'
import { ago, displayName, formatTime, isTier, tierOf, type View } from './util'
import type { OmEntity, OmRef, OmTableHealth } from './types'

type Tab = 'overview' | 'columns' | 'lineage' | 'quality' | 'relationships' | 'versions' | 'details' | 'json'

/** How OpenMetadata's tableType reads on the page. */
const TABLE_TYPE: Record<string, string> = { Regular: 'Table', View: 'View', MaterializedView: 'Materialized view', SecureView: 'Secure view', External: 'External table', Partitioned: 'Partitioned table', Foreign: 'Foreign table', Transient: 'Transient table', Dynamic: 'Dynamic table', Iceberg: 'Iceberg table', Local: 'Local table', Stream: 'Stream' }

/**
 * One table: where it lives, who owns it and whether to trust it (row count
 * trend, last profile, tests, lineage) on Overview; every column with how
 * full it is, and an inspector per column, on Columns; then its lineage,
 * tests, references, versions, every field and the raw JSON.
 */
export function TableView({ fqn, onOpen }: { fqn: string; onOpen: (v: View) => void }) {
  const q = useCall('get', { type: 'table', fqn })
  const entity = q.data
  const health = useCall('tableHealth', entity ? { id: entity.id, fqn: entity.fullyQualifiedName ?? fqn } : null)
  const [tab, setTab] = useState<Tab>('overview')
  const [selected, setSelected] = useState<string>()
  const [editing, setEditing] = useState(false)
  const profile = health.data?.profile
  const columns = useMemo(() => (entity ? flattenColumns(entity, profile) : []), [entity, profile])
  const tests = useMemo(() => tableTests(health.data?.tests ?? []), [health.data])

  const back = (
    <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => onOpen({ type: 'table' })}>
      <ChevronLeft className="size-3" aria-hidden /> Tables
    </button>
  )
  if (!entity)
    return (
      <div className="flex flex-col gap-4">
        <div className="text-xs text-muted-foreground">{back}</div>
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
  const counts = testCounts(tests)
  const go = (t: Tab) => {
    setTab(t)
    requestAnimationFrame(() => document.getElementById('om-table-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  const openColumn = (path: string) => {
    setSelected(path)
    go('columns')
  }

  return (
    <div className="flex flex-col gap-6">
      <Header entity={entity} back={back} onOpen={onOpen} />
      {counts.failed > 0 && <FailingBanner tests={tests} failed={counts.failed} onShow={() => go('quality')} />}

      <div id="om-table-tabs" className="flex scroll-mt-4 flex-col gap-4">
        <Segmented
          className="w-fit max-w-full overflow-x-auto"
          aria-label="What to show"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'columns', label: `Columns ${columns.length}` },
            { value: 'lineage', label: 'Lineage' },
            { value: 'quality', label: counts.total ? `Quality ${counts.total}` : 'Quality' },
            { value: 'relationships', label: `Relationships ${refs.reduce((n, [, r]) => n + r.length, 0)}` },
            { value: 'versions', label: 'Versions' },
            { value: 'details', label: 'Details' },
            { value: 'json', label: 'JSON' },
          ]}
        />
        {tab === 'overview' && <Overview entity={entity} health={health} columns={columns} tests={tests} onTab={go} onOpenColumn={openColumn} onEdit={() => setEditing(true)} onOpen={onOpen} />}
        {tab === 'columns' && (
          <ColumnsTab
            entity={entity}
            columns={columns}
            tests={tests}
            rowCount={profile?.rowCount}
            profiledAt={profile?.timestamp}
            profileLoading={health.loading}
            selected={selected}
            onSelect={setSelected}
            onOpen={onOpen}
          />
        )}
        {tab === 'lineage' && <Lineage type="table" entity={entity} onOpen={onOpen} />}
        {tab === 'quality' && <QualityTab health={health} tests={tests} onOpen={onOpen} onOpenColumn={openColumn} columns={columns} />}
        {tab === 'relationships' && <Relationships refs={refs} onOpen={onOpen} />}
        {tab === 'versions' && <Versions type="table" entity={entity} />}
        {tab === 'details' && <Details type="table" entity={entity} />}
        {tab === 'json' && <JsonCard entity={entity} />}
      </div>
      {editing && <DescriptionDialog onClose={() => setEditing(false)} type="table" entity={entity} onSaved={q.reload} />}
    </div>
  )
}

const openRef = (onOpen: (v: View) => void, r: OmRef) => onOpen({ type: r.type, fqn: r.fullyQualifiedName ?? r.name ?? r.id })

function Header({ entity, back, onOpen }: { entity: OmEntity; back: ReactNode; onOpen: (v: View) => void }) {
  const [copied, setCopied] = useState(false)
  const tier = tierOf(entity.tags)
  const def = adopted('table')
  const path = [entity.service, entity.database, entity.databaseSchema].filter(isRef)
  const summary = firstLine(entity.description)
  const tableType = typeof entity.tableType === 'string' ? (TABLE_TYPE[entity.tableType] ?? entity.tableType) : undefined
  const name = entity.fullyQualifiedName ?? entity.name
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Where this table is" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {back}
        {path.map((r) => (
          <Fragment key={r.id}>
            <ChevronRight className="size-3" aria-hidden />
            <button type="button" className="hover:text-foreground" disabled={!typeInfo(r.type)} onClick={() => openRef(onOpen, r)}>
              {displayName(r)}
            </button>
          </Fragment>
        ))}
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <TypeTile type="table" className="size-10" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-mono text-xl font-semibold tracking-tight">{displayName(entity)}</h2>
              {tier && <Badge variant="primary">{tier.tagFQN.replace('Tier.', '')}</Badge>}
              {tableType && <Badge variant="outline">{tableType}</Badge>}
              {typeof entity.serviceType === 'string' && <Badge variant="outline">{entity.serviceType}</Badge>}
              {entity.deleted && <Badge variant="destructive">Deleted</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {summary && <span className="max-w-xl truncate">{summary}</span>}
              {summary && <span aria-hidden>·</span>}
              <Owners owners={entity.owners} />
              {!!entity.domains?.length && (
                <>
                  <span aria-hidden>·</span>
                  <RefLinks refs={entity.domains} onOpen={onOpen} />
                </>
              )}
              {entity.updatedAt && (
                <>
                  <span aria-hidden>·</span>
                  <span>Updated {ago(entity.updatedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(name)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy name'}
          </Button>
          {def && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Table in the standard" onClick={() => { const t = docsTarget(def.docs); openWiki(t.id, t.anchor) }}>
                  <BookOpen />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Table in the standard</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  )
}

function RefLinks({ refs, onOpen }: { refs: OmRef[]; onOpen: (v: View) => void }) {
  return (
    <span className="flex min-w-0 flex-wrap gap-x-2">
      {refs.map((r) => (
        <button key={r.id} type="button" className="truncate text-primary hover:underline disabled:text-foreground disabled:no-underline" disabled={!typeInfo(r.type)} onClick={() => openRef(onOpen, r)}>
          {displayName(r)}
        </button>
      ))}
    </span>
  )
}

function FailingBanner({ tests, failed, onShow }: { tests: TableTest[]; failed: number; onShow: () => void }) {
  const first = tests.find((t) => t.status === 'Failed')
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{failed === 1 ? '1 test is failing.' : `${failed} tests are failing.`}</span>
        {first && (
          <>
            {' '}
            “{displayName(first.entity)}”{first.result ? `: ${first.result.replace(/\.$/, '')}` : ''}
            {first.at ? `, ${ago(first.at)}.` : '.'}
          </>
        )}
      </p>
      <Button variant="ghost" size="sm" className="-my-1 hover:bg-destructive/10" onClick={onShow}>
        See the tests
      </Button>
    </div>
  )
}

// ---------- Overview ----------

function Overview({ entity, health, columns, tests, onTab, onOpenColumn, onEdit, onOpen }: {
  entity: OmEntity
  health: CallState<OmTableHealth>
  columns: TableColumn[]
  tests: TableTest[]
  onTab: (t: Tab) => void
  onOpenColumn: (path: string) => void
  onEdit: () => void
  onOpen: (v: View) => void
}) {
  const h = health.data
  const p = h?.profile
  const trend = rowTrend(h?.history ?? [])
  const counts = testCounts(tests)
  const undocumented = columns.filter((c) => !c.col.description?.trim()).length
  const waiting = health.loading && !h
  const notProfiled = waiting ? 'Loading…' : health.error ? 'Could not read the profile' : 'Not profiled yet'
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Rows"
          value={p?.rowCount !== undefined ? formatCount(p.rowCount) : '–'}
          delta={trend?.delta}
          deltaLabel={trend ? `since ${formatTime(trend.first.timestamp).split(',')[0]}` : undefined}
          hint={p?.rowCount === undefined ? notProfiled : undefined}
          trend={h && h.history.length > 1 ? <Sparkline data={h.history.map((x) => x.rowCount)} className="text-(--series-1)" /> : undefined}
        />
        <StatTile label="Last profiled" value={p ? ago(p.timestamp) : '–'} hint={p ? [p.sizeInByte !== undefined && formatBytes(p.sizeInByte), p.columnCount !== undefined && `${p.columnCount} columns`].filter(Boolean).join(' · ') || undefined : notProfiled} />
        <StatTile
          label="Tests passing"
          value={counts.total ? `${counts.passed} / ${counts.total}` : '–'}
          hint={waiting ? 'Loading…' : counts.failed ? `${counts.failed} failing` : counts.total ? (counts.other ? `${counts.other} without a pass` : 'All passing') : 'No tests on this table'}
        />
        <StatTile label="Columns" value={formatCount(columns.length)} hint={undocumented ? `${undocumented} without a description` : 'All described'} />
      </div>
      {(health.error || h?.errors?.profile) && <p className="text-sm text-muted-foreground">Could not read the profile: {health.error ?? h?.errors?.profile}</p>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              {canEdit() && (
                <CardAction>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Edit description" onClick={onEdit}>
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
          <LineageSummary entity={entity} onOpen={onOpen} onShow={() => onTab('lineage')} />
          <ColumnsGlance columns={columns} rowCount={p?.rowCount} onOpenColumn={onOpenColumn} onShowAll={() => onTab('columns')} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Ownership entity={entity} onOpen={onOpen} />
          <QualityCard tests={tests} health={health} onShow={() => onTab('quality')} onOpen={onOpen} />
          <RecentChanges entity={entity} onShow={() => onTab('versions')} />
        </div>
      </div>
    </div>
  )
}

const LANE_SHOWN = 4

/** What the table is made from and what is made from it, one step each way, and where it ends up further down. */
function LineageSummary({ entity, onOpen, onShow }: { entity: OmEntity; onOpen: (v: View) => void; onShow: () => void }) {
  const q = useCall('getLineage', { type: 'table', id: entity.id, upstreamDepth: 1, downstreamDepth: 'all' })
  const view = useMemo(() => {
    if (!q.data || q.data.missing) return undefined
    const up = sideOf(q.data, true)
    const down = sideOf(q.data, false)
    const direct = down.filter((d) => d.steps === 1)
    const further = endProducts(q.data).products.filter((p) => p.steps > 1)
    return { up, direct, further, total: down.length }
  }, [q.data])
  const lane = (title: string, rows: { ref: OmRef; edge?: { lineageDetails?: { source?: string } } }[], none: string) => (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</span>
      {rows.length ? (
        <>
          {rows.slice(0, LANE_SHOWN).map(({ ref, edge }) => (
            <NodeButton key={ref.id} r={ref} note={edge?.lineageDetails?.source} onOpen={onOpen} />
          ))}
          {rows.length > LANE_SHOWN && <span className="text-xs text-muted-foreground">and {rows.length - LANE_SHOWN} more</span>}
        </>
      ) : (
        <span className="text-sm text-muted-foreground">{none}</span>
      )}
    </div>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lineage</CardTitle>
        <CardDescription>What this table is made from and what is made from it</CardDescription>
        {view && (view.up.length > 0 || view.total > 0) && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onShow}>
              Open lineage
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="@container flex flex-col gap-4">
        {q.error ? (
          <p className="text-sm text-muted-foreground">Could not read the lineage: {q.error}</p>
        ) : q.data?.missing ? (
          <p className="text-sm text-muted-foreground">This BigQuery dataset has no lineage table, so there is no lineage to show.</p>
        ) : !view ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : !view.up.length && !view.total ? (
          <p className="text-sm text-muted-foreground">No lineage is recorded for this table.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 items-center gap-3 @3xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] @3xl:gap-4">
              {lane('Upstream', view.up, 'Nothing: the data starts here')}
              <ArrowRight className="hidden size-4 text-muted-foreground @3xl:block" aria-hidden />
              <ArrowDown className="mx-auto size-4 text-muted-foreground @3xl:hidden" aria-hidden />
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">This table</span>
                <div className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 ring-2 ring-primary">
                  <TypeTile type="table" className="size-7" />
                  <span className="truncate font-mono text-sm font-medium">{displayName(entity)}</span>
                </div>
              </div>
              <ArrowRight className="hidden size-4 text-muted-foreground @3xl:block" aria-hidden />
              <ArrowDown className="mx-auto size-4 text-muted-foreground @3xl:hidden" aria-hidden />
              {lane('Downstream', view.direct, 'Nothing is made from it yet')}
            </div>
            {view.further.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
                <span className="text-muted-foreground">Further down it ends up in</span>
                {view.further.slice(0, 6).map(({ ref }) => (
                  <button key={ref.id} type="button" disabled={!typeInfo(ref.type)} onClick={() => openRef(onOpen, ref)} className="flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ring-foreground/10 hover:bg-muted/50 disabled:hover:bg-transparent">
                    <TypeTile type={ref.type} className="size-5 rounded" />
                    <span className="truncate">{displayName(ref)}</span>
                  </button>
                ))}
                {view.further.length > 6 && <span className="text-xs text-muted-foreground">and {view.further.length - 6} more</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** How OpenMetadata names where an edge came from, shortly. */
const EDGE_SOURCE: Record<string, string> = { Manual: 'by hand', ViewLineage: 'view', QueryLineage: 'query', PipelineLineage: 'pipeline', DashboardLineage: 'dashboard', DbtLineage: 'dbt', SparkLineage: 'Spark', OpenLineage: 'OpenLineage', ExternalTableLineage: 'external table', CrossDatabaseLineage: 'cross-database' }

function NodeButton({ r, note, onOpen }: { r: OmRef; note?: string; onOpen: (v: View) => void }) {
  const info = typeInfo(r.type)
  return (
    <button type="button" disabled={!info} title={r.fullyQualifiedName} onClick={() => openRef(onOpen, r)} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 ring-foreground/10 hover:bg-muted/50 disabled:hover:bg-transparent">
      <TypeTile type={r.type} className="size-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-sm font-medium">{displayName(r)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {info?.name ?? r.type}
          {note && ` · ${EDGE_SOURCE[note] ?? note}`}
        </span>
      </span>
    </button>
  )
}

const GLANCE_SHOWN = 8

/** The first columns (keys first) with how full each is; the Columns tab has them all. */
function ColumnsGlance({ columns, rowCount, onOpenColumn, onShowAll }: { columns: TableColumn[]; rowCount?: number; onOpenColumn: (path: string) => void; onShowAll: () => void }) {
  const top = columns.filter((c) => c.depth === 0)
  const shown = [...top.filter((c) => c.key), ...top.filter((c) => !c.key)].slice(0, GLANCE_SHOWN)
  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Columns</CardTitle>
        <CardDescription>{columns.length > shown.length ? `${shown.length} of ${columns.length}, keys first` : `${columns.length} ${columns.length === 1 ? 'column' : 'columns'}`}. Click one for its profile.</CardDescription>
        {columns.length > 0 && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onShowAll}>
              All columns
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {shown.length ? (
        <ul className="flex flex-col border-t">
          {shown.map((c) => (
            <li key={c.path} className="border-b last:border-b-0">
              <button type="button" onClick={() => onOpenColumn(c.path)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-6 py-2.5 text-left hover:bg-muted/50 sm:grid-cols-[minmax(8rem,1fr)_9rem_minmax(0,2fr)_auto]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-[13px] font-medium">{c.col.displayName || c.col.name}</span>
                  <KeyBadge label={c.key} />
                </span>
                <TypeChip dataType={c.col.dataType} display={c.col.dataTypeDisplay} className="hidden sm:flex" />
                <span className="hidden truncate text-sm text-muted-foreground sm:block">{c.col.description?.trim() || <i>No description</i>}</span>
                <FillBar share={filledShare(c.profile, rowCount)} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">This table has no columns.</p>
        </CardContent>
      )}
    </Card>
  )
}

function Ownership({ entity, onOpen }: { entity: OmEntity; onOpen: (v: View) => void }) {
  const tier = tierOf(entity.tags)
  const tags = (entity.tags ?? []).filter((t) => !isTier(t))
  const products = Array.isArray(entity.dataProducts) ? entity.dataProducts.filter(isRef) : []
  const row = (label: string, value: ReactNode) => (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </>
  )
  const none = <span className="text-muted-foreground">None</span>
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
          {row('Owners', <Owners owners={entity.owners} />)}
          {row('Domains', entity.domains?.length ? <RefLinks refs={entity.domains} onOpen={onOpen} /> : none)}
          {row('Data products', products.length ? <RefLinks refs={products} onOpen={onOpen} /> : none)}
          {row('Tier', tier ? <Badge variant="primary">{tier.tagFQN.replace('Tier.', '')}</Badge> : none)}
          {row('Tags and terms', tags.length ? <TagList terms={tags.filter((t) => t.source === 'Glossary')} tags={tags.filter((t) => t.source !== 'Glossary')} /> : none)}
          {entity.followers?.length ? row('Followers', formatCount(entity.followers.length)) : null}
        </dl>
      </CardContent>
    </Card>
  )
}

const QUALITY_SHOWN = 4

function QualityCard({ tests, health, onShow, onOpen }: { tests: TableTest[]; health: CallState<OmTableHealth>; onShow: () => void; onOpen: (v: View) => void }) {
  const counts = testCounts(tests)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data quality</CardTitle>
        <CardDescription>{counts.total ? `${counts.total} ${counts.total === 1 ? 'test' : 'tests'}${counts.lastRun ? ` · last run ${ago(counts.lastRun)}` : ''}` : 'Tests on the table and its columns'}</CardDescription>
        {counts.total > 0 && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onShow}>
              All tests
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {health.loading && !health.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : health.data?.errors?.tests ? (
          <p className="text-sm text-muted-foreground">Could not read the tests: {health.data.errors.tests}</p>
        ) : tests.length ? (
          <TestList tests={tests.slice(0, QUALITY_SHOWN)} onOpen={onOpen} compact />
        ) : (
          <p className="text-sm text-muted-foreground">No tests on this table yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function TestList({ tests, onOpen, onOpenColumn, compact }: { tests: TableTest[]; onOpen: (v: View) => void; onOpenColumn?: (column: string) => void; compact?: boolean }) {
  return (
    <ul className="flex flex-col divide-y">
      {tests.map((t) => {
        const def = isRef(t.entity.testDefinition) ? t.entity.testDefinition : undefined
        return (
          <li key={t.entity.id} className="flex min-w-0 items-center gap-3 py-2.5">
            <TestMark status={t.status} />
            <div className="min-w-0 flex-1">
              <button type="button" className="block max-w-full truncate text-left text-sm font-medium hover:underline" onClick={() => onOpen({ type: 'testCase', fqn: t.entity.fullyQualifiedName ?? t.entity.name })}>
                {displayName(t.entity)}
              </button>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {t.column ? (
                  onOpenColumn ? (
                    <button type="button" className="font-mono hover:text-foreground hover:underline" onClick={() => onOpenColumn(t.column!)}>
                      {t.column}
                    </button>
                  ) : (
                    <span className="font-mono">{t.column}</span>
                  )
                ) : (
                  <span>Table</span>
                )}
                {!compact && def && <span>· {displayName(def)}</span>}
                {t.result && <span className="truncate">· {t.result}</span>}
                {!compact && t.at && <span>· {ago(t.at)}</span>}
              </span>
            </div>
            <TestBadge status={t.status} />
          </li>
        )
      })}
    </ul>
  )
}

function RecentChanges({ entity, onShow }: { entity: OmEntity; onShow: () => void }) {
  const q = useCall('versions', { type: 'table', id: entity.id }, entity.version)
  const shown = (q.data ?? []).slice(0, 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent changes</CardTitle>
        <CardDescription>From the version history</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onShow}>
            All versions
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {q.error ? (
          <p className="text-sm text-muted-foreground">{q.error}</p>
        ) : !q.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : (
          <ol className="flex flex-col gap-3 border-l pl-4">
            {shown.map((v) => (
              <li key={v.version} className="relative text-sm">
                <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary ring-2 ring-card" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    v{v.version}
                  </Badge>
                  <span className="min-w-0">{changeSummary(v)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {v.updatedBy && `by ${v.updatedBy}`}
                  {v.updatedAt ? ` · ${ago(v.updatedAt)}` : ''}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Quality ----------

function QualityTab({ health, tests, columns, onOpen, onOpenColumn }: { health: CallState<OmTableHealth>; tests: TableTest[]; columns: TableColumn[]; onOpen: (v: View) => void; onOpenColumn: (path: string) => void }) {
  const counts = testCounts(tests)
  if (health.error) return <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">{health.error}</p>
  if (health.loading && !health.data)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading tests…
      </p>
    )
  if (health.data?.errors?.tests) return <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">Could not read the tests: {health.data.errors.tests}</p>
  if (!tests.length) return <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">No tests on this table or its columns yet.</p>
  const known = new Set(columns.map((c) => c.col.name))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tests on this table</CardTitle>
        <CardDescription>
          {counts.passed} passed · {counts.failed} failed{counts.other ? ` · ${counts.other} other` : ''}
          {counts.lastRun ? ` · last run ${formatTime(counts.lastRun)}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TestList tests={tests} onOpen={onOpen} onOpenColumn={(name) => known.has(name) && onOpenColumn(columns.find((c) => c.col.name === name)!.path)} />
      </CardContent>
    </Card>
  )
}
