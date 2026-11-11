import { useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Loader2, RefreshCw, Terminal } from 'lucide-react'

import { Legend } from '@/components/charts/Legend'
import { colorForSeries } from '@/components/charts/palette'
import { StatTile } from '@/components/charts/StatTile'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { formatCount, formatRelative, formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isDesktop, useModuleQuery } from '@/modules/client'

import { BreakdownTable } from './components/BreakdownTable'
import { CostPerMChart } from './components/CostPerMChart'
import { StackedTimeChart } from './components/StackedTimeChart'
import { sampleReport } from './sample'
import {
  groupBy,
  inWindow,
  isoDate,
  normalize,
  pctChange,
  RANGES,
  seriesOf,
  seriesOrder,
  timeSeries,
  totals,
  windowFor,
  type Metric,
  type RangeKey,
} from './transform'
import type { UsageReport } from './types'

const MODULE_ID = 'claude-stats'

function sessionDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : isoDate(new Date(iso))
}

export default function ClaudeStatsPage() {
  const desktop = isDesktop()
  const query = useModuleQuery<UsageReport>(MODULE_ID, 'getUsage')
  const [useSample, setUseSample] = useState(!desktop)
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<Metric>('outputTokens')

  const sample = useMemo(() => (useSample ? sampleReport() : undefined), [useSample])
  const report = useSample ? sample : query.data

  const model = useMemo(() => {
    if (!report) return undefined
    const { facts, sessions } = normalize(report)
    const order = seriesOrder(facts)
    const w = windowFor(range, facts)
    const current = inWindow(facts, w)
    const previous = w.prev ? inWindow(facts, w.prev) : undefined
    const days = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 86_400_000) + 1
    const bucket = days > 120 ? ('week' as const) : ('day' as const)
    const sessionsInRange = sessions
      .map((s) => ({ ...s, date: sessionDate(s.lastActivity) }))
      .filter((s) => s.date >= w.start && s.date <= w.end)
    return {
      order,
      bucket,
      window: w,
      now: totals(current),
      prev: previous ? totals(previous) : undefined,
      series: timeSeries(current, w, order, metric, bucket),
      byModel: groupBy(current, (f) => seriesOf(f.model, order)),
      byProject: groupBy(current, (f) => f.project),
      sessions: sessionsInRange.sort((a, b) => b.outputTokens - a.outputTokens),
      prevSessions: w.prev
        ? sessions.filter((s) => {
            const d = sessionDate(s.lastActivity)
            return d >= w.prev!.start && d <= w.prev!.end
          }).length
        : undefined,
      empty: facts.length === 0,
    }
  }, [report, range, metric])

  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase()
  const prevLabel = range === 'all' ? undefined : `vs. previous ${rangeLabel.replace('last ', '')}`
  const sessionsByProject = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of model?.sessions ?? []) m.set(s.project, (m.get(s.project) ?? 0) + 1)
    return m
  }, [model])

  const headerActions = (
    <>
      {useSample ? (
        <Badge variant="warning">
          <FlaskConical /> Sample data
        </Badge>
      ) : report ? (
        <Badge variant={report.stale ? 'warning' : 'success'}>
          {report.stale ? 'Cached' : 'Live'} · updated {formatRelative(report.generatedAt)}
        </Badge>
      ) : null}
      {desktop && (
        <Button
          variant="outline"
          onClick={() => {
            setUseSample(false)
            void query.refresh({ refresh: true })
          }}
          disabled={query.fetching}
        >
          {query.fetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh
        </Button>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Insights"
        title="Claude Stats"
        description="Claude Code output by model and project, priced as if it ran on the API. Read locally with ccusage."
        actions={headerActions}
      />

      {!desktop && (
        <Notice icon={FlaskConical} tone="info">
          You are viewing fictional sample data in the browser. Open the desktop app to see your own usage, read from
          this computer with ccusage.
        </Notice>
      )}
      {desktop && query.error && !useSample && (
        <Notice icon={AlertTriangle} tone="destructive">
          <span>Couldn't read Claude usage with ccusage: {query.error.message}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setUseSample(true)}>
            Show sample data
          </Button>
        </Notice>
      )}
      {report?.stale && !useSample && (
        <Notice icon={AlertTriangle} tone="warning">
          Showing the last saved report because ccusage failed: {report.error}
        </Notice>
      )}

      {!report && query.loading && (
        <Card className="items-center gap-3 py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          Reading your Claude Code logs with ccusage. The first run can take a minute.
        </Card>
      )}

      {model?.empty && (
        <Notice icon={Terminal} tone="info">
          ccusage found no Claude Code usage on this computer. It reads the logs Claude Code writes under your user
          folder (.claude/projects).
        </Notice>
      )}

      {model && !model.empty && (
        <div className={cn('flex flex-col gap-6 transition-opacity', query.fetching && report && 'opacity-60')}>
          {/* Filters: one row, above everything they scope */}
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              aria-label="Date range"
              value={range}
              onChange={setRange}
              options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
            />
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              hero
              label="Cost per million output tokens"
              value={formatUSD(model.now.costPerMOutput)}
              delta={pctChange(model.now.costPerMOutput, model.prev?.costPerMOutput)}
              deltaLabel={prevLabel}
              upIsGood={false}
              hint={range === 'all' ? 'All input, cache and output cost ÷ output' : undefined}
            />
            <StatTile
              label="Output tokens"
              value={formatCount(model.now.outputTokens)}
              delta={pctChange(model.now.outputTokens, model.prev?.outputTokens)}
              deltaLabel={prevLabel}
            />
            <StatTile
              label="API-equivalent cost"
              value={formatUSD(model.now.cost, { compact: true })}
              delta={pctChange(model.now.cost, model.prev?.cost)}
              deltaLabel={prevLabel}
              upIsGood={false}
            />
            <StatTile
              label="Sessions"
              value={formatCount(model.sessions.length)}
              delta={pctChange(model.sessions.length, model.prevSessions)}
              deltaLabel={prevLabel}
            />
          </div>

          {/* Output over time */}
          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>{metric === 'cost' ? 'API-equivalent cost' : 'Output tokens'} over time</CardTitle>
              <CardDescription>
                By model, per {model.bucket}. Hover a column for the breakdown and that {model.bucket}'s cost per
                million output tokens.
              </CardDescription>
              <CardAction>
                <Segmented
                  aria-label="Metric"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: 'outputTokens', label: 'Output' },
                    { value: 'cost', label: 'Cost' },
                  ]}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 py-5">
              <Legend items={model.order.map((s) => ({ key: s, color: colorForSeries(model.order, s) }))} />
              <StackedTimeChart points={model.series} series={model.order} metric={metric} bucket={model.bucket} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="gap-0 py-0 xl:col-span-2">
              <CardHeader className="border-b px-6 py-5">
                <CardTitle>Cost per million output tokens</CardTitle>
                <CardDescription>All input, cache and output cost divided by output tokens.</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-5">
                <CostPerMChart points={model.series} bucket={model.bucket} average={model.now.costPerMOutput} />
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 xl:col-span-3">
              <CardHeader className="border-b px-6 py-5">
                <CardTitle>By model</CardTitle>
                <CardDescription>Which models did the work, and what each costs per unit of output.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 py-1">
                <BreakdownTable
                  rows={model.byModel}
                  label="Model"
                  colorOf={(k) => colorForSeries(model.order, k)}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>By project</CardTitle>
              <CardDescription>The folders your Claude Code sessions ran in.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 py-1">
              <BreakdownTable
                rows={model.byProject}
                label="Project"
                barColor="var(--highlight)"
                extra={{ header: 'Sessions', value: (r) => formatCount(sessionsByProject.get(r.key) ?? 0) }}
              />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Top sessions</CardTitle>
              <CardDescription>
                The {Math.min(model.sessions.length, 15)} sessions with the most output, {range === 'all' ? 'across all time' : `active in the ${rangeLabel}`}.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 py-1">
              <SessionsTable sessions={model.sessions.slice(0, 15)} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SessionsTable({ sessions }: { sessions: ReturnType<typeof normalize>['sessions'] }) {
  if (!sessions.length) return <p className="px-6 py-8 text-center text-sm text-muted-foreground">No sessions in this range.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2.5 pr-4 pl-6 font-medium">Project</th>
            <th className="px-4 py-2.5 font-medium">Models</th>
            <th className="px-4 py-2.5 font-medium">Last active</th>
            <th className="px-4 py-2.5 text-right font-medium">Output</th>
            <th className="px-4 py-2.5 text-right font-medium">API cost</th>
            <th className="py-2.5 pr-6 pl-4 text-right font-medium">$ / M output</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {sessions.map((s) => (
            <tr key={s.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
              <td className="max-w-64 truncate py-2.5 pr-4 pl-6 font-medium" title={s.id}>
                {s.project}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {s.models.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                {new Date(s.lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </td>
              <td className="px-4 py-2.5 text-right">{formatCount(s.outputTokens)}</td>
              <td className="px-4 py-2.5 text-right">{formatUSD(s.cost)}</td>
              <td className="py-2.5 pr-6 pl-4 text-right font-medium">
                {formatUSD(s.outputTokens ? (s.cost / s.outputTokens) * 1e6 : undefined)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof AlertTriangle
  tone: 'info' | 'warning' | 'destructive'
  children: React.ReactNode
}) {
  const tones = {
    info: 'bg-info-soft text-info-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    destructive: 'bg-destructive-soft text-destructive-soft-foreground',
  }
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 text-sm', tones[tone])}>
      <Icon className="size-4 shrink-0" />
      {children}
    </div>
  )
}
