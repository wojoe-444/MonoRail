import { Coins } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { ReplyCost } from './cost'
import { formatTokens, formatUsd } from './live'
import type { ChatTotal } from './types'

/** Detailed view: one row per model call, then the reply's total and call count (T1, T2). */
export function ReplyDetails({ cost }: { cost: ReplyCost }) {
  const main = cost.calls.filter((c) => !c.subagent)
  const sub = cost.calls.filter((c) => c.subagent)
  const anyEstimate = cost.calls.some((c) => c.estimate)
  return (
    <div className="ml-11 overflow-hidden rounded-lg border text-xs">
      <table className="w-full tabular-nums">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-1.5 [&>th]:font-medium">
            <th className="text-left">Model call</th>
            <th className="text-right">Cost</th>
            <th className="text-right">Input</th>
            <th className="text-right">Cache read</th>
            <th className="text-right">Cache write</th>
            <th className="text-right">Output</th>
          </tr>
        </thead>
        <tbody className="divide-y font-mono">
          {[...main, ...sub].map((c, i) => (
            <tr key={i} className="[&>td]:px-3 [&>td]:py-1.5">
              <td className="max-w-48 truncate text-left" title={c.model}>
                {c.subagent && (
                  <Badge variant="outline" className="mr-1.5 h-4 px-1 font-sans text-[10px]">
                    Subagent
                  </Badge>
                )}
                {c.model ?? 'unknown'}
              </td>
              <td className="text-right" title={c.estimate ? "Estimate: this call's share of the reply's cost, by token weight" : undefined}>
                {c.cost === undefined ? '—' : `${c.estimate ? '≈' : ''}${formatUsd(c.cost)}`}
              </td>
              <td className="text-right">{formatTokens(c.input)}</td>
              <td className="text-right">{formatTokens(c.cacheRead)}</td>
              <td className="text-right">{formatTokens(c.cacheWrite)}</td>
              <td className="text-right">{formatTokens(c.output)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/30 px-3 py-1.5 text-muted-foreground">
        <span className="font-medium text-foreground">{cost.total === undefined ? 'Cost unknown' : `Total ${formatUsd(cost.total)}`}</span>
        <span>
          {main.length} model {main.length === 1 ? 'call' : 'calls'}
          {sub.length > 0 && `, plus ${sub.length} subagent ${sub.length === 1 ? 'call' : 'calls'}`}
        </span>
        {anyEstimate && <span>≈ split by token weight</span>}
      </div>
    </div>
  )
}

/** The chat's total in the conversation header (C1). Never reads complete when it is not. */
export function TotalChip({ total, sinceOpened }: { total?: ChatTotal; sinceOpened: number }) {
  let label: string
  let tip: string
  if (total?.complete && total.usd !== undefined) {
    label = formatUsd(total.usd + sinceOpened)
    tip = 'Everything this chat has cost.'
  } else if (total?.usd !== undefined) {
    label = `≥ ${formatUsd(total.usd + sinceOpened)}`
    tip = 'At least this much: turns ran outside MonoRail after its last cost record.'
  } else {
    label = sinceOpened > 0 ? `${formatUsd(sinceOpened)} since opened` : 'Cost unknown'
    tip =
      total?.reason === 'too-big'
        ? 'This log is too big to read whole, so only spend since you opened the chat is counted.'
        : "No cost record for this chat yet, so only spend since you opened it is counted. Claude's logs do not store costs."
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 tabular-nums">
          <Coins className="size-3" /> {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}
