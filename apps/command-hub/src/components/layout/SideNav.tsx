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
 * Permanent 72px icon rail with a 64px brand header aligned with the app bar,
 * section dividers, 40px items on soft pills, and hover/focus labels to the
 * right. The active item is filled with the drawer's primary color.
 *
 * Items with subpages never expand inside the drawer: they open a panel just
 * right of it with the item's pages (`NavFlyout`). The rail stays the same
 * width during hover, keyboard focus, and open panels.
 */
export function SideNav({ current, onNavigate }: SideNavProps) {
  const navSections = useNavSections()
  const mainSections = navSections.filter((s) => !s.pinned)
  const settings = navSections.find((s) => s.pinned)?.items[0]
  const inSettings = !!settings && (current === settings.path || !!settings.children?.some((c) => c.path === current))
  const { alerts } = useSettingsAlerts()
  return (
    <div className="h-full shrink-0">
      <aside
        data-slot="sidebar"
        aria-label="Navigation"
        className="flex h-full w-[72px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        {/* Brand header: height matches the 64px top bar */}
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border">
          <BrandTile className="size-8" />
        </div>

        <nav
          // Hide the scrollbar to keep icons centered; wheel, touch, and focus still scroll.
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Main"
        >
          {mainSections.map((section, i) => (
            <div key={section.heading ?? i} className={cn(i > 0 && 'mt-4')}>
              {section.heading && <div className="mx-2 mb-3 h-px bg-sidebar-border" />}
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.path}>
                    {item.children && item.children.length > 0 ? (
                      <NavFlyout item={item} current={current} onNavigate={onNavigate} />
                    ) : (
                      <NavButton item={item} current={current} onNavigate={onNavigate} />
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
              onNavigate={onNavigate}
            />
          </div>
        )}

      </aside>
    </div>
  )
}

function NavButton({
  item,
  current,
  onNavigate,
}: {
  item: NavItem
  current: string
  onNavigate: (path: string) => void
}) {
  const active = item.path === current
  const Icon = item.icon
  const button = (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active
          ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
          : 'bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.badge && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-warning" aria-label={`${item.badge} need attention`} />}
    </button>
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={24}>{item.label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * An item with subpages. It never expands inside the drawer: clicking it (or
 * Enter / Space / arrow keys) opens a panel just right of the drawer's edge
 * listing the item's own page first, then its subpages, the current one
 * highlighted. Opening the panel never changes the rail's width.
 */
function NavFlyout({
  item,
  current,
  onNavigate,
}: {
  item: NavItem
  current: string
  onNavigate: (path: string) => void
}) {
  const children = item.children ?? []
  const active = item.path === current
  const activeChild = children.find((c) => c.path === current)
  const Icon = item.icon
  const pages: { path: string; label: string; badge?: string }[] = [
    { path: item.path, label: item.path === '/agents' ? 'Sessions' : 'Overview' },
    ...children,
  ]

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={`${item.label} pages`}
        className={cn(
          'relative flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          active || activeChild
            ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25'
            : 'bg-sidebar-accent/70 text-sidebar-accent-foreground hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <ChevronRight className="absolute right-1 size-3 shrink-0 opacity-60" />
      </button>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={24}>{item.label}</TooltipContent>
      </Tooltip>
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
