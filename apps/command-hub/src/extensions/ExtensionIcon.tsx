import type { ComponentType } from 'react'
import { Puzzle } from 'lucide-react'

import { cn } from '@/lib/utils'

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
  function ExtensionIcon({ className }: { className?: string }) {
    return (
      <span
        aria-hidden
        className={cn('inline-block bg-current', className)}
        style={{ maskImage: `url("${url}")`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
      />
    )
  }
  icons.set(url, ExtensionIcon)
  return ExtensionIcon
}
