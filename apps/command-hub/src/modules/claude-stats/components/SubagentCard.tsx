import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCount, formatPercent, formatUSD } from '@/lib/format'

import { groupBy, perM } from '../transform'
import type { UsageFact } from '../types'

/** T2: spend by subagent model across the range, with each model's tokens and cost. */
export function SubagentCard({ facts }: { facts: UsageFact[] }) {
  const sub = facts.filter((f) => f.role === 'subagent')
  const rows = groupBy(sub, (f) => f.model).sort((a, b) => b.cost - a.cost)
  const total = rows.reduce((a, r) => a + r.cost, 0)
  const all = facts.reduce((a, f) => a + f.cost, 0)
  const tokens = (model: string, k: 'inputTokens' | 'cacheCreationTokens' | 'cacheReadTokens') =>
    sub.filter((f) => f.model === model).reduce((a, f) => a + f[k], 0)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Subagent spend</CardTitle>
        <CardDescription>
          {rows.length
            ? `${formatUSD(total)} on subagents, ${formatPercent(all ? total / all : undefined)} of API-equivalent cost in this range.`
            : 'Models that ran as subagents, with their tokens and cost.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto px-0 py-1">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No subagent usage in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2.5 pr-4 pl-6 font-medium">Subagent model</th>
                <th className="px-4 py-2.5 text-right font-medium">Input</th>
                <th className="px-4 py-2.5 text-right font-medium">Cache write</th>
                <th className="px-4 py-2.5 text-right font-medium">Cache read</th>
                <th className="px-4 py-2.5 text-right font-medium">Output</th>
                <th className="px-4 py-2.5 text-right font-medium">API cost</th>
                <th className="py-2.5 pr-6 pl-4 text-right font-medium">$ / M output</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.key} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="py-2.5 pr-4 pl-6 font-medium">{r.key}</td>
                  <td className="px-4 py-2.5 text-right">{formatCount(tokens(r.key, 'inputTokens'))}</td>
                  <td className="px-4 py-2.5 text-right">{formatCount(tokens(r.key, 'cacheCreationTokens'))}</td>
                  <td className="px-4 py-2.5 text-right">{formatCount(tokens(r.key, 'cacheReadTokens'))}</td>
                  <td className="px-4 py-2.5 text-right">{formatCount(r.outputTokens)}</td>
                  <td className="px-4 py-2.5 text-right">{formatUSD(r.cost)}</td>
                  <td className="py-2.5 pr-6 pl-4 text-right font-medium">{formatUSD(perM(r.cost, r.outputTokens))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
