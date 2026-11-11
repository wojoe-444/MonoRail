/**
 * Categorical series colors, as CSS variables (light/dark values live in
 * index.css). Assign slots in this fixed order to entities ranked once on the
 * full dataset, so a filter never repaints a series. More than six series fold
 * into "Other".
 */
export const SERIES_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
] as const

export const OTHER_COLOR = 'var(--series-other)'

export function colorForSeries(order: string[], key: string, otherKey = 'Other'): string {
  if (key === otherKey) return OTHER_COLOR
  const i = order.indexOf(key)
  return i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : OTHER_COLOR
}

/** Shared axis styling for Recharts: recessive hairlines, muted ticks. */
export const axisProps = {
  stroke: 'var(--chart-axis)',
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
  tickLine: false,
} as const

export const gridProps = {
  stroke: 'var(--chart-grid)',
  vertical: false,
} as const
