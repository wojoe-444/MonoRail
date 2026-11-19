import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

import { flatColumns } from './columns'
import { cellText, NUMERIC_TYPES } from './format'
import type { BqCell, BqField } from './types'

export function ResultGrid({ fields, rows, startIndex = 0, className }: { fields: BqField[]; rows: BqCell[][]; startIndex?: number; className?: string }) {
  const cols = flatColumns(fields)
  if (!cols.length) return <p className="p-6 text-sm text-muted-foreground">This query returned no columns.</p>
  return (
    <div className={cn('min-h-0 overflow-auto', className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            <th className="sticky left-0 z-20 border-r border-b bg-muted px-3 py-2 text-right font-medium text-muted-foreground">Row</th>
            {cols.map((c) => (
              <th key={c.label} title={c.type} className="border-r border-b px-3 py-2 text-left font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-accent/50">
              <td className="sticky left-0 border-r border-b bg-card px-3 py-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">{startIndex + i + 1}</td>
              {cols.map((c) => {
                const v = c.get(r) ?? null
                const text = cellText(v)
                return (
                  <td
                    key={c.label}
                    title={text.length > 60 ? text : undefined}
                    className={cn(
                      'max-w-[28rem] truncate border-r border-b px-3 py-1.5 whitespace-nowrap',
                      v === null && 'text-muted-foreground italic',
                      NUMERIC_TYPES.has(c.type) && 'text-right font-mono tabular-nums',
                      typeof v === 'object' && v !== null && 'font-mono text-xs',
                    )}
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-6 text-sm text-muted-foreground">There is no data to display.</p>}
    </div>
  )
}

/** "Results per page  1 – 50 of 1,240  < >", the console's pager. */
export function Pager({
  start,
  count,
  total,
  pageSize,
  onPageSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
  busy,
}: {
  start: number
  count: number
  total?: number
  pageSize: number
  onPageSize?: (n: number) => void
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  busy?: boolean
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-3 border-t px-4 py-1.5 text-xs text-muted-foreground">
      {onPageSize && (
        <label className="flex items-center gap-2">
          Results per page
          <NativeSelect className="h-7 w-20 text-xs" value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))}>
            {[25, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <span className="tabular-nums">
        {count ? `${(start + 1).toLocaleString()} – ${(start + count).toLocaleString()}` : '0'}
        {total !== undefined && ` of ${total.toLocaleString()}`}
      </span>
      <Button variant="ghost" size="icon" className="size-7" aria-label="Previous page" disabled={!canPrev || busy} onClick={onPrev}>
        <ChevronLeft />
      </Button>
      <Button variant="ghost" size="icon" className="size-7" aria-label="Next page" disabled={!canNext || busy} onClick={onNext}>
        <ChevronRight />
      </Button>
    </div>
  )
}
