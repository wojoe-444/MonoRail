import type { ReactNode } from 'react'
import { ChartNoAxesCombined, LayoutDashboard } from 'lucide-react'

import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { CLAUDE_STATS_PATH } from '@/modules/claude-stats'
import type { IconComponent } from '@/modules/types'

export const DASHBOARD_PATH = '/agents/dashboard'

/** The tabs of Bots > Dashboard, in order. Each is its own route. */
const TABS: { path: string; label: string; icon: IconComponent }[] = [
  { path: DASHBOARD_PATH, label: 'Overview', icon: LayoutDashboard },
  { path: CLAUDE_STATS_PATH, label: 'Claude Stats', icon: ChartNoAxesCombined },
]

/** Is this path one of the Dashboard tabs? */
export function isDashboardPath(path: string): boolean {
  return TABS.some((t) => t.path === path)
}

/** Bots > Dashboard: a horizontal tab bar above whichever tab is open. */
export function DashboardLayout({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Dashboard" className="-mt-2 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const active = t.path === path
          const Icon = t.icon
          return (
            <button
              key={t.path}
              type="button"
              onClick={() => navigate(t.path)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
