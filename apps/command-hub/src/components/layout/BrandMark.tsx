import type { SVGProps } from 'react'

/**
 * The MonoHub mark: an "M" whose two rails meet at a hub node. Drawn in
 * currentColor so it sits on any tile; public/favicon.svg and build/icon.png
 * are the same glyph on the brand gradient.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M5 19V6.5l7 7.5 7-7.5V19"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="2.6" fill="currentColor" />
    </svg>
  )
}
