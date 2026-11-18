import { formatRelative } from '@/lib/format'

import type { OmCounts, OmTag } from './types'

/** Where the page is: the overview, one type's list, or one entity. */
export interface View {
  type?: string
  fqn?: string
}

export const displayName = (e: { displayName?: string; name?: string; fullyQualifiedName?: string } | undefined) =>
  e?.displayName || e?.name || e?.fullyQualifiedName?.split('.').pop() || 'Unnamed'

/** OpenMetadata times are epoch milliseconds. */
export const ago = (ms: number | undefined) => (ms ? formatRelative(new Date(ms).toISOString()) : '')

export const formatTime = (ms: number) => new Date(ms).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

/** A type's count from the counts map: nothing while loading, the error when the server lacks the type. */
export function countOf(counts: OmCounts | undefined, type: string): { n?: number; error?: string } {
  const c = counts?.[type]
  if (c === undefined) return {}
  return typeof c === 'number' ? { n: c } : { error: c.error }
}

export const isTier = (t: OmTag) => t.tagFQN.startsWith('Tier.')

export function tierOf(tags: OmTag[] | undefined) {
  return tags?.find(isTier)
}
