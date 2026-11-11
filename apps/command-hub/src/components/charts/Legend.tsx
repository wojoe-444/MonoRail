import { cn } from '@/lib/utils'

interface LegendProps {
  items: { key: string; label?: string; color: string }[]
  /** "rect" for bars/areas, "line" for lines (legend mirrors the mark). */
  shape?: 'rect' | 'line'
  className?: string
}

export function Legend({ items, shape = 'rect', className }: LegendProps) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs', className)}>
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={shape === 'rect' ? 'size-2.5 rounded-[3px]' : 'h-0.5 w-3 rounded-full'}
            style={{ background: i.color }}
          />
          <span className="text-foreground/80">{i.label ?? i.key}</span>
        </li>
      ))}
    </ul>
  )
}
