import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, FlaskConical, Loader2, RefreshCw, Terminal } from 'lucide-react'

import { Legend } from '@/components/charts/Legend'
import { colorForSeries } from '@/components/charts/palette'
import { StatTile } from '@/components/charts/StatTile'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { CacheStatusBadge } from '@/components/cache/CacheStatusBadge'
import { describeCache, useCachePolling } from '@/lib/cache'
import { formatCount, formatIn, formatPercent, formatRelative, formatUSD } from '@/lib/format'
import { cn } from '@/lib/utils'
import { isDesktop, useModuleQuery } from '@/modules/client'
import { claudeCostNote, useClaudeAccount } from '@/modules/connections/account'
import { ClaudeAccountBadge } from '@/modules/connections/ClaudeAccountBadge'

import { BreakdownTable } from './components/BreakdownTable'
import { CostPerMChart } from './components/CostPerMChart'
import { CompactionsCard } from './components/CompactionsCard'
import { EffortCostCard, EffortTimeCard, ThinkingShareCard } from './components/EffortCards'
import { FamilyShareCard } from './components/FamilyShareCard'
import { ForecastCard } from './components/ForecastCard'
import { SubagentCard } from './components/SubagentCard'
import { StepCostCard } from './components/StepCostCard'
import { TurnsCard } from './components/TurnsCard'
import { TokenTypeCard } from './components/TokenTypeCard'
import { buildFacts, modelSeriesKey, SOURCE_LABELS } from './facts'
import { effortOrder } from './effort'
import { forecastSpend } from './forecast'
import { StackedTimeChart } from './components/StackedTimeChart'
import { sampleReport } from './sample'
import {
  comboOrder,
  groupBy,
  groupCombos,
  normalizePartners,
  inWindow,
  isoDate,
  pctChange,
  RANGES,
  seriesOrder,
  timeSeries,
  totals,
  windowFor,
  type Metric,
  type RangeKey,
} from './transform'
import type { SessionFact, SourceId, UsageReport } from './types'

const MODULE_ID = 'claude-stats'

function sessionDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : isoDate(new Date(iso))
}

export default function ClaudeStatsPage() {
  const desktop = isDesktop()
  const query = useModuleQuery<UsageReport>(MODULE_ID, 'getUsage')
  // Subscription vs API/Enterprise decides whether Claude Code's cost is real spend.
  const claudeAccount = useClaudeAccount()
  const [useSample, setUseSample] = useState(!desktop)
  const [range, setRange] = useState<RangeKey>('30d')
  const [metric, setMetric] = useState<Metric>('outputTokens')
  const [source, setSource] = useState<'all' | SourceId>('all')
  const [breakout, setBreakout] = useState(false)
  const [splitEffort, setSplitEffort] = useState(false)

  const sample = useMemo(() => (useSample ? sampleReport() : undefined), [useSample])
  // Opening the page only reads the saved report; builds run from Refresh or the schedule.
  const cacheStatus = useSample ? undefined : query.data?.cache
  const { reload } = query
  const reread = useCallback(() => void reload({}), [reload])
  useCachePolling(query.fetching ? undefined : cacheStatus, reread)
  const report = useSample ? sample : query.data?.missing ? undefined : query.data

  const base = useMemo(() => (report ? buildFacts(report) : undefined), [report])

  const model = useMemo(() => {
    if (!report || !base) return undefined
    const sourceOk = (s: SourceId | undefined) => source === 'all' || (s ?? 'claude-code') === source
    const seriesKey = (f: (typeof base.facts)[number]) => modelSeriesKey(f, breakout)
    // Ranked on every source and date so filters never repaint a model.
    const order = seriesOrder(base.facts, 5, seriesKey)
    const modelOrder = breakout ? seriesOrder(base.facts) : order
    const facts = base.facts.filter((f) => sourceOk(f.source))
    const sessions = base.sessions.filter((s) => sourceOk(s.source))
    const partners = normalizePartners(report, base.facts, source === 'all' ? undefined : source)
    const w = windowFor(range, base.facts)
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
      series: timeSeries(current, w, order, seriesKey, metric, bucket),
      current,
      modelOrder,
      // Effort levels ranked on every source and date, so the ramp never shifts with a filter.
      effortLevels: effortOrder(base.facts),
      forecast: forecastSpend(facts, w.end, RANGES.find((r) => r.key === range)?.days ?? 30),
      turns: inWindow(report.scan?.turns ?? [], w).filter((t) => sourceOk(t.source)),
      compactions: inWindow(report.scan?.compactions ?? [], w).filter((c) => sourceOk(c.source)),
      hasScan: !!report.scan,
      partners: (() => {
        // Optional split by effort (Claude Code) / thinking level (pi): the phase's most common level.
        const all = splitEffort ? partners.facts.map((f) => ({ ...f, combo: `${f.combo} · ${effortLabel(f.effort)}` })) : partners.facts
        const corder = comboOrder(all)
        const pf = inWindow(all, w)
        const phasesBySession = new Map<string, typeof partners.phases>()
        for (const ph of partners.phases) {
          const list = phasesBySession.get(ph.sessionId) ?? []
          list.push(ph)
          phasesBySession.set(ph.sessionId, list)
        }
        return {
          available: !!report.partners && !report.partners.error,
          error: report.partners?.error,
          idleGapMinutes: report.partners?.idleGapMinutes ?? 120,
          order: corder,
          series: timeSeries(pf, w, corder, (f) => f.combo, metric, bucket),
          rows: groupCombos(pf, corder),
          phasesBySession,
        }
      })(),
      // Every model gets its own row; models outside the color slots share the "Other" color.
      byModel: groupBy(current, seriesKey),
      thinkingByModel: (() => {
        const m = new Map<string, { tokens: number; est: number }>()
        for (const f of current) {
          const k = seriesKey(f)
          const t = m.get(k) ?? { tokens: 0, est: 0 }
          t.tokens += f.thinkingTokens ?? 0
          t.est += f.thinkingEstimated ?? 0
          m.set(k, t)
        }
        return m
      })(),
      byProject: groupBy(current, (f) => f.project),
      sessions: sessionsInRange.sort((a, b) => b.outputTokens - a.outputTokens),
      prevSessions: w.prev
        ? sessions.filter((s) => {
            const d = sessionDate(s.lastActivity)
            return d >= w.prev!.start && d <= w.prev!.end
          }).length
        : undefined,
      empty: base.facts.length === 0,
      tiered: base.facts.some((f) => f.tierAbove !== undefined),
    }
  }, [report, base, range, metric, source, breakout, splitEffort])

  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase()
  const prevLabel = range === 'all' ? undefined : `vs. previous ${rangeLabel.replace('last ', '')}`
  const sessionsByProject = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of model?.sessions ?? []) m.set(s.project, (m.get(s.project) ?? 0) + 1)
    return m
  }, [model])

  const headerActions = (
    <>
      {claudeAccount && <ClaudeAccountBadge account={claudeAccount} link prefix="Claude: " />}
      {useSample ? (
        <Badge variant="warning">
          <FlaskConical /> Sample data
        </Badge>
      ) : cacheStatus ? (
        <CacheStatusBadge status={cacheStatus} />
      ) : null}
      {desktop && (
        <Button
          variant="outline"
          onClick={() => {
            setUseSample(false)
            void query.refresh({ refresh: true })
          }}
          disabled={query.fetching || !!cacheStatus?.building}
          title="Read the logs again now, skipping the saved report"
        >
          {query.fetching || cacheStatus?.building ? <Loader2 className="animate-spin" /> : <RefreshCw />}
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
        description="Claude Code, Gemini CLI and pi output by model and project, priced as if it ran on the API. Read from each tool's logs on this computer, so cloud sessions (Claude project threads, Claude Code on the web) are not included."
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
      {report && !useSample && report.ccusageError && (
        <Notice icon={AlertTriangle} tone="warning">
          ccusage failed, so Claude Code costs are list-price estimates from the logs: {report.ccusageError}
        </Notice>
      )}
      {report && !useSample && report.scanError && (
        <Notice icon={AlertTriangle} tone="warning">
          Couldn't read the session logs, so only ccusage's daily totals are shown: {report.scanError}
        </Notice>
      )}
      {base && base.unpriced.length > 0 && (
        <Notice icon={AlertTriangle} tone="warning">
          No list price for {base.unpriced.join(', ')}. Their cost is left out of estimates until the price table has a row for them.
        </Notice>
      )}
      {cacheStatus?.lastError && !useSample && (
        <Notice icon={AlertTriangle} tone="warning">
          <span>
            {report?.generatedAt
              ? `Showing the last good report, built ${formatRelative(report.generatedAt)}, because the last build failed: `
              : 'The usage report could not be built: '}
            {cacheStatus.lastError}
            {cacheStatus.nextRetryAt && ` It is tried again automatically ${formatIn(cacheStatus.nextRetryAt)}, or press Refresh.`}
          </span>
        </Notice>
      )}

      {!report && !useSample && desktop && (query.fetching || cacheStatus?.building) && (
        <Card className="items-center gap-3 py-16 text-center text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          {query.loading ? 'Opening the saved report…' : 'Building the usage report from your local logs. The first run can take a minute.'}
        </Card>
      )}

      {!useSample && desktop && query.data?.missing && !cacheStatus?.building && !cacheStatus?.lastError && !query.fetching && (
        <Card className="items-center gap-3 py-16 text-center text-sm text-muted-foreground" title={cacheStatus ? describeCache(cacheStatus) : undefined}>
          No usage report has been built yet. MonoRail builds one in the background shortly after it starts.
          <Button variant="outline" onClick={() => void query.refresh({ refresh: true })}>
            <RefreshCw /> Build it now
          </Button>
        </Card>
      )}

      {model?.empty && (
        <Notice icon={Terminal} tone="info">
          No Claude Code, Gemini CLI or pi usage was found on this computer. Each tool's logs are read from your user
          folder (.claude, .gemini and .pi). Cloud sessions keep their logs on Anthropic's servers and are not counted.
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
            <Segmented
              aria-label="Source"
              value={source}
              onChange={setSource}
              options={[
                { value: 'all' as const, label: 'All sources' },
                ...(base?.sources ?? []).map((s) => ({
                  value: s.id,
                  label: s.found ? SOURCE_LABELS[s.id] : `${SOURCE_LABELS[s.id]} · not found`,
                  disabled: !s.found,
                  title: s.found ? undefined : `No ${SOURCE_LABELS[s.id]} logs on this computer`,
                })),
              ]}
            />
            {model.tiered && (
              <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={breakout} onCheckedChange={setBreakout} />
                Split models at their prompt-size price tier
              </label>
            )}
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
              label={source === 'claude-code' && claudeAccount?.billedAtApiPrices ? 'Cost at API prices' : 'API-equivalent cost'}
              value={formatUSD(model.now.cost, { compact: true })}
              delta={pctChange(model.now.cost, model.prev?.cost)}
              deltaLabel={prevLabel}
              upIsGood={false}
              hint={source === 'all' || source === 'claude-code' ? claudeCostNote(claudeAccount) : undefined}
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
                By model, per {model.bucket}
                {breakout && ', with tiered models split at or below and above their prompt-size price threshold'}. Hover a column for the breakdown and that {model.bucket}'s cost per
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
                  extra={{ header: 'Thinking', value: (r) => formatThinking(model.thinkingByModel.get(r.key)) }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <ForecastCard forecast={model.forecast} />
            </div>
            <div className="xl:col-span-3">
              <SubagentCard facts={model.current} />
            </div>
          </div>

          <TokenTypeCard facts={model.current} window={model.window} bucket={model.bucket} />

          <FamilyShareCard facts={model.current} />

          <EffortTimeCard facts={model.current} window={model.window} bucket={model.bucket} levels={model.effortLevels} />
          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <EffortCostCard facts={model.current} order={model.modelOrder} levels={model.effortLevels} />
            <ThinkingShareCard facts={model.current} order={model.modelOrder} />
          </div>

          {model.hasScan && (
            <>
              <StepCostCard facts={model.current} order={model.modelOrder} />
              <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <TurnsCard turns={model.turns} order={model.modelOrder} />
                <CompactionsCard compactions={model.compactions} order={model.modelOrder} />
              </div>
            </>
          )}

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>Session partners</CardTitle>
              <CardDescription>
                Which models worked together. Each session is split into phases: one driver model on the main thread
                plus the models its subagents ran on. A new phase starts when the driver changes or after{' '}
                {Math.round(model.partners.idleGapMinutes / 60)} idle hours, so earlier work in a resumed session
                isn't counted as a partner.
              </CardDescription>
              <CardAction>
                <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
                  <Switch checked={splitEffort} onCheckedChange={setSplitEffort} />
                  Split by effort
                </label>
              </CardAction>
            </CardHeader>
            {model.partners.available ? (
              <>
                <CardContent className="flex flex-col gap-4 border-b px-6 py-5">
                  <Legend
                    items={model.partners.order.map((s) => ({ key: s, color: colorForSeries(model.partners.order, s) }))}
                  />
                  <StackedTimeChart
                    points={model.partners.series}
                    series={model.partners.order}
                    metric={metric}
                    bucket={model.bucket}
                  />
                </CardContent>
                <CardContent className="px-0 py-1">
                  <BreakdownTable
                    rows={model.partners.rows}
                    label="Partners (driver first)"
                    colorOf={(k) => colorForSeries(model.partners.order, k)}
                    extra={{
                      header: 'Subagent share · phases',
                      value: (r) => {
                        const c = r as (typeof model.partners.rows)[number]
                        return `${formatPercent(c.subagentShare)} · ${formatCount(c.phases)}`
                      },
                    }}
                  />
                </CardContent>
              </>
            ) : (
              <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
                {model.partners.error
                  ? `Couldn't read session phases from the logs: ${model.partners.error}`
                  : 'Refresh to read session phases from your logs.'}
              </CardContent>
            )}
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="border-b px-6 py-5">
              <CardTitle>By project</CardTitle>
              <CardDescription>The folders your sessions ran in.</CardDescription>
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
              <SessionsTable sessions={model.sessions.slice(0, 15)} phasesBySession={model.partners.phasesBySession} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SessionsTable({
  sessions,
  phasesBySession,
}: {
  sessions: SessionFact[]
  phasesBySession: Map<string, ReturnType<typeof normalizePartners>['phases']>
}) {
  if (!sessions.length) return <p className="px-6 py-8 text-center text-sm text-muted-foreground">No sessions in this range.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2.5 pr-4 pl-6 font-medium">Project</th>
            <th className="px-4 py-2.5 font-medium">Partners, by phase</th>
            <th className="px-4 py-2.5 font-medium">Last active</th>
            <th className="px-4 py-2.5 text-right font-medium">Output</th>
            <th className="px-4 py-2.5 text-right font-medium" title="Reasoning tokens, part of output. ~ = estimated from the thinking text (pi logs no count).">
              Thinking
            </th>
            <th className="px-4 py-2.5 text-right font-medium">API cost</th>
            <th className="py-2.5 pr-6 pl-4 text-right font-medium">$ / M output</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {sessions.map((s) => (
            <tr key={s.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
              <td className="max-w-64 truncate py-2.5 pr-4 pl-6 font-medium" title={s.id}>
                {s.project}
                {s.source && s.source !== 'claude-code' && (
                  <Badge variant="secondary" className="ml-2">
                    {SOURCE_LABELS[s.source]}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  {(phasesBySession.get(s.id) ?? []).length
                    ? phasesBySession.get(s.id)!.map((p, i) => (
                        <span key={p.key} className="flex items-center gap-1">
                          {i > 0 && <span className="text-xs text-muted-foreground">then</span>}
                          <Badge variant="secondary" title={`${formatCount(p.outputTokens)} output · ${formatUSD(p.cost)}`}>
                            {p.combo}
                          </Badge>
                          {p.effort && (
                            <Badge variant="outline" title="Effort (Claude Code) or thinking level (pi), as logged">
                              {p.effort}
                            </Badge>
                          )}
                        </span>
                      ))
                    : s.models.map((m) => (
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
              <td className="px-4 py-2.5 text-right text-muted-foreground">
                {formatThinking({ tokens: s.thinkingTokens ?? 0, est: s.thinkingEstimated ?? 0 })}
              </td>
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

/** Effort for a phase: Claude Code's effort level or pi's thinking level, as logged. */
function effortLabel(effort: string | undefined): string {
  return effort ? `${effort} effort` : 'effort not logged'
}

/** Thinking tokens, with "~" when part of the count was estimated from text (pi logs no count). */
function formatThinking(t: { tokens: number; est: number } | undefined): string {
  if (!t || !t.tokens) return '–'
  return `${t.est > 0 ? '~' : ''}${formatCount(t.tokens)}`
}
