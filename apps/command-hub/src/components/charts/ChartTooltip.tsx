import type { ReactNode } from 'react'

export interface TooltipRow {
  key: string
  label: string
  value: string
  color?: string
}

/** Tooltip body: title, then rows with the value first (strong) and the series name after. */
export function ChartTooltipContent({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-elevation-3">
      <div className="mb-1.5 font-medium text-muted-foreground">{title}</div>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.color && <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />}
            <span className="font-semibold tabular-nums">{r.value}</span>
            <span className="truncate text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">{footer}</div>}
    </div>
  )
}
