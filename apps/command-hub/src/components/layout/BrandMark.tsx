import type { SVGProps } from 'react'

/**
 * The MonoRail mark: an "M" riding a single rail. Drawn in currentColor so it
 * sits on any tile; public/favicon.svg and build/icon.png are the same glyph
 * on the brand gradient.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <g stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V5.5l6 6.5 6-6.5v11" />
        <path d="M3 20.5h18" />
      </g>
    </svg>
  )
}
