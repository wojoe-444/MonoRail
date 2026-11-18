import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { HEALTH_CLASS, HEALTH_LABEL, initials, PRIORITY_LABEL } from '../lib'
import type { Health, Member, StateType } from '../types'

/** A status drawn by its type: dashed (backlog), empty (unstarted), part-filled (started), check (completed), cross (canceled), arrows (triage). */
export function StatusIcon({ type, color, fill = 0.5, className }: { type: StateType; color: string; fill?: number; className?: string }) {
  const c = color
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', className: cn('shrink-0', className), 'aria-hidden': true }
  if (type === 'triage')
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="6" fill={c} />
        <path d="M4 5.5h5.5L8 4M10 8.5H4.5L6 10" stroke="var(--card)" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (type === 'backlog')
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="1.6 1.6" />
      </svg>
    )
  if (type === 'unstarted')
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" />
      </svg>
    )
  if (type === 'started') {
    const r = 2.75
    const len = 2 * Math.PI * r
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={c} strokeWidth="1.5" />
        <circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth={r * 2} strokeDasharray={`${len * Math.min(1, Math.max(0.15, fill))} ${len}`} transform="rotate(-90 7 7)" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="7" cy="7" r="6" fill={c} />
      {type === 'completed' ? <path d="M4.3 7.2l1.8 1.8 3.6-3.8" stroke="var(--card)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M5 5l4 4M9 5l-4 4" stroke="var(--card)" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  )
}

/** Priority: dashes (none), an exclamation tile (urgent), or 3 bars with 3/2/1 filled. */
export function PriorityIcon({ priority, className }: { priority: number; className?: string }) {
  const common = { width: 14, height: 14, viewBox: '0 0 14 14', className: cn('shrink-0', className), role: 'img', 'aria-label': PRIORITY_LABEL[priority] }
  if (priority === 0)
    return (
      <svg {...common}>
        {[2, 6, 10].map((x) => (
          <rect key={x} x={x} y="6.25" width="2.5" height="1.5" rx=".5" fill="currentColor" opacity=".55" />
        ))}
      </svg>
    )
  if (priority === 1)
    return (
      <svg {...common}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--warning)" />
        <path d="M7 3.8v4" stroke="var(--card)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7" cy="10.2" r=".9" fill="var(--card)" />
      </svg>
    )
  const filled = 5 - priority // high 3, medium 2, low 1
  return (
    <svg {...common}>
      {[0, 1, 2].map((n) => (
        <rect key={n} x={1.5 + n * 4} y={9 - n * 3} width="3" height={3.5 + n * 3} rx=".8" fill="currentColor" opacity={n < filled ? 0.9 : 0.25} />
      ))}
    </svg>
  )
}

export function Avatar({ member, size = 18, className }: { member: Member | undefined; size?: number; className?: string }) {
  if (!member)
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50', className)} style={{ width: size, height: size }} aria-label="No assignee" />
    )
  return (
    <span
      title={member.name}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{ width: size, height: size, background: member.color, fontSize: Math.max(8, size * 0.42) }}
    >
      {initials(member.name)}
    </span>
  )
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: color }} aria-hidden />
}

export function Chip({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-5 max-w-44 shrink-0 items-center gap-1 rounded-full border px-2 text-xs text-muted-foreground', className)}>
      {children}
    </span>
  )
}

export function EntityIcon({ icon, color, size = 16 }: { icon?: string; color: string; size?: number }) {
  if (icon) return <span style={{ fontSize: size * 0.85, lineHeight: 1 }} aria-hidden>{icon}</span>
  return <span className="inline-block shrink-0 rounded-[4px]" style={{ width: size * 0.75, height: size * 0.75, background: color }} aria-hidden />
}

export function HealthBadge({ health }: { health: Health | undefined }) {
  if (!health) return <span className="text-xs text-muted-foreground">No updates</span>
  return <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-xs font-medium', HEALTH_CLASS[health])}>{HEALTH_LABEL[health]}</span>
}

/** A small ring that fills with progress (0-100). */
export function ProgressRing({ percent, size = 16, className }: { percent: number; size?: number; className?: string }) {
  const r = size / 2 - 2
  const len = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className={cn('shrink-0', className)} aria-label={`${percent}% done`} role="img">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray={`${(len * percent) / 100} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="round" />
    </svg>
  )
}

export function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
