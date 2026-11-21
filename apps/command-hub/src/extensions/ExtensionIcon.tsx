import type { ComponentType } from 'react'
import { Puzzle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function ExtensionIcon({ extensionId, contributionId = '', hasIcon, className }: {
  extensionId: string
  contributionId?: string
  hasIcon: boolean
  className?: string
}) {
  if (!hasIcon) return <Puzzle className={className} />
  const url = `monorail-ext://${extensionId}/__monorail/icon?c=${encodeURIComponent(contributionId)}`
  return (
    <span
      aria-hidden
      className={cn('inline-block bg-current', className)}
      style={{ maskImage: `url("${url}")`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
    />
  )
}

/**
 * Nav icon for an extension contribution. The SVG is drawn as a CSS mask, so it
 * takes the nav's text color like a Lucide icon (draw it in one color, like
 * Lucide's 24px stroke icons). Falls back to a puzzle piece.
 */
const icons = new Map<string, ComponentType<{ className?: string }>>()

export function extensionIcon(extensionId: string, contributionId: string, hasIcon: boolean): ComponentType<{ className?: string }> {
  if (!hasIcon) return Puzzle
  const url = `monorail-ext://${extensionId}/__monorail/icon?c=${encodeURIComponent(contributionId)}`
  const known = icons.get(url)
  if (known) return known
  function ContributionIcon({ className }: { className?: string }) {
    return <ExtensionIcon extensionId={extensionId} contributionId={contributionId} hasIcon={hasIcon} className={className} />
  }
  icons.set(url, ContributionIcon)
  return ContributionIcon
}
