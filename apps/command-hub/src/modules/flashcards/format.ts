const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** A short span: "1m", "10m", "3h", "4d", "1.5mo", "2.1y". */
export function formatSpan(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))}m`
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}d`
  if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')}mo`
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`
}

/** When a card is due, relative to now: "now", "in 10m", "in 3d". */
export function formatDue(due: number, now = Date.now()): string {
  return due <= now ? 'now' : `in ${formatSpan(due - now)}`
}

/** Card text as one line for lists (Markdown markers dropped). */
export function plainLine(text: string, max = 140): string {
  const s = text
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
