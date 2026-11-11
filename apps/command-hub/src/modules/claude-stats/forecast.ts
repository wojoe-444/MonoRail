import { addDays } from './transform'
import type { UsageFact } from './types'

/** Days of history the trend is fitted on, and how many of them need usage. */
export const TREND_DAYS = 14
export const MIN_DAYS_WITH_USAGE = 7
/** z for an 80% interval. */
const Z80 = 1.2816

export type Forecast =
  | { ok: false; basis: { start: string; end: string }; daysWithUsage: number }
  | {
      ok: true
      basis: { start: string; end: string }
      daysWithUsage: number
      horizon: { start: string; end: string; days: number }
      mid: number
      low: number
      high: number
      /** Change in daily cost per day, from the fitted line. */
      slopePerDay: number
    }

/**
 * Forecast API-equivalent spend for the next period as long as the selected
 * range, from a straight-line fit (least squares) to daily cost over the last
 * 14 days. The range is an 80% band from the scatter of days around the line,
 * treating days as independent. Days on the line that would go below zero
 * count as zero.
 */
export function forecastSpend(facts: UsageFact[], end: string, horizonDays: number): Forecast {
  const start = addDays(end, -(TREND_DAYS - 1))
  const daily = new Map<string, number>()
  for (let d = start; d <= end; d = addDays(d, 1)) daily.set(d, 0)
  for (const f of facts) if (daily.has(f.date)) daily.set(f.date, daily.get(f.date)! + f.cost)
  const ys = [...daily.values()]
  const daysWithUsage = ys.filter((y) => y > 0).length
  const basis = { start, end }
  if (daysWithUsage < MIN_DAYS_WITH_USAGE) return { ok: false, basis, daysWithUsage }

  const n = ys.length
  const xm = (n - 1) / 2
  const ym = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  ys.forEach((y, x) => {
    sxy += (x - xm) * (y - ym)
    sxx += (x - xm) ** 2
  })
  const slope = sxx ? sxy / sxx : 0
  const intercept = ym - slope * xm
  const resid = ys.map((y, x) => y - (intercept + slope * x))
  const sd = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / Math.max(n - 2, 1))

  let mid = 0
  for (let k = 1; k <= horizonDays; k++) mid += Math.max(0, intercept + slope * (n - 1 + k))
  const spread = Z80 * sd * Math.sqrt(horizonDays)
  return {
    ok: true,
    basis,
    daysWithUsage,
    horizon: { start: addDays(end, 1), end: addDays(end, horizonDays), days: horizonDays },
    mid,
    low: Math.max(0, mid - spread),
    high: mid + spread,
    slopePerDay: slope,
  }
}
