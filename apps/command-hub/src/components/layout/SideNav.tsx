import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BrandTile } from '@/components/layout/BrandMark'
import { cn } from '@/lib/utils'

import { useSettingsAlerts } from '@/modules/settings/alerts'

import { useNavSections, type NavItem } from './nav'

interface SideNavProps {
  current: string
  onNavigate: (path: string) => void
}

/**
 * Permanent navigation drawer, styled after the Bot Dashboard in
 * wojoe-444/MC-Player: a 64px brand header aligned with the app bar, grouped
 * sections with overline labels, 40px items on soft pills, and the active
 * item filled with the drawer's primary color. The 72px rail expands on
 * hover or keyboard focus.
 *
 * Items with subpages never expand inside the drawer: they open a panel just
 * right of it with the item's pages (`NavFlyout`). The drawer stays open
 * while a panel is.
 */
export function SideNav({ current, onNavigate }: SideNavProps) {
  const [hovered, setHovered] = useState(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(collapseTimer.current), [])
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const collapsed = !hovered && !keyboardFocus && !flyoutOpen
  const navSections = useNavSections()
  const mainSections = navSections.filter((s) => !s.pinned)
  const settings = navSections.find((s) => s.pinned)?.items[0]
  const inSettings = !!settings && (current === settings.path || !!settings.children?.some((c) => c.path === current))
  const { alerts } = useSettingsAlerts()
  return (
    <aside
      data-slot="sidebar"
      tabIndex={0}
      aria-label="Navigation"
      onMouseEnter={() => { clearTimeout(collapseTimer.current); setHovered(true) }}
      onMouseLeave={() => { clearTimeout(collapseTimer.current); collapseTimer.current = setTimeout(() => setHovered(false), 250) }}
      onFocusCapture={(event) => { if (event.target.matches(':focus-visible')) setKeyboardFocus(true) }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyboardFocus(false) }}
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring transition-[width]',
        collapsed ? 'w-[72px] duration-500' : 'w-[256px] duration-200',
      )}
    >
      {/* Brand header: height matches the 64px top bar */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <BrandTile className="size-8" />
        {!collapsed && (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">MonoRail</span>
            <span className="truncate text-xs text-sidebar-muted-foreground">Agent hub</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Main">
        {mainSections.map((section, i) => (
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
                  {item.children && item.children.length > 0 ? (
                    <NavFlyout item={item} current={current} collapsed={collapsed} onNavigate={onNavigate} onOpenChange={setFlyoutOpen} />
                  ) : (
                    <NavButton item={item} current={current} collapsed={collapsed} onNavigate={onNavigate} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {settings && (
        // Settings: one button pinned at the bottom. Its pages (Connections,
        // Agent access, Extensions, ...) have their own menu on the Settings page.
        <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
          <NavButton
            item={{ ...settings, children: undefined, badge: alerts.length ? String(alerts.length) : undefined }}
            current={inSettings ? settings.path : current}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
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
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
          : 'bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {collapsed && item.badge && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning" aria-label={`${item.badge} need attention`} />}
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

/**
 * An item with subpages. It never expands inside the drawer: clicking it (or
 * Enter / Space / arrow keys) opens a panel just right of the drawer's edge
 * listing the item's own page first, then its subpages, the current one
 * highlighted. Same in the open drawer and on the icon rail. The drawer stays
 * open while the panel is (`onOpenChange`).
 */
function NavFlyout({
  item,
  current,
  collapsed,
  onNavigate,
  onOpenChange,
}: {
  item: NavItem
  current: string
  collapsed: boolean
  onNavigate: (path: string) => void
  onOpenChange: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const children = item.children ?? []
  const active = item.path === current
  const activeChild = children.find((c) => c.path === current)
  const Icon = item.icon
  const pages: { path: string; label: string; badge?: string }[] = [
    { path: item.path, label: item.path === '/agents' ? 'Sessions' : 'Overview' },
    ...children,
  ]

  const change = (next: boolean) => {
    setOpen(next)
    onOpenChange(next)
  }

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={collapsed ? `${item.label} pages` : undefined}
        className={cn(
          'relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          collapsed && 'justify-center px-0',
          active || activeChild
            ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
            : 'bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent',
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
            <span className="truncate">{item.label}</span>
            {activeChild && <span className="truncate text-[11px] font-normal opacity-75">{activeChild.label}</span>}
          </span>
        )}
        <ChevronRight className={cn('shrink-0 opacity-60', collapsed ? 'absolute right-1 size-3' : 'size-4')} />
      </button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu open={open} onOpenChange={change} modal={false}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      {/* The trigger sits 16px inside the drawer's edge: 24px puts the panel 8px past it. */}
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={24}
        alignOffset={-8}
        aria-label={`${item.label} pages`}
        className="min-w-44 rounded-xl p-1.5"
      >
        {pages.map((page) => {
          const on = page.path === current
          return (
            <DropdownMenuItem
              key={page.path}
              onSelect={() => onNavigate(page.path)}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'h-9 px-3 text-muted-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
                on && 'bg-muted font-semibold text-foreground',
              )}
            >
              <span className="flex-1 truncate">{page.label}</span>
              {page.badge && (
                <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] leading-5 font-semibold text-black">
                  {page.badge}
                </span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
