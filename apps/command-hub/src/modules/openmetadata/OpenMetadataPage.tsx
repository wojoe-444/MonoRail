import { useEffect, useState } from 'react'
import { BookOpen, Cable, Database, Loader2, PlugZap, RefreshCw, ShieldAlert, WifiOff, Workflow } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { prefs } from '@/lib/prefs'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { call as ingestionCall } from '@/modules/ingestion/api'
import { openAddIngestion } from '@/modules/ingestion/handoff'
import type { Overview as IngestionOverview } from '@/modules/ingestion/types'
import { openWiki } from '@/modules/wiki/store'

import { setSource, useCall, type Source } from './api'
import { BigQueryNote } from './BigQueryNote'
import { typeInfo } from './catalog'
import { EntityList } from './EntityList'
import { EntityView } from './EntityView'
import { Overview } from './Overview'
import type { View } from './util'
import { TypeNav } from './TypeNav'
import type { OmCounts, OmStatus } from './types'

const TYPE_KEY = 'monorail.openmetadata.type'
const SOURCE_KEY = 'monorail.openmetadata.source'
const savedSource = (): Source | undefined => {
  const v = prefs.getItem(SOURCE_KEY)
  return v === 'local' || v === 'server' || v === 'bigquery' ? v : undefined
}

/**
 * OpenMetadata: every entity type on one page, from MonoRail's local
 * database, the copy of a BigQuery dataset the user made the source of truth
 * (the default while it is set up), or a connected OpenMetadata server. The overview,
 * one type's entities, or one entity with everything held about it. Reads
 * through electron/modules/openmetadata.cjs; no server is contacted until
 * the OpenMetadata connection is set up.
 */
export default function OpenMetadataPage() {
  const [chosen, setChosen] = useState<Source | undefined>(savedSource)
  const status = useCall<OmStatus>('status', chosen ? { source: chosen } : {})
  // Every call below names the catalog that answered status, and the content remounts when it changes.
  const source = status.data?.source
  setSource(source)
  const ready = !!status.data && !status.data.block
  const counts = useCall<OmCounts>('counts', ready ? { source } : null)
  const choose = (s: Source) => {
    setChosen(s)
    prefs.setItem(SOURCE_KEY, s)
  }
  const [view, setViewState] = useState<View>(() => {
    const type = prefs.getItem(TYPE_KEY) ?? undefined
    return typeInfo(type) ? { type } : {}
  })
  const setView = (v: View) => {
    setViewState(v)
    if (v.type) prefs.setItem(TYPE_KEY, v.type)
    else prefs.removeItem(TYPE_KEY)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="OpenMetadata"
        description={
          source === 'local'
            ? "Every entity type in MonoRail's local database on this PC, the way OpenMetadata stores it: browse any of them and see every field, relationship and version."
            : source === 'bigquery'
              ? 'Every entity type in your BigQuery metadata dataset, the way OpenMetadata stores it: browse any of them and see every field, relationship and version.'
              : 'Every entity type in your OpenMetadata server, the way OpenMetadata stores it: browse any of them and see every field, relationship and version.'
        }
        actions={
          <>
            {(status.data?.serverSetUp || status.data?.bigquerySetUp) && (
              <Segmented
                aria-label="Catalog"
                value={source ?? 'local'}
                onChange={choose}
                options={[
                  { value: 'local' as const, label: 'This PC' },
                  ...(status.data.bigquerySetUp ? [{ value: 'bigquery' as const, label: 'BigQuery', title: 'The source of truth: a copy on this PC of your BigQuery dataset' }] : []),
                  ...(status.data.serverSetUp ? [{ value: 'server' as const, label: 'Server' }] : []),
                ]}
              />
            )}
            <Button variant="ghost" onClick={() => openWiki('guide/openmetadata')}>
              <BookOpen /> Guide
            </Button>
            <Button
              variant="outline"
              disabled={status.loading || counts.loading}
              onClick={() => {
                status.reload()
                counts.reload()
              }}
            >
              {status.loading || counts.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>
          </>
        }
      />

      {!status.data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {status.error ? status.error : <><Loader2 className="size-4 animate-spin" /> Opening the catalog…</>}
        </div>
      ) : status.data.block ? (
        <BlockedCard status={status.data} onRetry={status.reload} />
      ) : (
        <div key={source ?? 'default'} className="flex flex-col gap-6">
        {source === 'bigquery' && status.data.bigquery && (
          <BigQueryNote
            status={status.data.bigquery}
            onChanged={() => {
              status.reload()
              counts.reload()
            }}
          />
        )}
        {source === 'local' && <LocalNote serverSetUp={!!status.data.serverSetUp} empty={!!counts.data && Object.values(counts.data).every((n) => n === 0)} />}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <TypeNav current={view.type} counts={counts.data} onChoose={(type) => setView(type ? { type } : {})} />
          <div className="min-w-0">
            {!view.type ? (
              <Overview status={status.data} counts={counts.data} countsError={counts.error} onOpen={setView} />
            ) : view.fqn ? (
              <EntityView key={`${view.type}|${view.fqn}`} type={view.type} fqn={view.fqn} onOpen={setView} />
            ) : (
              <EntityList key={view.type} type={view.type} total={counts.data?.[view.type]} onOpen={setView} />
            )}
          </div>
        </div>
        </div>
      )}
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

const BLOCKS = {
  'not-set-up': {
    title: 'OpenMetadata is not set up in MonoRail',
    body: 'Add the OpenMetadata connection on Connections: your server (for example http://localhost:8585) and a bot token. Until then MonoRail contacts no server.',
    icon: PlugZap,
    warn: false,
  },
  rejected: {
    title: 'OpenMetadata rejected the sign-in',
    body: 'The bot token may have expired or been revoked, or the password changed. Update it on Connections.',
    icon: ShieldAlert,
    warn: true,
  },
  'local-error': {
    title: "MonoRail's local database could not be opened",
    body: 'The message below says why. MonoRail leaves the file as it is and never overwrites it.',
    icon: Database,
    warn: true,
  },
  unreachable: {
    title: 'OpenMetadata did not answer',
    body: 'Is the server running? OpenMetadata takes a few minutes to start. Check the address on Connections, then try again.',
    icon: WifiOff,
    warn: true,
  },
} as const

function BlockedCard({ status, onRetry }: { status: OmStatus; onRetry: () => void }) {
  const b = BLOCKS[status.block ?? 'not-set-up']
  return (
    <Card className="items-start gap-4 px-6 py-8">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
        {status.error && <p className="font-mono text-xs text-muted-foreground">{status.error}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => navigate('/connections')}>
          <Cable /> {status.block === 'not-set-up' ? 'Set up on Connections' : 'Open Connections'}
        </Button>
        {status.block !== 'not-set-up' && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        )}
      </div>
    </Card>
  )
}
