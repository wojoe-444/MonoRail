import type { CallState, Source } from '../api'
import type { OmCounts, OmStatus } from '../types'

/**
 * What every OpenMetadata tab gets from the page. Catalog tabs only render
 * once the catalog has opened (`status.block` unset); semantic-layer tabs
 * render regardless and should not rely on `status`.
 */
export interface OmTabProps {
  status: OmStatus | undefined
  counts: CallState<OmCounts>
  source: Source | undefined
  /** Ask the page to reload status and counts (after an edit). */
  reload: () => void
}
