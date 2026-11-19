import { formatBytes } from '@/lib/format'

import type { MalloyEstimate } from './malloyClient'

/** "Scans 18.4 MB of your 1 GB limit", from a dry-run estimate. */
export function malloyScanText(estimate?: MalloyEstimate): string | undefined {
  if (!estimate) return undefined
  if (estimate.error) return `BigQuery's dry run failed: ${estimate.error}`
  if (estimate.bytes === undefined) return undefined
  return `Scans ${formatBytes(estimate.bytes)}${estimate.maxBytesBilled ? ` of your ${formatBytes(estimate.maxBytesBilled)} limit` : ''}`
}
