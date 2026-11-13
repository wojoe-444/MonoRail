// Time as Jira writes it: weeks, days, hours and minutes, with 8-hour days
// and 5-day weeks ("1w 2d 3h 30m").

const UNIT: Record<string, number> = { w: 5 * 8 * 3600, d: 8 * 3600, h: 3600, m: 60 }

/** "1h 30m", "90m", "1.5h" or a plain number of hours to seconds; undefined when it can't be read. */
export function parseDuration(text: string): number | undefined {
  const s = text.trim().toLowerCase()
  if (!s) return undefined
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 3600)
  let total = 0
  let rest = s
  const part = /^\s*(\d+(?:\.\d+)?)\s*([wdhm])/
  for (let m = rest.match(part); m; m = rest.match(part)) {
    total += Number(m[1]) * UNIT[m[2]]
    rest = rest.slice(m[0].length)
  }
  if (rest.trim() || total <= 0) return undefined
  return Math.round(total)
}

/** Seconds to "1d 2h 30m" (8-hour days; weeks are written as days). */
export function formatDuration(seconds: number | undefined): string {
  let m = Math.round((seconds ?? 0) / 60)
  const d = Math.floor(m / 480)
  m -= d * 480
  const h = Math.floor(m / 60)
  m -= h * 60
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m'
}
