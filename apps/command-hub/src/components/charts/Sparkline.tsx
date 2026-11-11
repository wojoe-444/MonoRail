import { cn } from '@/lib/utils'

/**
 * Tiny trend line for KPI tiles (from the Bot Dashboard): a 2px line over a
 * 12% area fill in currentColor, so the caller picks the tone with a text
 * color. No axes; pair it with the figure it summarizes.
 */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null
  const w = 96
  const h = 32
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-8 w-24 shrink-0', className)} aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="currentColor" opacity="0.12" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
