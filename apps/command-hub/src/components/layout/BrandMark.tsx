import { useId } from 'react'

import { cn } from '@/lib/utils'

/*
 * The MonoRail logo, "Mochi with a halo": a soft dough gumdrop with two dot
 * eyes, circled by a tilted loop track, on a moss-green tile. The same art is
 * the app icon (build/icon.svg, build/icon.png) and the favicon
 * (public/favicon.svg); keep the three in step.
 *
 * The logo is brand art, not themed UI: it keeps its own colors in every
 * palette and mode. The viewBox crops the icon's margin so the tile fills the
 * box; gradient ids are made unique per instance with useId.
 */
export function BrandTile({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  const tile = `${id}-tile`
  const dough = `${id}-dough`
  const soft = `${id}-soft`
  return (
    <span className={cn('flex shrink-0', className)}>
      <svg viewBox="12 12 232 232" className="size-full" aria-hidden>
        <defs>
          <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6f9a72" />
            <stop offset="1" stopColor="#3d6b52" />
          </linearGradient>
          <radialGradient id={dough} cx=".36" cy=".28" r=".85">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".45" stopColor="#f8f1e0" />
            <stop offset="1" stopColor="#dccaa4" />
          </radialGradient>
          <filter id={soft} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect x="12" y="12" width="232" height="232" rx="56" fill={`url(#${tile})`} />
        <g transform="rotate(-14 128 146)">
          <path d="M26 146a102 32 0 0 1 204 0" fill="none" stroke="#fbf6e8" strokeOpacity=".55" strokeWidth="10" strokeLinecap="round" />
        </g>
        <ellipse cx="128" cy="190" rx="54" ry="10" fill="#132a1f" opacity=".35" filter={`url(#${soft})`} />
        <path d="M66 156c0-48 28-82 62-82s62 34 62 82c0 22-28 32-62 32s-62-10-62-32z" fill={`url(#${dough})`} />
        <ellipse cx="110" cy="134" rx="6.5" ry="8.5" fill="#132a1f" />
        <ellipse cx="146" cy="134" rx="6.5" ry="8.5" fill="#132a1f" />
        <g transform="rotate(-14 128 146)">
          <path d="M26 146a102 32 0 0 0 204 0" fill="none" stroke="#fbf6e8" strokeWidth="10" strokeLinecap="round" />
          <circle cx="200" cy="168" r="13" fill="#ffcf7a" />
        </g>
      </svg>
    </span>
  )
}
