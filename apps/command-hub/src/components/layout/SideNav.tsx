import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandTile } from '@/components/layout/BrandMark'
import { isDesktop } from '@/modules/client'
import { cn } from '@/lib/utils'

import { useNavSections, type NavItem } from './nav'

interface SideNavProps {
  current: string
  onNavigate: (path: string) => void
  collapsed: boolean
}

/**
 * Permanent navigation drawer, styled after the Bot Dashboard in
 * wojoe-444/MC-Player: a 64px brand header aligned with the app bar, grouped
 * sections with overline labels, 40px items on soft pills, and the active
 * item filled with the drawer's primary color. Collapses to a 72px icon rail.
 * The toggle lives in the top bar.
 */
export function SideNav({ current, onNavigate, collapsed }: SideNavProps) {
  const navSections = useNavSections()
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-[256px]',
      )}
    >
      {/* Brand header: height matches the 64px top bar */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <BrandTile className="size-8" markClassName="size-[18px]" />
        {!collapsed && (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">MonoRail</span>
            <span className="truncate text-xs text-sidebar-muted-foreground">Agent hub</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Main">
        {navSections.map((section, i) => (
          <div key={section.heading ?? i} className={cn(i > 0 && 'mt-4')}>
            {section.heading && !collapsed && (
              <div className="flex h-8 items-center px-3 text-[11px] font-semibold tracking-wider text-sidebar-muted-foreground uppercase">
                {section.heading}
              </div>
            )}
            {section.heading && collapsed && <div className="mx-2 mb-3 h-px bg-sidebar-border" />}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavButton item={item} current={current} collapsed={collapsed} onNavigate={onNavigate} />
                  {item.children && item.children.length > 0 && (
                    // Subpages: the same pills, indented under their parent.
                    <ul className={cn('mt-1 flex flex-col gap-1', !collapsed && 'ml-6')} aria-label={`${item.label} pages`}>
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <NavButton item={child} current={current} collapsed={collapsed} onNavigate={onNavigate} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="flex items-center justify-between border-t border-sidebar-border p-4 text-xs text-sidebar-muted-foreground">
          <span>Version {__APP_VERSION__}</span>
          {isDesktop() ? <Badge variant="success">desktop</Badge> : <Badge variant="info">browser preview</Badge>}
        </div>
      )}
    </aside>
  )
}

function NavButton({
  item,
  current,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  current: string
  collapsed: boolean
  onNavigate: (path: string) => void
}) {
  const active = item.path === current
  const Icon = item.icon
  const button = (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
          : 'bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
      {!collapsed && item.badge && (
        <span
          className={cn(
            'min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold',
            active ? 'bg-sidebar-primary-foreground/20' : 'bg-warning text-black',
          )}
        >
          {item.badge}
        </span>
      )}
    </button>
  )
  if (!collapsed) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
