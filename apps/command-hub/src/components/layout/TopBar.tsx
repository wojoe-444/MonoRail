import { ChevronRight, PanelLeft } from 'lucide-react'

import { ModeToggle, ThemeSelect } from '@/components/theme/ThemePicker'
import { Button } from '@/components/ui/button'

interface TopBarProps {
  /** Nav section of the current page, e.g. "Workspace". Home has none. */
  section?: string
  /** Parent page of a subpage, shown as a link between section and title. */
  parent?: { label: string; path: string }
  onNavigate?: (path: string) => void
  title: string
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * 64px app bar, laid out like the Bot Dashboard's: drawer toggle, a
 * section > page breadcrumb, then the color scheme picker and the
 * light / dark toggle on the right.
 */
export function TopBar({ section, parent, onNavigate, title, collapsed, onToggleCollapsed }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/85 px-6 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 size-8"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        <PanelLeft />
      </Button>
      <span className="h-6 w-px bg-border" aria-hidden />
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <span className="shrink-0 text-muted-foreground">{section ?? 'MonoRail'}</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {parent && (
          <>
            <button
              type="button"
              onClick={() => onNavigate?.(parent.path)}
              className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {parent.label}
            </button>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
        <span className="truncate font-medium" aria-current="page">
          {title}
        </span>
      </nav>
      <div className="flex items-center gap-2">
        <ThemeSelect className="hidden sm:flex" />
        <ModeToggle />
      </div>
    </header>
  )
}
