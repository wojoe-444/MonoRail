import { useEffect } from 'react'

import { formatIn } from '@/lib/format'

/**
 * Status of a cached result, as the shared cache primitive in electron/cache
 * reports it (ReportCache.status / KeyedCache.status).
 */
export interface CacheStatus {
  id: string
  /** When the last good result was built; undefined if there is none yet. */
  builtAt?: string
  ageMs?: number
  /** Time limit: older than this, the result is stale. */
  ttlMs: number
  stale: boolean
  /** A build is running now (Refresh, the schedule, or another window). */
  building?: boolean
  buildingSince?: string
  lastAttemptAt?: string
  /** The last build failed (the result shown is the last good one). */
  lastError?: string
  /** After a failure: the earliest time the schedule tries again. */
  nextRetryAt?: string
  /** Rebuilt in the background this often while the app runs. */
  scheduleMs?: number
}

/**
 * Re-read a cache while it builds (every `buildingMs`), and now and then
 * otherwise (every `idleMs`) to pick up background rebuilds. Reading never
 * starts a build, so this is cheap.
 */
export function useCachePolling(status: CacheStatus | undefined, reread: () => void, { buildingMs = 3000, idleMs = 60_000 } = {}) {
  const building = !!status?.building
  useEffect(() => {
    if (!status) return
    const id = window.setInterval(reread, building ? buildingMs : idleMs)
    return () => window.clearInterval(id)
  }, [status, building, reread, buildingMs, idleMs])
}

/** One line for a tooltip or notice: built time, limit, schedule, retry. */
export function describeCache(s: CacheStatus): string {
  const parts: string[] = []
  if (s.builtAt) parts.push(`Built ${new Date(s.builtAt).toLocaleString()}.`)
  parts.push(`Fresh for ${minutes(s.ttlMs)}.`)
  if (s.scheduleMs) parts.push(`Rebuilt every ${minutes(s.scheduleMs)} while MonoRail runs.`)
  if (s.lastError) parts.push(`Last attempt failed: ${s.lastError}`)
  if (s.nextRetryAt) parts.push(`Next automatic try ${formatIn(s.nextRetryAt)}.`)
  return parts.join(' ')
}

function minutes(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`
  return `${Math.round(ms / 3_600_000)} h`
}
