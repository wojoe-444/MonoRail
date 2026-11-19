import { useMemo, useState } from 'react'
import { Database, Filter, Hash, Layers, Sigma, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import type { MetricType, SemanticMetric, SemanticProject } from '@/modules/semantic/types'

import { openInQuery, openSemanticModel, takeMetric } from './semantic/handoff'
import { TYPE_HELP, TYPE_TONE } from './semantic/metricTypes'
import { Arrow, Chips, Empty, Fact, Overline } from './semantic/parts'
import { SemanticFrame } from './semantic/project'
import { useSemanticProject } from './semantic/useSemanticProject'
import type { OmTabProps } from './types'

type TypeFilter = 'all' | MetricType
const TYPES: MetricType[] = ['simple', 'ratio', 'cumulative', 'derived', 'conversion']

/** Every metric of the dbt project's semantic layer: searchable list, then one metric's definition, lineage and dimensions. */
export default function MetricsTab(_props: OmTabProps) {
  const state = useSemanticProject()
  return <SemanticFrame state={state}>{(project) => <MetricsView project={project} />}</SemanticFrame>
}

function MetricsView({ project }: { project: SemanticProject }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [selected, setSelected] = useState<string | undefined>(() => takeMetric() ?? project.metrics[0]?.name)

  const list = useMemo(() => {
    const s = search.trim().toLowerCase()
    return project.metrics.filter(
      (m) =>
        (type === 'all' || m.type === type) &&
        (!s || [m.name, m.label, m.description, m.definition, ...m.semanticModels].some((x) => x?.toLowerCase().includes(s))),
    )
  }, [project.metrics, search, type])
  const metric = project.metrics.find((m) => m.name === selected) ?? list[0]
  const count = (t: MetricType) => project.metrics.filter((m) => m.type === t).length

  if (!project.metrics.length) {
    return (
      <Card>
        <Empty icon={Sigma} title="This project has no metrics">
          Metrics you define in the dbt project&apos;s semantic layer show up here after the next dbt parse.
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField className="w-full max-w-xs" aria-label="Search metrics" placeholder={`Search ${project.metrics.length} metrics`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Segmented<TypeFilter>
          aria-label="Metric type"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            ...TYPES.filter((t) => count(t) > 0).map((t) => ({ value: t, label: `${t[0].toUpperCase()}${t.slice(1)} ${count(t)}`, title: TYPE_HELP[t] })),
          ]}
        />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(280px,2fr)_3fr]">
        <Card className="gap-0 py-2">
          <div className="flex flex-col gap-0.5 px-2">
            {list.map((m) => {
              const active = m.name === metric?.name
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => setSelected(m.name)}
                  aria-current={active ? 'true' : undefined}
                  className={cn('flex flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors', active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-muted')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Sigma className="size-4 shrink-0 opacity-60" />
                    <span className="truncate text-sm font-medium">{m.label ?? m.name}</span>
                    <span className="truncate font-mono text-xs opacity-70">{m.name}</span>
                    <Badge variant={TYPE_TONE[m.type]} className="ml-auto text-[11px]">
                      {m.type}
                    </Badge>
                  </span>
                  {m.description && <span className="line-clamp-1 pl-6 text-xs opacity-80">{m.description}</span>}
                </button>
              )
            })}
            {!list.length && <p className="px-3 py-4 text-sm text-muted-foreground">No metric matches.</p>}
          </div>
        </Card>
        {metric && <MetricDetail key={metric.name} metric={metric} project={project} onSelect={setSelected} />}
      </div>
    </div>
  )
}

function MetricDetail({ metric: m, project, onSelect }: { metric: SemanticMetric; project: SemanticProject; onSelect: (name: string) => void }) {
  const dims = project.dimensions.filter((d) => m.dimensions.includes(d.name))
  const byModel = new Map<string, typeof dims>()
  for (const d of dims) byModel.set(d.semanticModel || 'Time', [...(byModel.get(d.semanticModel || 'Time') ?? []), d])
  const relations = m.semanticModels
    .map((s) => project.models.find((x) => x.name === s))
    .map((x) => (x?.relation ? [x.relation.database, x.relation.schema, x.relation.name].filter(Boolean).join('.') : x?.model))
    .filter((x): x is string => !!x)
  const usedBy = project.metrics.filter((x) => x.inputMetrics.includes(m.name))
  const known = new Set(project.metrics.map((x) => x.name))

  return (
    <Card className="gap-6 px-6 py-6 xl:sticky xl:top-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{m.label ?? m.name}</h3>
            <Badge variant={TYPE_TONE[m.type]} title={TYPE_HELP[m.type]}>
              {m.type}
            </Badge>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{m.name}</span>
          {m.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{m.description}</p>}
        </div>
        <Button className="ml-auto" onClick={() => openInQuery({ metrics: [m.name], groupBy: ['metric_time__week'] })}>
          <SlidersHorizontal /> Query this metric
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Fact label="How it is worked out" value={m.definition} />
        <Fact
          label="Filter"
          value={
            m.filter ? (
              <span className="flex items-start gap-1.5">
                <Filter className="mt-0.5 size-3 shrink-0" /> {m.filter}
              </span>
            ) : (
              'None'
            )
          }
          mono={!!m.filter}
        />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{TYPE_HELP[m.type]}</p>

      <div>
        <Overline>Where it comes from</Overline>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {m.inputMetrics.length > 0 && (
            <>
              <Chips items={m.inputMetrics} icon={Sigma} onClick={(x) => known.has(x) && onSelect(x)} />
              <Arrow />
            </>
          )}
          <Chips items={m.measures} icon={Hash} />
          <Arrow />
          <Chips items={m.semanticModels} icon={Layers} onClick={openSemanticModel} />
          <Arrow />
          <Chips items={relations} icon={Database} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Input metrics, then measures, then semantic models, then the tables they read.</p>
      </div>

      {usedBy.length > 0 && (
        <div>
          <Overline>Used by</Overline>
          <Chips items={usedBy.map((u) => u.name)} icon={Sigma} onClick={onSelect} />
        </div>
      )}

      <div>
        <Overline>Can be split by ({dims.length})</Overline>
        <div className="grid gap-3 sm:grid-cols-2">
          {[...byModel.entries()].map(([model, list]) => (
            <div key={model} className="rounded-lg p-3 ring-1 ring-foreground/10">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{model}</div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((d) => (
                  <button key={d.name} type="button" title={d.description ?? 'Query this metric split by it'} onClick={() => openInQuery({ metrics: [m.name], groupBy: [d.name] })}>
                    <Badge variant="outline" className="font-mono text-[11px] hover:bg-muted">
                      {d.name}
                      {d.type === 'time' && <span className="opacity-60">· time</span>}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
