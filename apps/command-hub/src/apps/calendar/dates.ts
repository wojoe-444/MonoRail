/** Calendar dates are local civil dates, not UTC instants. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Complete Sunday–Saturday weeks covering the month, including adjacent dates. */
export function monthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const last = new Date(year, month + 1, 0)
  const count = Math.ceil((first.getDay() + last.getDate()) / 7) * 7
  return Array.from({ length: count }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
}
