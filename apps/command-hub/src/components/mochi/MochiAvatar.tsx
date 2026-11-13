import { useId, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { MOCHI_ROLES, type MochiBody, type MochiEyes, type MochiRoleId } from './characters'
import { palette } from './flavors'
import { mochiFlavorFor, mochiRoleFor } from './match'

const INK = '#132a1f'

const BODIES: Record<MochiBody, { path: string; eyes: [number, number, number] }> = {
  gumdrop: { path: 'M66 156c0-48 28-82 62-82s62 34 62 82c0 22-28 32-62 32s-62-10-62-32z', eyes: [110, 146, 134] },
  tall: { path: 'M78 160c0-60 22-98 50-98s50 38 50 98c0 18-22 28-50 28s-50-10-50-28z', eyes: [112, 144, 124] },
  squat: { path: 'M54 166c0-38 32-62 74-62s74 24 74 62c0 16-32 24-74 24s-74-8-74-24z', eyes: [108, 148, 150] },
}

function eyes(kind: MochiEyes, body: MochiBody, [dx, dy]: [number, number] = [0, 0]): string {
  if (kind === 'none') return ''
  const [a, b, y0] = BODIES[body].eyes
  const y = y0 + dy
  return [a + dx, b + dx]
    .map((x) => {
      switch (kind) {
        case 'wide':
          return `<ellipse cx="${x}" cy="${y}" rx="8.5" ry="10.5" fill="${INK}"/><circle cx="${x - 2.5}" cy="${y - 4}" r="2.8" fill="#fff"/>`
        case 'focus':
          return `<path d="M${x - 7} ${y - 1}a7 8.5 0 0 0 14 0z" fill="${INK}"/>`
        case 'sleepy':
          return `<path d="M${x - 8} ${y - 2}q8 9 16 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`
        case 'content':
          return `<path d="M${x - 7} ${y + 2}q7-10 14 0" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`
        default:
          return `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="8.5" fill="${INK}"/>`
      }
    })
    .join('')
}

/** The SVG body for a role. Below 40px the tile props are left out. */
function markup(role: MochiRoleId, uid: string, small: boolean): string {
  const r = MOCHI_ROLES[role]
  const b = BODIES[r.body]
  return (
    `<defs><linearGradient id="t${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--t0)"/><stop offset="1" style="stop-color:var(--t1)"/></linearGradient>` +
    `<radialGradient id="d${uid}" cx=".36" cy=".28" r=".85"><stop offset="0" stop-color="#fff"/><stop offset=".45" style="stop-color:var(--b0)"/><stop offset="1" style="stop-color:var(--b1)"/></radialGradient>` +
    `<filter id="s${uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>` +
    `<clipPath id="k${uid}"><rect x="12" y="12" width="232" height="232" rx="56"/></clipPath></defs>` +
    `<rect x="12" y="12" width="232" height="232" rx="56" fill="url(#t${uid})"/><g clip-path="url(#k${uid})">` +
    (small ? '' : (r.tile ?? '')) +
    `<ellipse cx="128" cy="192" rx="58" ry="10" fill="${INK}" opacity=".35" filter="url(#s${uid})"/><path d="${b.path}" fill="url(#d${uid})"/>` +
    eyes(r.eyes, r.body, r.eyeOffset) +
    (r.head ?? '') +
    (r.front ?? '').replaceAll('url(#D)', `url(#d${uid})`) +
    '</g>'
  )
}

export interface MochiAvatarProps {
  role: MochiRoleId
  /** Flavor name from flavors.ts; defaults to the role's own. */
  flavor?: string
  /** Pixel size (square). */
  size?: number
  /** Accessible name; decorative when left out. */
  title?: string
  className?: string
}

/** One mochi crew character, drawn from the role's layers and a flavor palette. */
export function MochiAvatar({ role, flavor, size = 40, title, className }: MochiAvatarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const small = size < 40
  const html = useMemo(() => markup(role, uid, small), [role, uid, small])
  const p = palette(flavor ?? MOCHI_ROLES[role].flavor)
  const style = { '--t0': p.t0, '--t1': p.t1, '--b0': p.b0, '--b1': p.b1, '--acc': p.acc, '--pop': p.pop, '--onacc': p.onacc } as React.CSSProperties
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      style={style}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      // Static, repo-authored markup only (characters.ts); nothing from agents or users goes in.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Avatar for a named agent: role and flavor are picked from its name and description. */
export function AgentMochi({ name, description, size, className }: { name: string; description?: string; size?: number; className?: string }) {
  const role = mochiRoleFor(name, description)
  return <MochiAvatar role={role} flavor={mochiFlavorFor(name, role)} size={size} className={className} title={`${name} (${MOCHI_ROLES[role].label})`} />
}
