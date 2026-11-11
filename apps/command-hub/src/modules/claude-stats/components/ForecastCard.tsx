import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatShortDate, formatUSD } from '@/lib/format'

import { MIN_DAYS_WITH_USAGE, TREND_DAYS, type Forecast } from '../forecast'

/**
 * T1: projected API-equivalent spend for the next period, as a range, with the
 * method and the days it was based on. No forecast when there are too few days.
 */
export function ForecastCard({ forecast }: { forecast: Forecast }) {
  const basis = `${formatShortDate(forecast.basis.start)} – ${formatShortDate(forecast.basis.end)}`
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle>Spend forecast</CardTitle>
        <CardDescription>
          {forecast.ok
            ? `API-equivalent cost for the next ${forecast.horizon.days} days, ${formatShortDate(forecast.horizon.start)} – ${formatShortDate(forecast.horizon.end)}.`
            : 'API-equivalent cost for the next period, from the recent daily trend.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-6 py-5">
        {forecast.ok ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatUSD(forecast.low, { compact: true })} – {formatUSD(forecast.high, { compact: true })}
              </span>
              <span className="text-sm text-muted-foreground">
                Most likely about <span className="font-medium text-foreground tabular-nums">{formatUSD(forecast.mid, { compact: true })}</span>
                {' · '}daily cost is {forecast.slopePerDay >= 0 ? 'rising' : 'falling'} by{' '}
                <span className="tabular-nums">{formatUSD(Math.abs(forecast.slopePerDay))}</span> a day
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Method: a straight line fitted to daily cost over {basis} ({TREND_DAYS} days, {forecast.daysWithUsage} with
              usage), carried forward day by day. The range is an 80% band from how far days scattered around the line.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not enough recent usage for a forecast: {forecast.daysWithUsage} of the last {TREND_DAYS} days ({basis}) had
            usage, and a forecast needs at least {MIN_DAYS_WITH_USAGE}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
