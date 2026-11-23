import { useEffect, useState } from 'react'
import { Cable, Database, Loader2, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { prefs } from '@/lib/prefs'
import { navigate } from '@/lib/router'
import { call as ingestionCall } from '@/modules/ingestion/api'
import { openAddIngestion } from '@/modules/ingestion/handoff'
import type { Overview as IngestionOverview } from '@/modules/ingestion/types'

import { BigQueryNote } from '../BigQueryNote'
import { typeInfo } from '../catalog'
import { EntityList } from '../EntityList'
import { EntityView } from '../EntityView'
import { TableView } from '../TableView'
import { Overview } from '../Overview'
import { takePendingView } from '../tabs'
import { TypeTile } from '../parts'
import { TypeNav } from '../TypeNav'
import { displayName, type View } from '../util'
import { fqnOf, useAssetSearch } from './assets'
import type { OmTabProps } from './types'

const TYPE_KEY = 'monorail.openmetadata.type'

/**
 * Catalog: every entity type on one page, the way OpenMetadata stores it (what
 * the OpenMetadata page was before it had tabs). The overview, one type's
 * entities, or one entity with everything held about it. Other tabs open an
 * entity here with openInCatalog().
 */
export default function CatalogTab({ status, counts, source, reload }: OmTabProps) {
  const [view, setViewState] = useState<View>(() => {
    const asked = takePendingView()
    if (asked) return asked
    const type = prefs.getItem(TYPE_KEY) ?? undefined
    return typeInfo(type) ? { type } : {}
  })
  const [query, setQuery] = useState('')
  const setView = (v: View) => {
    setQuery('')
    setViewState(v)
    if (v.type) prefs.setItem(TYPE_KEY, v.type)
    else prefs.removeItem(TYPE_KEY)
  }
  // Another tab asked for an entity while this one is open.
  useEffect(() => {
    const on = () => {
      const v = takePendingView()
      if (v) setViewState(v)
    }
    window.addEventListener('monorail:om-open', on)
    return () => window.removeEventListener('monorail:om-open', on)
  }, [])
  if (!status) return null

  return (
    <div className="flex flex-col gap-6">
      {source === 'bigquery' && status.bigquery && <BigQueryNote status={status.bigquery} onChanged={reload} />}
      {source === 'local' && <LocalNote serverSetUp={!!status.serverSetUp} empty={!!counts.data && Object.values(counts.data).every((n) => n === 0)} />}
      <SearchField
        className="max-w-xl"
        aria-label="Search tables by name"
        placeholder="Search tables by name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setQuery('')
        }}
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <TypeNav current={view.type} counts={counts.data} onChoose={(type) => setView(type ? { type } : {})} />
        <div className="min-w-0">
          {query.trim() ? (
            <TableSearch query={query} onOpen={setView} />
          ) : !view.type ? (
            <Overview status={status} counts={counts.data} countsError={counts.error} onOpen={setView} />
          ) : view.fqn ? (
            view.type === 'table' ? (
              <TableView key={view.fqn} fqn={view.fqn} onOpen={setView} />
            ) : (
              <EntityView key={`${view.type}|${view.fqn}`} type={view.type} fqn={view.fqn} onOpen={setView} />
            )
          ) : (
            <EntityList key={view.type} type={view.type} total={counts.data?.[view.type]} onOpen={setView} />
          )}
        </div>
      </div>
    </div>
  )
}

const TABLE_TYPES = ['table']

/**
 * Tables whose name matches, across the whole catalog (the backend's search,
 * best matches first), shown in place of the current view while there is text
 * in the Catalog's search field. Opening one clears the search.
 */
function TableSearch({ query, onOpen }: { query: string; onOpen: (v: View) => void }) {
  const search = useAssetSearch(query, TABLE_TYPES, { limit: 100 })
  const rows = search.rows ?? []
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeTile type="table" className="size-7" />
          <span className="min-w-0 truncate">Tables matching “{query.trim()}”</span>
          {search.rows && (
            <Badge variant="secondary" className="tabular-nums">
              {search.total}
            </Badge>
          )}
          {search.loading && search.rows && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />}
        </CardTitle>
        <CardDescription>Searches the name of every table in the catalog. Press Esc to go back.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!search.rows ? (
          search.error ? (
            <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">
              {search.error}
            </p>
          ) : (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </p>
          )
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{search.error ?? 'No table names match.'}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((e) => {
              const fqn = fqnOf(e)
              return (
                <li key={e.id}>
                  <button type="button" className="flex w-full min-w-0 flex-col rounded-md px-2 py-3 text-left hover:bg-muted/50" onClick={() => onOpen({ type: 'table', fqn })}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">{displayName(e)}</span>
                      {e.deleted && <Badge variant="outline">Deleted</Badge>}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{fqn}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {search.rows && search.total > rows.length && (
          <p className="text-xs text-muted-foreground tabular-nums">
            The best {rows.length} of {search.total} matches. Type more of the name to narrow it down.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** What the local catalog is, where it is filled from, and how to add a server. */
function LocalNote({ serverSetUp, empty }: { serverSetUp: boolean; empty: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-4 px-6 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Database className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {empty ? 'Nothing here yet. ' : ''}This is MonoRail's local database: it stays on this PC and needs no server. Ingestion pipelines on this PC fill it with your SQLite and dbt sources.
          {serverSetUp ? ' Switch to Server above to browse your OpenMetadata server.' : ' To browse an OpenMetadata server as well, add it on Connections.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/services')}>
            <Workflow /> Services
          </Button>
          {!serverSetUp && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/connections')}>
              <Cable /> Add a server
            </Button>
          )}
        </div>
      </div>
      {empty && <EmptyNextSteps />}
    </Card>
  )
}

/**
 * What to do next while the local database is empty, from the data sources
 * that are connected and the pipelines they have. Reads Services' overview,
 * which starts nothing and creates no database.
 */
function EmptyNextSteps() {
  const [overview, setOverview] = useState<IngestionOverview>()
  useEffect(() => {
    let live = true
    ingestionCall('overview').then(
      (o) => live && setOverview(o),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [])
  if (!overview) return null

  const sources = overview.services.filter((s) => s.added && s.localTypes.length > 0)
  const steps: { key: string; text: string; action: string; run: () => void }[] = []
  if (!sources.length) {
    steps.push({ key: 'none', text: 'No data source is connected yet. Add a SQLite database or a dbt project on Connections, then add an ingestion pipeline for it.', action: 'Add a data source', run: () => navigate('/connections') })
  }
  for (const s of sources) {
    const name = s.displayName || s.title
    const pipelines = overview.pipelines.filter((p) => p.extension?.monorail?.serviceKind === s.kind)
    if (!pipelines.length) {
      steps.push({ key: s.kind, text: `${name} is connected but has no ingestion pipeline yet, so nothing has been read from it.`, action: 'Add ingestion', run: () => openAddIngestion(s.kind) })
    } else if (pipelines.some((p) => p.lastRun?.pipelineState === 'failed')) {
      steps.push({ key: s.kind, text: `The last run of a ${name} pipeline failed. Open its runs on Services to see why.`, action: 'Open Services', run: () => navigate('/services') })
    } else if (pipelines.every((p) => !p.lastRun)) {
      steps.push({ key: s.kind, text: `${name} has ${pipelines.length === 1 ? 'a pipeline' : 'pipelines'} that ${pipelines.length === 1 ? "hasn't" : "haven't"} run yet. Run ${pipelines.length === 1 ? 'it' : 'one'} on Services.`, action: 'Open Services', run: () => navigate('/services') })
    }
  }
  if (!steps.length) return null

  return (
    <ul className="divide-y border-t">
      {steps.map((s) => (
        <li key={s.key} className="flex flex-wrap items-center gap-4 px-6 py-3">
          <p className="min-w-0 flex-1 text-sm">{s.text}</p>
          <Button size="sm" onClick={s.run}>
            {s.action}
          </Button>
        </li>
      ))}
    </ul>
  )
}

