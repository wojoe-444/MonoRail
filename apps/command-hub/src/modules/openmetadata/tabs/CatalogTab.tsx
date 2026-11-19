import { useEffect, useState } from 'react'
import { Cable, Database, Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { prefs } from '@/lib/prefs'
import { navigate } from '@/lib/router'
import { call as ingestionCall } from '@/modules/ingestion/api'
import { openAddIngestion } from '@/modules/ingestion/handoff'
import type { Overview as IngestionOverview } from '@/modules/ingestion/types'

import { BigQueryNote } from '../BigQueryNote'
import { typeInfo } from '../catalog'
import { EntityList } from '../EntityList'
import { EntityView } from '../EntityView'
import { Overview } from '../Overview'
import { takePendingView } from '../tabs'
import { TypeNav } from '../TypeNav'
import type { View } from '../util'
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
  const setView = (v: View) => {
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
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <TypeNav current={view.type} counts={counts.data} onChoose={(type) => setView(type ? { type } : {})} />
        <div className="min-w-0">
          {!view.type ? (
            <Overview status={status} counts={counts.data} countsError={counts.error} onOpen={setView} />
          ) : view.fqn ? (
            <EntityView key={`${view.type}|${view.fqn}`} type={view.type} fqn={view.fqn} onOpen={setView} />
          ) : (
            <EntityList key={view.type} type={view.type} total={counts.data?.[view.type]} onOpen={setView} />
          )}
        </div>
      </div>
    </div>
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
    ingestionCall<IngestionOverview>('overview').then(
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

