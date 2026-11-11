const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const full = new Intl.NumberFormat('en-US')

/** 1,284 / 12.9K / 4.2M */
export function formatCount(n: number): string {
  return Math.abs(n) < 10_000 ? full.format(Math.round(n)) : compact.format(n)
}

/** $0.42 / $12.30 / $1,284 / $12.9K */
export function formatUSD(n: number | undefined, opts: { compact?: boolean } = {}): string {
  if (n === undefined || !Number.isFinite(n)) return '–'
  if (opts.compact && Math.abs(n) >= 10_000) return `$${compact.format(n)}`
  const digits = Math.abs(n) >= 1000 ? 0 : 2
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function formatPercent(n: number | undefined, digits = 0): string {
  if (n === undefined || !Number.isFinite(n)) return '–'
  return `${(n * 100).toFixed(digits)}%`
}

/** +12% / −3.4% (true minus sign) */
export function formatSignedPercent(n: number): string {
  const v = Math.abs(n * 100).toFixed(Math.abs(n) < 0.1 ? 1 : 0)
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${v}%`
}

/** "Nov 3" from YYYY-MM-DD, local time. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatRelative(iso: string, now = Date.now()): string {
  const s = Math.round((now - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}
