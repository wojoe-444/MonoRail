import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Database, Loader2, MoreHorizontal, Play, Plus, RefreshCw, Server, Square } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'
import { openWiki } from '@/modules/wiki/store'

import { CATEGORY_LABELS, STATE_INFO, TYPE_INFO, call, duration, errorText, when } from './api'
import { takeAddIngestion } from './handoff'
import { PipelineDialog } from './PipelineDialog'
import { RunsDialog } from './RunsDialog'
import type { LocalService, Overview, Pipeline, PipelineType, ServerOverview, ServerService, ServiceRef, TestResult } from './types'

export default function ServicesPage() {
  const desktop = isDesktop()
  const [overview, setOverview] = useState<Overview>()
  const [server, setServer] = useState<ServerOverview>()
  const [serverLoading, setServerLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<ServiceRef>()
  const [adding, setAdding] = useState<{ target: ServiceRef; types: PipelineType[]; existing?: Pipeline }>()
  const [viewing, setViewing] = useState<Pipeline>()
  const [deleting, setDeleting] = useState<Pipeline>()
  // A service another page asked to add an ingestion to; used once, when the first overview arrives.
  const wanted = useRef(takeAddIngestion())

  const load = useCallback(async () => {
    try {
      const o = await call<Overview>('overview')
      setOverview(o)
      const kind = wanted.current
      wanted.current = undefined
      const s = kind ? o.services.find((x) => x.kind === kind && x.added) : undefined
      if (s) {
        const target: ServiceRef = { where: 'local', service: s }
        setSelected(target)
        if (s.localTypes.length) setAdding({ target, types: s.localTypes })
      }
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }, [])

  const loadServer = useCallback(async () => {
    setServerLoading(true)
    try {
      setServer(await call<ServerOverview>('serverOverview'))
    } catch (e) {
      setServer({ block: 'unreachable', error: errorText(e) })
    } finally {
      setServerLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (overview?.serverSetUp && !server && !serverLoading) void loadServer()
  }, [overview?.serverSetUp, server, serverLoading, loadServer])

  // While a local run is going, read the list again every three seconds.
  const anyRunning = !!overview?.pipelines.some((p) => p.running)
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => void load(), 3000)
    return () => clearInterval(t)
  }, [anyRunning, load])

  async function act(label: string, fn: () => Promise<unknown>, after: 'local' | 'server' = 'local') {
    setNotice('')
    try {
      await fn()
      setNotice(label)
    } catch (e) {
      setNotice(errorText(e))
    }
    if (after === 'server') await loadServer()
    else await load()
  }

  const localPipelines = overview?.pipelines ?? []
  const pipelinesOf = (ref: ServiceRef): Pipeline[] =>
    ref.where === 'local' ? localPipelines.filter((p) => p.extension?.monorail?.serviceKind === ref.service.kind) : (server?.pipelines ?? []).filter((p) => p.service?.id === ref.service.id)

  // Keep the open service fresh after reloads.
  const current: ServiceRef | undefined = useMemo(() => {
    if (!selected) return undefined
    if (selected.where === 'local') {
      const s = overview?.services.find((x) => x.kind === selected.service.kind)
      return s ? { where: 'local', service: s } : selected
    }
    const s = server?.services?.find((x) => x.id === selected.service.id)
    return s ? { where: 'server', service: s } : selected
  }, [selected, overview, server])

  const typesFor = (ref: ServiceRef): PipelineType[] => (ref.where === 'local' ? ref.service.localTypes : (server?.createTypes?.[ref.service.category] ?? []))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Data"
        title="Services"
        description="Where your data lives, and the ingestion pipelines that read it into a catalog. Built on OpenMetadata’s services and ingestion pipelines."
        actions={
          <>
            <Button variant="outline" onClick={() => openWiki('guide/setup/services')}>
              How it works
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void load()
                if (overview?.serverSetUp) void loadServer()
              }}
            >
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {!desktop && <Notice tone="info">This is fictional sample data. Services and pipelines work in the desktop app.</Notice>}
      {error && <Notice tone="destructive">{error}</Notice>}
      {overview?.catalogError && <Notice tone="warning">{overview.catalogError}</Notice>}
      {notice && (
        <div role="status" className="flex items-start justify-between gap-4 rounded-lg bg-muted px-4 py-3 text-sm">
          <span>{notice}</span>
          <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setNotice('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {!overview && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      )}

      {overview && !current && (
        <ServiceList
          overview={overview}
          server={server}
          serverLoading={serverLoading}
          onOpen={setSelected}
          onRetryServer={() => void loadServer()}
        />
      )}

      {overview && current && (
        <ServiceDetail
          target={current}
          pipelines={pipelinesOf(current)}
          canAdd={typesFor(current).length > 0}
          onBack={() => setSelected(undefined)}
          onAdd={() => setAdding({ target: current, types: typesFor(current) })}
          onEdit={(p) => setAdding({ target: current, types: [p.pipelineType], existing: p })}
          onViewRuns={setViewing}
          onDelete={setDeleting}
          act={act}
        />
      )}

      {adding && (
        <PipelineDialog
          target={adding.target}
          types={adding.types}
          existing={adding.existing}
          onClose={() => setAdding(undefined)}
          onSaved={(msg) => {
            const where = adding.target.where
            setAdding(undefined)
            setNotice(msg)
            void (where === 'server' ? loadServer() : load())
          }}
        />
      )}
      {viewing && <RunsDialog pipeline={viewing} onClose={() => setViewing(undefined)} />}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>The pipeline and its run history are removed from this PC. What it already put in the local catalog stays.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const p = deleting!
                setDeleting(undefined)
                void act(`Deleted ${p.name}.`, () => call('deletePipeline', { id: p.id }))
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------- list

function ServiceList({ overview, server, serverLoading, onOpen, onRetryServer }: { overview: Overview; server?: ServerOverview; serverLoading: boolean; onOpen: (r: ServiceRef) => void; onRetryServer: () => void }) {
  const [category, setCategory] = useState('')
  const added = overview.services.filter((s) => s.added)
  const notAdded = overview.services.filter((s) => !s.added)
  const failed = overview.pipelines.filter((p) => p.lastRun?.pipelineState === 'failed').length + (server?.pipelines ?? []).filter((p) => p.lastRun?.pipelineState === 'failed').length
  const nextRun = overview.pipelines.map((p) => p.nextRun).filter(Boolean).sort()[0]
  const categories = [...new Set((server?.services ?? []).map((s) => s.category))]
  const serverServices = (server?.services ?? []).filter((s) => !category || s.category === category)

  return (
    <>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>
          <b className="text-foreground tabular-nums">{added.length + (server?.services?.length ?? 0)}</b> services
        </span>
        <span>
          <b className="text-foreground tabular-nums">{overview.pipelines.length + (server?.pipelines?.length ?? 0)}</b> ingestion pipelines
        </span>
        <span>
          <b className={cn('tabular-nums', failed ? 'text-destructive' : 'text-foreground')}>{failed}</b> failed last run
        </span>
        <span>
          Next run on this PC <b className="text-foreground">{nextRun ? when(nextRun) : 'none scheduled'}</b>
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<Database className="size-4" />} title="On this PC" note="MonoRail runs these pipelines itself while it is open, into its local database." />
        {added.length ? (
          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-4 py-2.5 text-left font-medium">Service</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Connection</th>
                  <th className="px-4 py-2.5 text-left font-medium">Pipelines</th>
                  <th className="px-4 py-2.5 text-left font-medium">In the catalog</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {added.map((s) => (
                  <tr key={s.kind} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpen({ where: 'local', service: s })}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.displayName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{s.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {s.serviceType} <span className="text-muted-foreground">· {CATEGORY_LABELS[s.category] ?? s.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ConnectionBadge state={s.status?.state} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.pipelines}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.catalog ? `${s.catalog.tables} tables, ${s.catalog.schemas} schemas` : 'Nothing yet'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline">
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card className="px-6 py-5 text-sm text-muted-foreground">No data source is set up yet. Add SQLite or MetricFlow (a dbt project) on Connections to ingest it here.</Card>
        )}
        {notAdded.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Also possible on this PC: {notAdded.map((s) => s.title).join(', ')}.{' '}
            <Button variant="link" className="h-auto p-0" onClick={() => navigate('/connections')}>
              Set up on Connections
            </Button>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading icon={<Server className="size-4" />} title="On your OpenMetadata server" note="The server keeps these services' connections and runs their pipelines on its Airflow." />
        {!overview.serverSetUp ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 text-sm text-muted-foreground">
            <span>Add your OpenMetadata server on Connections to see its services and manage their ingestion pipelines here.</span>
            <Button variant="outline" onClick={() => navigate('/connections')}>
              Open Connections
            </Button>
          </Card>
        ) : serverLoading && !server ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading the server…
          </p>
        ) : server?.block ? (
          <Notice tone="warning">
            {server.block === 'rejected' ? 'OpenMetadata rejected the sign-in. Update it on Connections.' : `Could not reach the server${server.error ? `: ${server.error}` : '.'}`}{' '}
            <Button variant="link" className="h-auto p-0" onClick={onRetryServer}>
              Try again
            </Button>
          </Notice>
        ) : (
          <>
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Service categories">
                {['', ...categories].map((c) => (
                  <button key={c || 'all'} type="button" onClick={() => setCategory(c)} className={cn('rounded-full px-3 py-1 text-sm', category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                    {c ? CATEGORY_LABELS[c] ?? c : 'All'} {c ? (server?.services ?? []).filter((s) => s.category === c).length : (server?.services ?? []).length}
                  </button>
                ))}
              </div>
            )}
            {server?.problems?.length ? <Notice tone="warning">{server.problems.join(' ')}</Notice> : null}
            {serverServices.length ? (
              <Card className="gap-0 overflow-x-auto py-0">
                <table className="w-full text-sm">
                  <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                    <tr className="border-b">
                      <th className="px-4 py-2.5 text-left font-medium">Service</th>
                      <th className="px-4 py-2.5 text-left font-medium">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium">Pipelines</th>
                      <th className="px-4 py-2.5 text-left font-medium">Last ingestion</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {serverServices.map((s) => {
                      const ps = (server?.pipelines ?? []).filter((p) => p.service?.id === s.id)
                      const last = ps.map((p) => p.lastRun).filter(Boolean).sort((a, b) => b!.startDate - a!.startDate)[0]
                      return (
                        <tr key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onOpen({ where: 'server', service: s })}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{s.displayName || s.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{s.fullyQualifiedName}</div>
                          </td>
                          <td className="px-4 py-3">
                            {s.serviceType ?? '—'} <span className="text-muted-foreground">· {CATEGORY_LABELS[s.category] ?? s.category}</span>
                          </td>
                          <td className="px-4 py-3 tabular-nums">{ps.length}</td>
                          <td className="px-4 py-3">{last ? <RunBadge state={last.pipelineState} at={last.startDate} /> : <span className="text-muted-foreground">No runs</span>}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline">
                              Open
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            ) : (
              <Card className="px-6 py-5 text-sm text-muted-foreground">The server has no services yet. Add one in OpenMetadata, then refresh.</Card>
            )}
            {server?.truncated && <p className="text-xs text-muted-foreground">The server has more than 500 ingestion pipelines; the first 500 are shown.</p>}
          </>
        )}
      </section>
    </>
  )
}

// ---------------------------------------------------------------- one service

interface DetailProps {
  target: ServiceRef
  pipelines: Pipeline[]
  canAdd: boolean
  onBack: () => void
  onAdd: () => void
  onEdit: (p: Pipeline) => void
  onViewRuns: (p: Pipeline) => void
  onDelete: (p: Pipeline) => void
  act: (label: string, fn: () => Promise<unknown>, after?: 'local' | 'server') => Promise<void>
}

function ServiceDetail({ target, pipelines, canAdd, onBack, onAdd, onEdit, onViewRuns, onDelete, act }: DetailProps) {
  const local = target.where === 'local'
  const s = target.service
  const [test, setTest] = useState<TestResult>()
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')

  async function runTest() {
    if (target.where !== 'local') return
    setTesting(true)
    setTestError('')
    try {
      setTest(await call<TestResult>('testConnection', { kind: target.service.kind }))
    } catch (e) {
      setTestError(errorText(e))
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to services">
            <ArrowLeft />
          </Button>
          <div>
            <div className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {s.category} · {s.serviceType ?? '—'} · {local ? 'This PC' : 'OpenMetadata server'}
            </div>
            <h2 className="text-xl font-semibold">{s.displayName || s.name}</h2>
            {local && (target.service as LocalService).catalog && (
              <p className="text-sm text-muted-foreground">
                {(target.service as LocalService).catalog!.tables} tables in {(target.service as LocalService).catalog!.schemas} schemas in the local database
                {(target.service as LocalService).catalog!.updatedAt ? `, updated ${when((target.service as LocalService).catalog!.updatedAt)}` : ''}. Browse them on the OpenMetadata page or Explore.
              </p>
            )}
            {!local && (target.service as ServerService).description && <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground">{(target.service as ServerService).description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {local && (
            <>
              <Button variant="outline" onClick={() => navigate('/connections')}>
                Edit connection
              </Button>
              <Button variant="outline" onClick={() => void runTest()} disabled={testing}>
                {testing && <Loader2 className="animate-spin" />} Test connection
              </Button>
            </>
          )}
          <Button onClick={onAdd} disabled={!canAdd} title={canAdd ? undefined : 'MonoRail cannot create pipelines for this kind of service'}>
            <Plus /> Add ingestion
          </Button>
        </div>
      </div>

      {(test || testError) && (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold">Connection test</h3>
              <p className="text-sm text-muted-foreground">{testError || test?.summary}</p>
            </div>
            {test && <ConnectionBadge state={test.state} />}
          </div>
          {test && test.steps.length > 0 && (
            <ul className="divide-y px-5">
              {test.steps.map((st) => (
                <li key={st.name} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn('grid size-5 place-items-center rounded-full text-xs font-bold', st.passed ? 'bg-success-soft text-success-soft-foreground' : 'bg-destructive-soft text-destructive-soft-foreground')}>{st.passed ? '✓' : '!'}</span>
                  <span className="font-medium">{st.name}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{st.message}</span>
                </li>
              ))}
            </ul>
          )}
          {test?.hint && <p className="border-t px-5 py-3 text-sm text-muted-foreground">{test.hint}</p>}
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading title="Ingestion pipelines" note={local ? 'Deploy a pipeline to start its schedule on this PC.' : 'Deploying hands a pipeline to the server’s Airflow.'} />
        {pipelines.length ? (
          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b">
                  <th className="px-4 py-2.5 text-left font-medium">Pipeline</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Schedule</th>
                  <th className="px-4 py-2.5 text-left font-medium">Recent runs</th>
                  <th className="px-4 py-2.5 text-left font-medium">Last run</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pipelines.map((p) => (
                  <PipelineRow key={p.id} pipeline={p} local={local} onEdit={() => onEdit(p)} onViewRuns={() => onViewRuns(p)} onDelete={() => onDelete(p)} act={act} />
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card className="px-6 py-5 text-sm text-muted-foreground">
            No ingestion pipelines yet. {canAdd ? 'Use Add ingestion to read this service into the catalog.' : 'Add one in OpenMetadata.'}
          </Card>
        )}
      </section>
    </>
  )
}

function PipelineRow({ pipeline: p, local, onEdit, onViewRuns, onDelete, act }: { pipeline: Pipeline; local: boolean; onEdit: () => void; onViewRuns: () => void; onDelete: () => void; act: DetailProps['act'] }) {
  const after = local ? 'local' : 'server'
  const runNow = () => act(local ? `Started ${p.name}.` : `Asked the server to run ${p.name}.`, () => call(local ? 'run' : 'serverAction', local ? { id: p.id } : { id: p.id, action: 'run' }), after)
  const deploy = (on: boolean) => act(on ? `Deployed ${p.name}.` : `Undeployed ${p.name}: its schedule is off.`, () => (local ? call('setFlags', { id: p.id, deployed: on }) : call('serverAction', { id: p.id, action: 'deploy' })), after)
  const pause = () => act(p.enabled ? `Paused ${p.name}.` : `Resumed ${p.name}.`, () => (local ? call('setFlags', { id: p.id, enabled: !p.enabled }) : call('serverAction', { id: p.id, action: 'toggle' })), after)
  const kill = () => act(`Stopped ${p.name}.`, () => (local ? call('kill', { id: p.id }) : call('serverAction', { id: p.id, action: 'kill' })), after)

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="font-medium">{p.displayName || p.name}</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {!p.deployed && <Badge variant="secondary">Not deployed</Badge>}
          {p.deployed && !p.enabled && <Badge variant="warning">Paused</Badge>}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="primary">{TYPE_INFO[p.pipelineType]?.label ?? p.pipelineType}</Badge>
      </td>
      <td className="px-4 py-3">
        <div>{p.schedule}</div>
        {p.airflowConfig?.scheduleInterval && <div className="font-mono text-xs text-muted-foreground">{p.airflowConfig.scheduleInterval}</div>}
        {p.nextRun && <div className="text-xs text-muted-foreground">Next {when(p.nextRun)}</div>}
      </td>
      <td className="px-4 py-3">
        <RecentBars pipeline={p} />
      </td>
      <td className="px-4 py-3">
        {p.running ? (
          <Badge variant="info">
            <Loader2 className="size-3 animate-spin" /> Running
          </Badge>
        ) : p.lastRun ? (
          <>
            <RunBadge state={p.lastRun.pipelineState} at={p.lastRun.startDate} />
            <div className="max-w-64 truncate pt-1 text-xs text-muted-foreground" title={p.lastRun.error}>
              {p.lastRun.error ?? `${p.lastRun.records.toLocaleString()} records${p.lastRun.endDate ? ` · ${duration(p.lastRun.startDate, p.lastRun.endDate)}` : ''}`}
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">No runs</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          {p.running ? (
            <Button size="sm" variant="outline" onClick={() => void kill()}>
              <Square /> Kill
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => void runNow()} disabled={!local && !p.deployed} title={!local && !p.deployed ? 'Deploy it on the server first' : undefined}>
              <Play /> Run
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label={`More actions for ${p.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onViewRuns}>Runs and logs</DropdownMenuItem>
              {local ? (
                <DropdownMenuItem onSelect={() => void deploy(!p.deployed)}>{p.deployed ? 'Undeploy' : 'Deploy'}</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void deploy(true)}>{p.deployed ? 'Deploy again' : 'Deploy'}</DropdownMenuItem>
              )}
              {p.deployed && <DropdownMenuItem onSelect={() => void pause()}>{p.enabled ? 'Pause' : 'Resume'}</DropdownMenuItem>}
              {!local && <DropdownMenuItem onSelect={() => void kill()}>Kill running runs</DropdownMenuItem>}
              {local && (
                <>
                  <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------- small parts

function RecentBars({ pipeline }: { pipeline: Pipeline }) {
  const recent = (pipeline.recent ?? []).slice(0, 8).reverse()
  if (!recent.length) return <span className="text-muted-foreground">—</span>
  const max = Math.max(1, ...recent.map((r) => r.records))
  return (
    <div className="flex h-8 items-end gap-1" aria-label={`Last ${recent.length} runs`}>
      {recent.map((r) => (
        <span
          key={r.runId}
          title={`${STATE_INFO[r.pipelineState]?.label ?? r.pipelineState}, ${when(r.startDate)}, ${r.records} records`}
          className={cn('block w-2 rounded-t-sm', r.pipelineState === 'success' ? 'bg-success' : r.pipelineState === 'failed' ? 'bg-destructive' : r.pipelineState === 'partialSuccess' ? 'bg-warning' : 'bg-info')}
          style={{ height: `${r.pipelineState === 'failed' ? 20 : 25 + (75 * r.records) / max}%` }}
        />
      ))}
    </div>
  )
}

function RunBadge({ state, at }: { state: keyof typeof STATE_INFO; at?: number }) {
  const info = STATE_INFO[state] ?? { label: state, variant: 'secondary' as const }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant={info.variant}>{info.label}</Badge>
      {at && <span className="text-xs text-muted-foreground">{when(at)}</span>}
    </span>
  )
}

function ConnectionBadge({ state }: { state?: string }) {
  if (!state) return <Badge variant="secondary">Not checked</Badge>
  if (state === 'ok') return <Badge variant="success">Working</Badge>
  if (state === 'expired') return <Badge variant="warning">Expired</Badge>
  if (state === 'needs-setup') return <Badge variant="secondary">Needs setup</Badge>
  return <Badge variant="destructive">Not working</Badge>
}

function SectionHeading({ title, note, icon }: { title: string; note?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
      </h2>
      {note && <span className="text-sm text-muted-foreground">{note}</span>}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'info' | 'warning' | 'destructive'; children: React.ReactNode }) {
  const cls = tone === 'info' ? 'bg-info-soft text-info-soft-foreground' : tone === 'warning' ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-destructive-soft text-destructive-soft-foreground'
  return (
    <div role={tone === 'destructive' ? 'alert' : 'status'} className={cn('rounded-lg px-4 py-3 text-sm', cls)}>
      {children}
    </div>
  )
}
