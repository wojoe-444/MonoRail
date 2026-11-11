import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'

import { Sparkline } from '@/components/charts/Sparkline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelative, formatUSD } from '@/lib/format'
import { navigate } from '@/lib/router'
import { isDesktop, useModuleQuery } from '@/modules/client'

import { buildFacts } from './facts'
import { sampleReport } from './sample'
import { addDays, isoDate, sourceModelLabel } from './transform'
import type { UsageSummary } from './types'
import type { ClaudeAccountType } from '@/modules/connections/account'

interface SummaryEntry {
  builtAt: string
  stale: boolean
  summary: UsageSummary
}

/** The part of Connections' summary file this widget reads (no names or emails in it). */
type ConnectionsSummaries = Record<
  string,
  { summary?: { connections?: Record<string, { account?: { type: ClaudeAccountType; billedAtApiPrices: boolean } }> } } | undefined
>

const ACCOUNT_LABEL: Record<ClaudeAccountType, string> = { subscription: 'Subscription', api: 'API', enterprise: 'Enterprise', unknown: 'Unknown' }

/** Fictional digest for the browser dev server, from the sample report. */
function sampleSummary(): SummaryEntry {
  const { facts } = buildFacts(sampleReport())
  const today = isoDate(new Date())
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const byDay = new Map(days.map((d) => [d, 0]))
  const byModel = new Map<string, UsageSummary['topModels'][number]>()
  for (const f of facts) {
    if (!byDay.has(f.date)) continue
    byDay.set(f.date, byDay.get(f.date)! + f.cost)
    const k = `${f.source}|${f.rawModel}`
    const m = byModel.get(k) ?? { source: f.source, model: f.rawModel ?? f.model, cost: 0 }
    m.cost += f.cost
    byModel.set(k, m)
  }
  const summary: UsageSummary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    days: days.map((date) => ({ date, cost: byDay.get(date)! })),
    total: [...byDay.values()].reduce((a, b) => a + b, 0),
    topModels: [...byModel.values()].sort((a, b) => b.cost - a.cost).slice(0, 5),
  }
  return { builtAt: summary.generatedAt, stale: false, summary }
}

/**
 * Claude Stats on Home: last 30 days of API-equivalent cost and the top models,
 * read from the summary written after each build. Never starts a usage read.
 */
export function ClaudeStatsHomeWidget() {
  const desktop = isDesktop()
  const query = useModuleQuery<Record<string, SummaryEntry>>('home', 'getSummaries')
  // Home reads summary files only, so the account type comes from Connections' summary.
  const claudeAccount = desktop ? (query.data as ConnectionsSummaries | undefined)?.['connections.summary']?.summary?.connections?.claude?.account : undefined
  const sample = useMemo(() => (desktop ? undefined : sampleSummary()), [desktop])
  const entry = desktop ? query.data?.['claude-stats.summary'] : sample
  const s = entry?.summary
  const top = s?.topModels ?? []
  const max = Math.max(...top.map((m) => m.cost), 0.0001)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Claude Stats</CardTitle>
        <CardDescription>
          API-equivalent cost, last 30 days
          {claudeAccount && claudeAccount.type !== 'unknown' && ` · Claude: ${ACCOUNT_LABEL[claudeAccount.type]}${claudeAccount.billedAtApiPrices ? ', billed at API prices' : ''}`}
          {entry && ` · built ${formatRelative(entry.builtAt)}`}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => navigate('/claude-stats')}>
            Open
            <ArrowRight />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6 py-5">
        {!s ? (
          <p className="text-sm text-muted-foreground">
            {desktop && query.loading
              ? 'Reading the last summary…'
              : 'No summary yet. Open Claude Stats to build the first report; after that it is rebuilt in the background.'}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatUSD(s.total, { compact: true })}</span>
                <span className="text-xs text-muted-foreground">
                  {formatUSD(s.total / 30)} a day on average
                  {entry?.stale && (
                    <Badge variant="warning" className="ml-2">
                      Stale
                    </Badge>
                  )}
                </span>
              </div>
              <Sparkline data={s.days.map((d) => d.cost)} className="text-primary" />
            </div>
            <ul className="flex flex-col gap-2.5">
              {top.map((m) => (
                <li key={`${m.source}|${m.model}`} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate">{sourceModelLabel(m.model, m.source)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(m.cost / max) * 100}%` }} />
                  </span>
                  <span className="w-16 text-right tabular-nums text-muted-foreground">{formatUSD(m.cost, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}
