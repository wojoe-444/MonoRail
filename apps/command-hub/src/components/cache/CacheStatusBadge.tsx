import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { describeCache as describe, type CacheStatus } from '@/lib/cache'
import { formatRelative } from '@/lib/format'

/**
 * Shows when cached data was built and whether it is stale (C2 in
 * docs/caching.md). Use it on every page that shows a cached result.
 */
export function CacheStatusBadge({ status }: { status: CacheStatus }) {
  const title = describe(status)
  if (status.building) {
    return (
      <Badge variant="info" title={title}>
        <Loader2 className="animate-spin" /> {status.builtAt ? `Updating · built ${formatRelative(status.builtAt)}` : 'Building…'}
      </Badge>
    )
  }
  if (status.lastError) {
    return (
      <Badge variant="warning" title={title}>
        <AlertTriangle /> {status.builtAt ? `Last good · ${formatRelative(status.builtAt)}` : 'Build failed'}
      </Badge>
    )
  }
  if (!status.builtAt) {
    return (
      <Badge variant="secondary" title={title}>
        <Clock /> Not built yet
      </Badge>
    )
  }
  return (
    <Badge variant={status.stale ? 'warning' : 'success'} title={title}>
      {status.stale ? <Clock /> : <CheckCircle2 />}
      {status.stale ? 'Stale' : 'Cached'} · built {formatRelative(status.builtAt)}
    </Badge>
  )
}
