import { ChevronRight, Maximize, Minimize } from 'lucide-react'

import { DevTopBarItems } from '@/components/dev/TestProfileBar'
import { Button } from '@/components/ui/button'
import { useFullScreen } from '@/lib/fullscreen'

interface TopBarProps {
  /** Nav section of the current page, e.g. "Workspace", linked to the section's first page. Home has none. */
  section?: { label: string; path: string }
  /** Parent page of a subpage, shown as a link between section and title. */
  parent?: { label: string; path: string }
  onNavigate?: (path: string) => void
  title: string
}

/**
 * 40px app bar, always visible: a section > page breadcrumb and the full screen toggle on the right (with
 * Developer Mode's inspect button and test-profile chip before it). The
 * color scheme and light / dark mode live in Settings > Appearance only.
 */
/** A breadcrumb step: a real link (copyable, middle-clickable) that navigates inside the app. */
function Crumb({ label, path, onNavigate, className = '' }: { label: string; path: string; onNavigate?: (path: string) => void; className?: string }) {
  return (
    <a
      href={`#${path}`}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        onNavigate?.(path)
      }}
      className={`min-w-0 max-w-[40%] truncate rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {label}
    </a>
  )
}

export function TopBar({ section, parent, onNavigate, title }: TopBarProps) {
  const { fullScreen, toggle } = useFullScreen()
  const fsLabel = fullScreen ? 'Exit full screen (F11)' : 'Full screen (F11)'
  return (
    <header data-slot="top-bar" className="sticky top-0 z-10 flex h-10 shrink-0 items-center gap-4 border-b bg-background/85 px-4 backdrop-blur">
      <nav aria-label="Breadcrumb" data-tour="breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Crumb label={section?.label ?? 'MonoRail'} path={section?.path ?? '/'} onNavigate={onNavigate} className="hidden sm:inline" />
        <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />
        {parent && (
          <>
            <button
              type="button"
              onClick={() => onNavigate?.(parent.path)}
              className="min-w-0 max-w-[40%] truncate rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {parent.label}
            </button>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </>
        )}
        <span className="min-w-0 flex-1 truncate font-medium" aria-current="page">
          {title}
        </span>
      </nav>
      <DevTopBarItems />
      <Button variant="ghost" size="icon" className="-mr-1 size-7" onClick={toggle} data-tour="fullscreen" aria-label={fsLabel} title={fsLabel}>
        {fullScreen ? <Minimize /> : <Maximize />}
      </Button>
    </header>
  )
}
