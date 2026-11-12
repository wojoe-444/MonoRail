import { useMemo, useState } from 'react'
import { AlertTriangle, Bookmark, Cable, Database, FileCode2, FolderOpen, Hash, Layers, Loader2, PlugZap, RefreshCw, Search, Sigma } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { formatRelative } from '@/lib/format'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isDesktop, useModuleQuery } from '@/modules/client'

import { QueryView, type QueryDraft } from './QueryView'
import { sampleProject } from './sample'
import type { MetricType, SemanticBlock, SemanticMetric, SemanticModel, SemanticProject } from './types'

type Tab = 'query' | 'metrics' | 'models' | 'saved'

export const TYPE_TONE: Record<MetricType, 'default' | 'secondary' | 'info' | 'success' | 'warning'> = {
  simple: 'secondary',
  ratio: 'info',
  cumulative: 'success',
  derived: 'warning',
  conversion: 'default',
}

export default function SemanticPage() {
  const desktop = isDesktop()
  const q = useModuleQuery<SemanticProject>('semantic', 'getProject')
  const project = q.data ?? (desktop ? undefined : sampleProject)
  const ready = !!project && !project.block
  const [tab, setTab] = useState<Tab>('query')
  const [draft, setDraft] = useState<QueryDraft>()

  function openInQuery(d: QueryDraft) {
    setDraft({ ...d, key: Date.now() })
    setTab('query')
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Insights"
        title="Semantic"
        description="Your dbt project's metrics, dimensions and semantic models, queried with MetricFlow. Browsing only reads the project's files; a query runs your own mf command."
        actions={
          <Button variant="outline" disabled={!desktop || q.fetching} onClick={() => void q.reload()} title="Reads target/semantic_manifest.json again">
            {q.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Reload project
          </Button>
        }
      />

      {!project ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {q.error ? q.error.message : (<><Loader2 className="size-4 animate-spin" /> Reading the dbt project…</>)}
        </div>
      ) : project.block ? (
        <BlockedCard block={project.block} detail={project.blockDetail} onRetry={() => void q.reload()} />
      ) : (
        <>
          <ProjectStrip project={project} />
          <Card className="gap-0 py-0">
            <CardHeader className="flex flex-wrap items-center gap-4 px-6 py-4">
              <Segmented
                className="w-fit"
                aria-label="What to show"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'query', label: 'Query' },
                  { value: 'metrics', label: `Metrics ${project.metrics.length}` },
                  { value: 'models', label: `Semantic models ${project.models.length}` },
                  { value: 'saved', label: `Saved queries ${project.savedQueries.length}` },
                ]}
              />
            </CardHeader>
            <Separator />
            {ready && tab === 'query' && <QueryView key={draft?.key} project={project} initial={draft} />}
            {tab === 'metrics' && <MetricsView project={project} onQuery={(m) => openInQuery({ metrics: [m], groupBy: ['metric_time__week'] })} />}
            {tab === 'models' && <ModelsView project={project} />}
            {tab === 'saved' && <SavedView project={project} onOpen={openInQuery} />}
          </Card>
        </>
      )}
    </div>
  )
}

const BLOCKS: Record<SemanticBlock, { title: string; body: string; icon: typeof PlugZap; warn?: boolean }> = {
  'not-set-up': {
    title: 'MetricFlow is not set up in MonoRail',
    body: 'MetricFlow is optional. Add the MetricFlow connection on Connections and pick your dbt project folder. Until then MonoRail looks at nothing: it does not search for dbt projects or Python, and it never installs MetricFlow.',
    icon: PlugZap,
  },
  'no-project': {
    title: 'The dbt project folder was not found',
    body: 'The folder in the MetricFlow connection has no dbt_project.yml, or it was moved. Pick the folder again on Connections.',
    icon: FolderOpen,
    warn: true,
  },
  'no-manifest': {
    title: 'This project has no semantic manifest yet',
    body: 'dbt writes target/semantic_manifest.json when it parses the project. Run "dbt parse" (or "mf validate-configs") in the project folder, then reload. MonoRail reads that file; it does not run dbt for you.',
    icon: FileCode2,
    warn: true,
  },
  'bad-manifest': {
    title: 'The semantic manifest could not be read',
    body: 'target/semantic_manifest.json is damaged or from a dbt version this page does not know. Parse the project again, then reload.',
    icon: AlertTriangle,
    warn: true,
  },
}

function BlockedCard({ block, detail, onRetry }: { block: SemanticBlock; detail?: string; onRetry: () => void }) {
  const b = BLOCKS[block]
  return (
    <Card className="items-start gap-4 px-6 py-8">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', b.warn ? 'bg-warning-soft text-warning-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')}>
        <b.icon className="size-5" />
      </span>
      <div className="flex max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">{b.title}</h2>
        <p className="text-sm text-muted-foreground">{b.body}</p>
        {detail && <p className="font-mono text-xs text-muted-foreground">{detail}</p>}
      </div>
      <div className="flex gap-2">
        {block === 'not-set-up' || block === 'no-project' ? (
          <Button onClick={() => navigate('/connections')}>
            <Cable /> {block === 'not-set-up' ? 'Set up on Connections' : 'Open Connections'}
          </Button>
        ) : (
          <Button onClick={onRetry}>
            <RefreshCw /> Reload project
          </Button>
        )}
      </div>
    </Card>
  )
}

function ProjectStrip({ project }: { project: SemanticProject }) {
  const p = project.project
  const mf = project.metricflow
  const parts = [
    p?.folderName,
    p?.dbtVersion && `dbt ${p.dbtVersion}`,
    `${project.metrics.length} metrics`,
    `${project.dimensions.length} dimensions`,
    `${project.models.length} semantic models`,
  ].filter(Boolean)
  return (
    <div className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Badge variant="secondary" className="font-mono">
        <Database /> {p?.name}
      </Badge>
      {parts.map((t, i) => (
        <span key={i} className="flex items-center gap-3">
          {i > 0 && <span className="text-foreground/20">·</span>}
          <span className="tabular-nums">{t}</span>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-3 text-xs">
        {mf.canRun && mf.found ? (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success" /> MetricFlow {mf.version ?? ''}
          </Badge>
        ) : (
          <Badge variant="secondary" title="Turn on “Run queries with MetricFlow” in the MetricFlow connection">
            Queries off
          </Badge>
        )}
        {p?.manifestAt && <span>Parsed {formatRelative(p.manifestAt)}</span>}
      </span>
    </div>
  )
}

// --- Metrics ---------------------------------------------------------------

function MetricsView({ project, onQuery }: { project: SemanticProject; onQuery: (metric: string) => void }) {
  const [search, setSearch] = useState('')
  const list = useMemo(() => {
    const s = search.trim().toLowerCase()
    return project.metrics.filter((m) => !s || m.name.includes(s) || m.label?.toLowerCase().includes(s) || m.description?.toLowerCase().includes(s))
  }, [project.metrics, search])
  const [selected, setSelected] = useState(project.metrics[0]?.name)
  const metric = project.metrics.find((m) => m.name === selected) ?? list[0]

  return (
    <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col border-b lg:border-r lg:border-b-0">
        <div className="relative px-4 pt-4 pb-2">
          <Search className="pointer-events-none absolute top-1/2 left-7 mt-1 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Find a metric" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col py-2">
          {list.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setSelected(m.name)}
              className={cn('mx-2 flex items-center gap-3 rounded-md px-4 py-2 text-left text-sm transition-colors', m.name === metric?.name ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted')}
            >
              <Sigma className="size-4 shrink-0 opacity-60" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{m.label ?? m.name}</span>
                <span className="truncate font-mono text-xs opacity-70">{m.name}</span>
              </span>
              <Badge variant={TYPE_TONE[m.type]} className="text-[11px]">
                {m.type}
              </Badge>
            </button>
          ))}
          {!list.length && <p className="px-6 py-4 text-sm text-muted-foreground">No metric matches.</p>}
        </div>
      </div>
      {metric && <MetricDetail metric={metric} project={project} onQuery={onQuery} />}
    </div>
  )
}

function MetricDetail({ metric: m, project, onQuery }: { metric: SemanticMetric; project: SemanticProject; onQuery: (metric: string) => void }) {
  const dims = project.dimensions.filter((d) => m.dimensions.includes(d.name))
  const byModel = new Map<string, typeof dims>()
  for (const d of dims) byModel.set(d.semanticModel || 'Time', [...(byModel.get(d.semanticModel || 'Time') ?? []), d])
  const dbtModels = m.semanticModels.map((s) => project.models.find((x) => x.name === s)?.model).filter(Boolean) as string[]

  return (
    <div className="flex min-w-0 flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{m.label ?? m.name}</h3>
            <Badge variant={TYPE_TONE[m.type]}>{m.type}</Badge>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{m.name}</span>
          {m.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{m.description}</p>}
        </div>
        <Button className="ml-auto" onClick={() => onQuery(m.name)}>
          <Search /> Query this metric
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Fact label="How it is worked out" value={m.definition} />
        <Fact label="Filter" value={m.filter ?? 'None'} mono={!!m.filter} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Where it comes from</span>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {m.inputMetrics.length > 0 && (
            <>
              <Chips items={m.inputMetrics} icon={Sigma} />
              <Arrow />
            </>
          )}
          <Chips items={m.measures} icon={Hash} />
          <Arrow />
          <Chips items={m.semanticModels} icon={Layers} />
          <Arrow />
          <Chips items={dbtModels} icon={Database} />
        </div>
        <p className="text-xs text-muted-foreground">Metric inputs, then measures, then semantic models, then the dbt models they are defined on.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Can be split by ({dims.length})</span>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...byModel.entries()].map(([model, list]) => (
            <div key={model} className="rounded-lg p-3 ring-1 ring-foreground/10">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{model}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((d) => (
                  <Badge key={d.name} variant="outline" className="font-mono text-[11px]" title={d.description}>
                    {d.name}
                    {d.type === 'time' && <span className="opacity-60">· time</span>}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg p-3 ring-1 ring-foreground/10">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={cn('text-sm', mono && 'font-mono text-xs break-all')}>{value}</span>
    </div>
  )
}

function Chips({ items, icon: Icon }: { items: string[]; icon: typeof Hash }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge key={i} variant="secondary" className="font-mono text-[11px]">
          <Icon /> {i}
        </Badge>
      ))}
    </span>
  )
}

function Arrow() {
  return <span className="text-muted-foreground">→</span>
}

// --- Semantic models -------------------------------------------------------

function ModelsView({ project }: { project: SemanticProject }) {
  return (
    <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
      {project.models.map((m) => (
        <ModelCard key={m.name} model={m} project={project} />
      ))}
    </CardContent>
  )
}

function ModelCard({ model: m, project }: { model: SemanticModel; project: SemanticProject }) {
  const joins = m.entities
    .filter((e) => e.type === 'foreign')
    .map((e) => ({ entity: e.name, to: project.models.find((x) => x.primaryEntity === e.name)?.name }))
  return (
    <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <Layers className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{m.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{m.model ? `ref('${m.model}')` : 'no dbt model'}</span>
        </div>
      </div>
      {m.description && <p className="-mt-2 text-sm text-muted-foreground">{m.description}</p>}
      <Group label="Entities">
        {m.entities.map((e) => (
          <Badge key={e.name} variant={e.type === 'primary' ? 'default' : 'outline'} className="font-mono text-[11px]">
            {e.name} <span className="opacity-70">· {e.type}</span>
          </Badge>
        ))}
      </Group>
      <Group label="Dimensions">
        {m.dimensions.map((d) => (
          <Badge key={d.name} variant="outline" className="font-mono text-[11px]" title={d.description}>
            {d.name}
            {d.type === 'time' && <span className="opacity-60">· {d.grain ?? 'time'}</span>}
          </Badge>
        ))}
      </Group>
      <Group label="Measures">
        {m.measures.length ? (
          m.measures.map((x) => (
            <Badge key={x.name} variant="secondary" className="font-mono text-[11px]" title={x.description}>
              {x.name} <span className="opacity-60">· {x.agg}</span>
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </Group>
      {joins.length > 0 && (
        <div className="mt-auto flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          {joins.map((j) => (
            <span key={j.entity}>
              Joins <span className="font-mono text-foreground">{j.to ?? '?'}</span> on <span className="font-mono text-foreground">{j.entity}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

// --- Saved queries ---------------------------------------------------------

function SavedView({ project, onOpen }: { project: SemanticProject; onOpen: (d: QueryDraft) => void }) {
  if (!project.savedQueries.length) {
    return <p className="px-6 py-10 text-sm text-muted-foreground">This project has no saved queries. Saved queries you define in dbt show up here.</p>
  }
  return (
    <div className="flex flex-col divide-y">
      {project.savedQueries.map((s) => (
        <div key={s.name} className="flex flex-wrap items-center gap-4 px-6 py-4 hover:bg-muted/40">
          <Bookmark className="size-4 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-sm font-medium">{s.name}</span>
            {s.description && <span className="text-sm text-muted-foreground">{s.description}</span>}
            <div className="flex flex-wrap gap-1.5">
              {s.metrics.map((m) => (
                <Badge key={m} variant="secondary" className="font-mono text-[11px]">
                  <Sigma /> {m}
                </Badge>
              ))}
              {s.groupBy.map((g) => (
                <Badge key={g} variant="outline" className="font-mono text-[11px]">
                  {g}
                </Badge>
              ))}
              {s.where.length > 0 && <Badge variant="outline">{s.where.length} filter{s.where.length > 1 ? 's' : ''}</Badge>}
            </div>
          </div>
          <Button variant="outline" onClick={() => onOpen({ metrics: s.metrics, groupBy: s.groupBy, where: s.where })}>
            Open in Query
          </Button>
        </div>
      ))}
    </div>
  )
}
