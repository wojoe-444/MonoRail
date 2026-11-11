import { cn } from '@/lib/utils'

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  'aria-label': string
  className?: string
}

/** Single-select button group (MUI ToggleButtonGroup layout, shadcn styling). */
export function Segmented<T extends string>({ value, onChange, options, className, ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex h-9 items-center gap-1 rounded-lg border bg-muted p-1', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-7 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
