import type { CSSProperties, SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The MonoRail mark: an "M" riding a single rail. Drawn in currentColor so it
 * sits on any tile. `BrandTile` puts it on the glossy black tile that
 * public/favicon.svg and build/icon.svg / icon.png (the .exe icon) also use.
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

/*
 * The logo is brand art, not themed UI: it stays glossy black in every
 * palette and mode, like the app icon. A light rim keeps it readable on dark
 * drawers; the top half carries a soft gloss highlight.
 */
const tileStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, rgb(255 255 255 / 0.30) 0%, rgb(255 255 255 / 0.04) 46%, transparent 47%), linear-gradient(180deg, #3b3b40 0%, #141416 48%, #000 100%)',
  boxShadow:
    'inset 0 1px 0 rgb(255 255 255 / 0.45), inset 0 0 0 1px rgb(255 255 255 / 0.12), 0 2px 6px rgb(0 0 0 / 0.35)',
}

/** The MonoRail logo: the mark in silver-white on a glossy black tile. */
export function BrandTile({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-lg text-white', className)}
      style={tileStyle}
    >
      <BrandMark className={cn('drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.6)]', markClassName)} />
    </span>
  )
}
