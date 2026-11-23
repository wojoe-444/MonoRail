import { createElement } from 'react'
import { Binary, Braces, Brackets, Calendar, CaseSensitive, Check, CircleDashed, Clock, Hash, Key, ToggleLeft, X, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { percentText, typeKind, type TableColumn, type TestStatus, type TypeKind } from './table'

const TYPE_ICON: Record<TypeKind, LucideIcon> = {
  text: CaseSensitive,
  number: Hash,
  date: Calendar,
  time: Clock,
  boolean: ToggleLeft,
  struct: Braces,
  array: Brackets,
  binary: Binary,
  other: CircleDashed,
}

/** A column's data type: an icon for its kind, then the type as the source spells it. */
export function TypeChip({ dataType, display, className }: { dataType?: string; display?: string; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground" aria-hidden>
        {createElement(TYPE_ICON[typeKind(dataType)], { className: 'size-3' })}
      </span>
      <span className="truncate font-mono text-xs text-muted-foreground">{(display ?? dataType ?? '–').toLowerCase()}</span>
    </span>
  )
}

export function KeyBadge({ label }: { label: TableColumn['key'] }) {
  if (!label) return null
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      <Key aria-hidden /> {label === 'Primary key' ? 'PK' : 'Unique'}
    </Badge>
  )
}

/** How full a column is: a thin bar (one series color) and the percent. */
export function FillBar({ share }: { share: number | undefined }) {
  if (share === undefined) return <span className="block text-right text-xs text-muted-foreground">–</span>
  const text = percentText(share)
  return (
    <span className="flex items-center justify-end gap-2" title={`${text} of values are set`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-r-full bg-(--series-1)" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="w-12 text-right font-mono text-xs tabular-nums">{text}</span>
    </span>
  )
}

const STATUS_LABEL: Record<TestStatus, string> = { Success: 'Passed', Failed: 'Failed', Aborted: 'Aborted', Queued: 'Queued' }
const STATUS_VARIANT: Record<TestStatus, 'success' | 'destructive' | 'warning' | 'info'> = { Success: 'success', Failed: 'destructive', Aborted: 'warning', Queued: 'info' }

export function TestBadge({ status }: { status: TestStatus | undefined }) {
  if (!status) return <Badge variant="outline">No result</Badge>
  return <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>{STATUS_LABEL[status] ?? status}</Badge>
}

/** The round mark before a test's name; the badge after it carries the word. */
export function TestMark({ status }: { status: TestStatus | undefined }) {
  const ok = status === 'Success'
  const bad = status === 'Failed'
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full',
        ok ? 'bg-success-soft text-success-soft-foreground' : bad ? 'bg-destructive-soft text-destructive-soft-foreground' : 'bg-muted text-muted-foreground',
      )}
      aria-hidden
    >
      {ok ? <Check className="size-3" /> : bad ? <X className="size-3" /> : <CircleDashed className="size-3" />}
    </span>
  )
}
