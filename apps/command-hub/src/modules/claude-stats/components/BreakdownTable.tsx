import { formatCount, formatPercent, formatUSD } from '@/lib/format'

import type { GroupRow } from '../transform'

interface Props {
  rows: GroupRow[]
  /** Column header for the group key. */
  label: string
  colorOf?: (key: string) => string
  /** Bar color when rows are not color-keyed (single hue). */
  barColor?: string
  extra?: { header: string; value: (row: GroupRow) => string }
  emptyText?: string
}

/**
 * Ranked breakdown: name, share-of-output bar, output, API-equivalent cost and
 * $ per M output tokens. Doubles as the table view for the charts above it.
 */
export function BreakdownTable({ rows, label, colorOf, barColor = 'var(--series-1)', extra, emptyText }: Props) {
  const totalOutput = rows.reduce((a, r) => a + r.outputTokens, 0)
  if (!rows.length) {
    return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyText ?? 'No usage in this range.'}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-medium text-muted-foreground">
            <th className="py-2.5 pr-4 pl-6 font-medium">{label}</th>
            <th className="w-[28%] px-4 py-2.5 font-medium">Share of output</th>
            <th className="px-4 py-2.5 text-right font-medium">Output</th>
            <th className="px-4 py-2.5 text-right font-medium">API cost</th>
            <th className="px-4 py-2.5 text-right font-medium">$ / M output</th>
            {extra && <th className="py-2.5 pr-6 pl-4 text-right font-medium">{extra.header}</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => {
            const share = totalOutput ? r.outputTokens / totalOutput : 0
            const color = colorOf?.(r.key) ?? barColor
            return (
              <tr key={r.key} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="py-2.5 pr-4 pl-6">
                  <div className="flex min-w-0 items-center gap-2">
                    {colorOf && <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />}
                    <span className="truncate font-medium" title={r.key}>
                      {r.key}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`, background: color }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{formatPercent(share)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">{formatCount(r.outputTokens)}</td>
                <td className="px-4 py-2.5 text-right">{formatUSD(r.cost)}</td>
                <td className="px-4 py-2.5 text-right font-medium">{formatUSD(r.costPerMOutput)}</td>
                {extra && <td className="py-2.5 pr-6 pl-4 text-right text-muted-foreground">{extra.value(r)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
