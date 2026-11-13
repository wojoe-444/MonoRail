// Expected end dates ("YYYY-MM-DD", local calendar days) in words.

export type DueTone = 'late' | 'soon' | 'later'

function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function parseDay(day: string): Date | undefined {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}

/** Whole days from today to `day` (negative when it has passed). */
export function daysUntil(day: string, now = new Date()): number | undefined {
  const d = parseDay(day)
  if (!d) return undefined
  return Math.round((d.getTime() - startOfToday(now).getTime()) / 86_400_000)
}

/** "Today", "Tomorrow", "Thu", "Nov 20" or "2 days late", with a tone for coloring. */
export function dueLabel(day: string, now = new Date()): { text: string; tone: DueTone } {
  const n = daysUntil(day, now)
  const d = parseDay(day)
  if (n === undefined || !d) return { text: day, tone: 'later' }
  if (n < 0) return { text: n === -1 ? '1 day late' : `${-n} days late`, tone: 'late' }
  if (n === 0) return { text: 'Today', tone: 'late' }
  if (n === 1) return { text: 'Tomorrow', tone: 'soon' }
  if (n < 7) return { text: d.toLocaleDateString(undefined, { weekday: 'short' }), tone: 'soon' }
  return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tone: 'later' }
}
