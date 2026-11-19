import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
import { BookOpen, Cable, Database, Loader2, PlugZap, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'

import { PageCommandBar } from '@/components/layout/PageCommandBar'
import { PageTabs } from '@/components/layout/PageTabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { navigate, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { openWiki } from '@/modules/wiki/store'

import { call, refreshData, setSource, useCall } from './api'
import { OM_TABS, tabFromPath, tabPath } from './tabs'
import { MalloySettingsDialog } from './tabs/semantic/malloySettings'
import type { OmTabProps } from './tabs/types'
import type { BqStatus, OmCounts, OmStatus } from './types'

const TAB_COMPONENTS: Record<string, ComponentType<OmTabProps>> = {
  home: lazy(() => import('./tabs/HomeTab')),
  catalog: lazy(() => import('./tabs/CatalogTab')),
  explore: lazy(() => import('./tabs/ExploreTab')),
  lineage: lazy(() => import('./tabs/LineageTab')),
  'semantic-models': lazy(() => import('./tabs/SemanticModelsTab')),
  metrics: lazy(() => import('./tabs/MetricsTab')),
  query: lazy(() => import('./tabs/QueryTab')),
  malloy: lazy(() => import('./tabs/MalloyTab')),
  glossary: lazy(() => import('./tabs/GlossaryTab')),
  classifications: lazy(() => import('./tabs/ClassificationsTab')),
  domains: lazy(() => import('./tabs/DomainsTab')),
  quality: lazy(() => import('./tabs/QualityTab')),
  insights: lazy(() => import('./tabs/InsightsTab')),
  services: lazy(() => import('./tabs/ServicesTab')),
  teams: lazy(() => import('./tabs/TeamsTab')),
}

/**
 * OpenMetadata: a metadata platform in one page, after the MonoRail-Metadata
 * app. Its tabs (src/modules/openmetadata/tabs.ts) sit in a command bar in
 * the top bar; each is its own route. Catalog tabs read one catalog, picked
 * by the backend (electron/modules/openmetadata.cjs) and never by the page:
 * the copy on this PC of the BigQuery dataset that is the source of truth
 * while that is set up (the sync only keeps the copy fresh), else a connected
 * OpenMetadata server, else MonoRail's local database. There is no switch;
 * no server is contacted until the OpenMetadata connection is set up. The semantic-layer tabs read the
 * MetricFlow project (electron/modules/semantic.cjs).
 */
export default function OpenMetadataPage() {
  const [path] = useRoute()
  const tab = tabFromPath(path)
  const status = useCall<OmStatus>('status', {})
  // Every call below names the catalog that answered status, and the content remounts when it changes.
  const source = status.data?.source
  setSource(source)
  const ready = !!status.data && !status.data.block
  const counts = useCall<OmCounts>('counts', ready ? { source } : null)
  const [refresh, setRefresh] = useState(0)
  const reload = () => {
    status.reload()
    counts.reload()
  }
  useBigQuerySyncWatch(source === 'bigquery' && ready ? status.data?.bigquery : undefined, status.reload)
  const busy = status.loading || counts.loading
  const Tab = TAB_COMPONENTS[tab.id]
  const props: OmTabProps = { status: status.data, counts, source, reload }

  return (
    <div className="flex flex-col gap-6">
      <PageCommandBar
        title="OpenMetadata"
        description={tab.description}
        actions={
          <>
            <IconAction label="Guide" onClick={() => openWiki('guide/data/openmetadata')}>
              <BookOpen />
            </IconAction>
            <IconAction
              label="Refresh"
              disabled={busy}
              onClick={() => {
                reload()
                setRefresh((n) => n + 1)
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </IconAction>
          </>
        }
      >
        <PageTabs tabs={OM_TABS} active={tab.id} pathFor={tabPath} size="sm" sticky={false} hideIcons aria-label="OpenMetadata sections" />
      </PageCommandBar>

      {tab.catalog && !status.data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {status.error ? status.error : <><Loader2 className="size-4 animate-spin" /> Opening the catalog…</>}
        </div>
      ) : tab.catalog && status.data?.block ? (
        <BlockedCard status={status.data} onRetry={status.reload} />
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          }
        >
          <Tab key={`${tab.id}|${source ?? 'default'}|${refresh}`} {...props} />
        </Suspense>
      )}
      <MalloySettingsDialog />
    </div>
  )
}

/** How often the page looks at the BigQuery copy's status: while a sync runs, and otherwise. */
const WATCH_RUNNING_MS = 5_000
const WATCH_IDLE_MS = 30_000

/**
 * Keeps the page current with the BigQuery copy: whenever a sync finishes
 * (Sync now, Full refresh, or the schedule while the page is open), every
 * open list and entity reloads in place. The status call only reads the
 * copy's meta table, so looking every 30 seconds starts no sync and no
 * BigQuery request; it is skipped while the window is hidden.
 */
function useBigQuerySyncWatch(bq: BqStatus | undefined, reloadStatus: () => void) {
  const lastAt = bq?.last?.at
  const running = !!bq?.running
  const watching = !!bq

  // A finished sync wrote a new last result (or the first one): reload everything.
  // null: nothing seen yet for this source, so the first status only sets the mark.
  const seen = useRef<string | undefined | null>(null)
  useEffect(() => {
    if (!watching) {
      seen.current = null
      return
    }
    if (seen.current !== null && lastAt && seen.current !== lastAt) refreshData()
    seen.current = lastAt
  }, [watching, lastAt])

  // Look again quietly; reload the status (and with it the note) only when it moved.
  const now = useRef({ lastAt, running })
  useEffect(() => {
    now.current = { lastAt, running }
  })
  useEffect(() => {
    if (!watching) return
    let live = true
    const t = setInterval(() => {
      if (document.hidden) return
      call<OmStatus>('status', { source: 'bigquery' }).then(
        (s) => {
          if (!live) return
          const next = s.bigquery
          if (next?.last?.at !== now.current.lastAt || !!next?.running !== now.current.running) reloadStatus()
        },
        () => undefined,
      )
    }, running ? WATCH_RUNNING_MS : WATCH_IDLE_MS)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [watching, running, reloadStatus])
}

/** A small icon button for the command bar, named in a tooltip. */
function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label={label} disabled={disabled} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
