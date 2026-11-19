import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Clock, Database, KeyRound, Layers, Network, Sigma, SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import type { SemanticModel, SemanticProject } from '@/modules/semantic/types'

import { openInQuery, openMetric, takeSemanticModel } from './semantic/handoff'
import { TYPE_TONE } from './semantic/metricTypes'
import { Chips, Empty, Overline } from './semantic/parts'
import { SemanticFrame } from './semantic/project'
import { useSemanticProject } from './semantic/useSemanticProject'
import { useSemanticEngine } from './semantic/engine'
import { EngineSwitch } from './semantic/EngineSwitch'
import { MalloySemanticModels } from './semantic/MalloySources'
import type { OmTabProps } from './types'

/**
 * Semantic models, from Malloy (default) or MetricFlow; the engine switch is remembered per person.
 */
export default function SemanticModelsTab(_props: OmTabProps) {
  const [engine, setEngine] = useSemanticEngine()
  return (
    <div className="flex flex-col gap-6">
      <EngineSwitch engine={engine} onChange={setEngine} />
      {engine === 'malloy' ? <MalloySemanticModels /> : <MetricFlowSemanticModels />}
    </div>
  )
}

/**
 * The dbt project's semantic models: one card each (table, primary entity,
 * joins, counts), then one model's measures, dimensions, entities and joins,
 * and the metrics built on it. Shaped after the MonoRail-Metadata app's
 * Semantic models page, read from MetricFlow's semantic manifest.
 */
function MetricFlowSemanticModels() {
  const state = useSemanticProject()
  const [open, setOpen] = useState<string | undefined>(takeSemanticModel)
  return (
    <SemanticFrame state={state}>
      {(project) => {
        const model = open ? project.models.find((m) => m.name === open) : undefined
        return model ? <ModelDetail key={model.name} model={model} project={project} onBack={() => setOpen(undefined)} onOpen={setOpen} /> : <ModelGrid project={project} onOpen={setOpen} />
      }}
    </SemanticFrame>
  )
}

function tableName(m: SemanticModel): string | undefined {
  return m.relation ? [m.relation.database, m.relation.schema, m.relation.name].filter(Boolean).join('.') : m.model
}

interface Join {
  entity: string
  /** The model on the other side, when one has this entity as its primary key. */
  model?: string
  direction: 'out' | 'in'
}

/** Joins MetricFlow can make: from this model's foreign entities to the model they are primary in, and back. */
function joinsOf(m: SemanticModel, project: SemanticProject): Join[] {
  const out: Join[] = m.entities
    .filter((e) => e.type !== 'primary' && e.name !== m.primaryEntity)
    .map((e) => ({ entity: e.name, model: project.models.find((x) => x.name !== m.name && x.primaryEntity === e.name)?.name, direction: 'out' }))
  const incoming: Join[] = m.primaryEntity
    ? project.models
        .filter((x) => x.name !== m.name && x.entities.some((e) => e.name === m.primaryEntity && e.type !== 'primary'))
        .map((x) => ({ entity: m.primaryEntity!, model: x.name, direction: 'in' }))
    : []
  return [...out, ...incoming]
}

function metricsOn(m: SemanticModel, project: SemanticProject) {
  return project.metrics.filter((x) => x.semanticModels.includes(m.name))
}

// --- Grid ------------------------------------------------------------------

function ModelGrid({ project, onOpen }: { project: SemanticProject; onOpen: (name: string) => void }) {
  const [search, setSearch] = useState('')
  const s = search.trim().toLowerCase()
  const list = project.models.filter((m) => !s || [m.name, m.description, tableName(m)].some((x) => x?.toLowerCase().includes(s)))

  if (!project.models.length) {
    return (
      <Card>
        <Empty icon={Network} title="This project has no semantic models">
          Semantic models you define in the dbt project show up here after the next dbt parse.
        </Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField className="w-full max-w-xs" aria-label="Search semantic models" placeholder="Search semantic models" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="text-sm text-muted-foreground">Each semantic model is a table with entities (its keys), dimensions to split by and measures to aggregate.</p>
      </div>
      {list.length ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {list.map((m) => (
            <ModelCard key={m.name} model={m} project={project} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No semantic model matches “{search}”.</p>
      )}
    </div>
  )
}

function ModelCard({ model: m, project, onOpen }: { model: SemanticModel; project: SemanticProject; onOpen: (name: string) => void }) {
  const joins = joinsOf(m, project).filter((j) => j.direction === 'out')
  const metrics = metricsOn(m, project)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono">
          <button type="button" className="hover:underline" onClick={() => onOpen(m.name)}>
            {m.name}
          </button>
        </CardTitle>
        <CardDescription className="line-clamp-2">{m.description ?? (m.model ? `ref('${m.model}')` : 'No description')}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => onOpen(m.name)}>
            Open <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Overline>Table</Overline>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
              <Database className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{tableName(m) ?? '—'}</span>
            </span>
          </div>
          <div>
            <Overline>Primary entity</Overline>
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <KeyRound className="size-3.5 text-muted-foreground" />
              {m.primaryEntity ?? <span className="text-muted-foreground">None</span>}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          <Count n={m.measures.length} label="measures" />
          <Count n={m.dimensions.length} label="dimensions" />
          <Count n={m.entities.length} label="entities" />
          <Count n={metrics.length} label="metrics" />
        </div>
        {joins.length > 0 && (
          <div>
            <Overline>Joins</Overline>
            <div className="flex flex-wrap gap-1.5">
              {joins.map((j) => (
                <Badge key={j.entity} variant={j.model ? 'primary' : 'outline'} className="font-mono" title={j.model ? `Joins ${j.model} on ${j.entity}` : `No semantic model has ${j.entity} as its primary entity`}>
                  {j.model ?? '?'} · on {j.entity}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span>
      <span className="font-medium">{n}</span> <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

// --- Detail ----------------------------------------------------------------

type Section = 'measures' | 'dimensions' | 'joins' | 'metrics'

function ModelDetail({ model: m, project, onBack, onOpen }: { model: SemanticModel; project: SemanticProject; onBack: () => void; onOpen: (name: string) => void }) {
  const [section, setSection] = useState<Section>('measures')
  const joins = useMemo(() => joinsOf(m, project), [m, project])
  const metrics = metricsOn(m, project)
  const prefix = m.primaryEntity

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="ghost" size="icon" aria-label="All semantic models" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Semantic model</span>
          <h2 className="font-mono text-xl font-semibold">{m.name}</h2>
          {m.description && <p className="max-w-3xl text-sm text-muted-foreground">{m.description}</p>}
        </div>
        <Button className="ml-auto" disabled={!metrics.length} onClick={() => openInQuery({ metrics: metrics.slice(0, 2).map((x) => x.name), groupBy: ['metric_time__week'] })}>
          <SlidersHorizontal /> Query
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <Overline>Table</Overline>
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-sm">
              <Database className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{tableName(m) ?? '—'}</span>
            </span>
          </div>
          <div>
            <Overline>dbt model</Overline>
            <span className="font-mono text-sm">{m.model ? `ref('${m.model}')` : '—'}</span>
          </div>
          <div>
            <Overline>Primary entity</Overline>
            <span className="flex items-center gap-1.5 font-mono text-sm">
              <KeyRound className="size-3.5 text-muted-foreground" />
              {m.primaryEntity ?? <span className="text-muted-foreground">None: other models cannot join to it</span>}
            </span>
          </div>
          <div>
            <Overline>Default time dimension</Overline>
            <span className="flex items-center gap-1.5 font-mono text-sm">
              <Clock className="size-3.5 text-muted-foreground" />
              {m.defaultTimeDimension ?? <span className="text-muted-foreground">None</span>}
            </span>
          </div>
        </CardContent>
      </Card>

      <Segmented<Section>
        className="w-fit"
        aria-label="What to show"
        value={section}
        onChange={setSection}
        options={[
          { value: 'measures', label: `Measures ${m.measures.length}` },
          { value: 'dimensions', label: `Dimensions ${m.dimensions.length}` },
          { value: 'joins', label: `Entities and joins ${joins.length}` },
          { value: 'metrics', label: `Metrics ${metrics.length}` },
        ]}
      />

      {section === 'measures' && (
        <Card className="gap-0 py-0">
          {m.measures.length ? (
            <div className="flex flex-col divide-y">
              {m.measures.map((x) => {
                const using = metrics.filter((mt) => mt.measures.includes(x.name))
                return (
                  <div key={x.name} className="flex flex-wrap items-start gap-3 px-6 py-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{x.name}</span>
                        <Badge variant="outline" className="font-mono">
                          {x.agg}
                        </Badge>
                      </div>
                      {x.description && <p className="text-sm text-muted-foreground">{x.description}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Used by</span>
                        <Chips items={using.map((u) => u.name)} icon={Sigma} onClick={openMetric} empty="no metric yet" />
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" disabled={!using.length} onClick={() => openInQuery({ metrics: [using[0].name], groupBy: ['metric_time__week'] })} title={using.length ? `Query ${using[0].name}` : 'MetricFlow queries metrics; no metric reads this measure'}>
                      <SlidersHorizontal /> Query
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty icon={Sigma} title="No measures">This model only adds dimensions to the models that join it.</Empty>
          )}
        </Card>
      )}

      {section === 'dimensions' && (
        <Card className="gap-0 py-0">
          {m.dimensions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Dimension</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Group by as</th>
                    <th className="px-6 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {m.dimensions.map((d) => (
                    <tr key={d.name} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-6 py-2 font-mono text-xs">{d.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={d.type === 'time' ? 'info' : 'secondary'}>{d.type === 'time' ? `time · ${d.grain ?? 'day'}` : 'categorical'}</Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{prefix ? `${prefix}__${d.name}` : '—'}</td>
                      <td className="px-6 py-2 text-muted-foreground">{d.description ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={Layers} title="No dimensions" />
          )}
        </Card>
      )}

      {section === 'joins' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Entities</CardTitle>
              <CardDescription>The keys of this model. MetricFlow joins two models on an entity they share.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {m.entities.map((e) => (
                <div key={e.name} className="flex items-center gap-2">
                  <KeyRound className={cn('size-3.5', e.type === 'primary' ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-mono text-sm">{e.name}</span>
                  <Badge variant={e.type === 'primary' ? 'primary' : 'outline'} className="ml-auto">
                    {e.type}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="gap-0 py-0">
            {joins.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Join</th>
                    <th className="px-3 py-2 font-medium">Semantic model</th>
                    <th className="px-3 py-2 font-medium">On</th>
                    <th className="px-6 py-2 font-medium">Table</th>
                  </tr>
                </thead>
                <tbody>
                  {joins.map((j) => {
                    const other = project.models.find((x) => x.name === j.model)
                    return (
                      <tr key={`${j.direction}:${j.entity}:${j.model}`} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-6 py-2">
                          <Badge variant={j.direction === 'out' ? 'primary' : 'secondary'}>{j.direction === 'out' ? 'Brings in' : 'Joined from'}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {j.model ? (
                            <button type="button" className="hover:underline" onClick={() => onOpen(j.model!)}>
                              {j.model}
                            </button>
                          ) : (
                            <span className="text-muted-foreground" title={`No semantic model has ${j.entity} as its primary entity`}>
                              none
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{j.entity}</td>
                        <td className="px-6 py-2 font-mono text-xs text-muted-foreground">{other ? tableName(other) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <Empty icon={Network} title="No joins">No other semantic model shares an entity with this one.</Empty>
            )}
          </Card>
        </div>
      )}

      {section === 'metrics' && (
        <Card className="gap-0 py-0">
          {metrics.length ? (
            <div className="flex flex-col divide-y">
              {metrics.map((x) => (
                <div key={x.name} className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-muted/40">
                  <Sigma className="size-4 text-muted-foreground" />
                  <button type="button" className="flex min-w-0 flex-col text-left" onClick={() => openMetric(x.name)}>
                    <span className="text-sm font-medium hover:underline">{x.label ?? x.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{x.definition}</span>
                  </button>
                  <Badge variant={TYPE_TONE[x.type]} className="ml-auto">
                    {x.type}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => openInQuery({ metrics: [x.name], groupBy: ['metric_time__week'] })}>
                    <SlidersHorizontal /> Query
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Sigma} title="No metric reads this model" />
          )}
        </Card>
      )}
    </div>
  )
}
