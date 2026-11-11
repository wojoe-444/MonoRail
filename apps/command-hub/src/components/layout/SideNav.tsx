import { PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandMark } from '@/components/layout/BrandMark'
import { cn } from '@/lib/utils'

import { navSections } from './nav'

interface SideNavProps {
  current: string
  onNavigate: (path: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * Permanent navigation drawer, modeled on MUI's Drawer + List:
 * 64px header aligned with the app bar, grouped sections with overline
 * subheaders, 40px list items on an 8px grid, and a footer for the account.
 * Collapses to a 72px icon rail (MUI "mini variant").
 */
export function SideNav({ current, onNavigate, collapsed, onToggleCollapsed }: SideNavProps) {
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* Brand header: height matches the 64px top bar */}
      <div className={cn('flex h-16 items-center gap-3 px-4', collapsed && 'justify-center px-0')}>
        <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-highlight text-sidebar-primary-foreground shadow-elevation-2">
          <BrandMark className="size-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              MonoRail
            </div>
            <div className="text-xs text-sidebar-muted-foreground">Agent hub</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {navSections.map((section, i) => (
          <div key={section.heading ?? i} className={cn(i > 0 && 'mt-6')}>
            {section.heading && !collapsed && (
              <div className="px-3 pb-2 text-[11px] font-semibold tracking-[0.08em] text-sidebar-muted-foreground uppercase">
                {section.heading}
              </div>
            )}
            {section.heading && collapsed && <div className="mx-3 mb-2 h-px bg-sidebar-border" />}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = item.path === current
                const Icon = item.icon
                const button = (
                  <button
                    type="button"
                    onClick={() => onNavigate(item.path)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <Icon
                      className={cn(
                        'size-[18px] shrink-0',
                        active ? 'text-sidebar-primary' : 'text-sidebar-muted-foreground group-hover:text-sidebar-accent-foreground',
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[11px] font-semibold text-sidebar-primary">
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
                return (
                  <li key={item.path}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <div className={cn('mt-2 flex items-center gap-3 rounded-lg px-3 py-2', collapsed && 'justify-center px-0')}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-highlight text-highlight-foreground">
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-sidebar-accent-foreground">Local profile</div>
              <div className="truncate text-xs text-sidebar-muted-foreground">Stored in AppData</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
