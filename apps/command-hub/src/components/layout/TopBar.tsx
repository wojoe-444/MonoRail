import { ChevronRight, Maximize, Minimize } from 'lucide-react'

import { DevTopBarItems } from '@/components/dev/TestProfileBar'
import { Button } from '@/components/ui/button'
import { useFullScreen } from '@/lib/fullscreen'

interface TopBarProps {
  /** Nav section of the current page, e.g. "Workspace". Home has none. */
  section?: string
  /** Parent page of a subpage, shown as a link between section and title. */
  parent?: { label: string; path: string }
  onNavigate?: (path: string) => void
  title: string
}

/**
 * 64px app bar: a section > page breadcrumb and the full screen toggle on the right (with
 * Developer Mode's inspect button and test-profile chip before it). The
 * color scheme and light / dark mode live in Settings > Appearance only.
 */
export function TopBar({ section, parent, onNavigate, title }: TopBarProps) {
  const { fullScreen, toggle } = useFullScreen()
  const fsLabel = fullScreen ? 'Exit full screen (F11)' : 'Full screen (F11)'
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/85 px-6 backdrop-blur">
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
      <DevTopBarItems />
      <Button variant="ghost" size="icon" className="-mr-2 size-8" onClick={toggle} aria-label={fsLabel} title={fsLabel}>
        {fullScreen ? <Minimize /> : <Maximize />}
      </Button>
    </header>
  )
}
