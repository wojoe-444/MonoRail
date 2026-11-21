import { ChevronRight, Maximize, Minimize, Search } from 'lucide-react'

import { DevTopBarItems } from '@/components/dev/TestProfileBar'
import { isSettingsPath } from '@/components/search/page-index'
import { openSearch } from '@/components/search/store'
import { Button } from '@/components/ui/button'
import { useFullScreen } from '@/lib/fullscreen'
import { currentPath } from '@/lib/router'

import { useTopBarSlot } from './TopBarSlot'

interface TopBarProps {
  /** Nav section of the current page, e.g. "Workspace", linked to the section's first page. Home has none. */
  section?: { label: string; path: string }
  /** Parent page of a subpage, shown as a link between section and title. */
  parent?: { label: string; path: string }
  onNavigate?: (path: string) => void
  title: string
}

/**
 * 40px app bar, always visible: a section > page breadcrumb, the search field
 * (opens the command palette) and the full screen toggle on the right (with
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
  const slot = useTopBarSlot()
  // A page's command bar (PageCommandBar) takes the breadcrumb's place.
  const claimed = !!slot?.claimed
  return (
    <header data-slot="top-bar" className="sticky top-0 z-10 flex h-10 shrink-0 items-center gap-4 border-b bg-background/85 px-4 backdrop-blur">
      <div ref={slot?.setTarget} data-slot="top-bar-slot" className={claimed ? 'flex min-w-0 flex-1 items-center gap-3' : 'hidden'} />
      <nav aria-label="Breadcrumb" data-tour="breadcrumb" className={`${claimed ? 'hidden' : 'flex'} min-w-0 flex-1 items-center gap-1.5 text-sm`}>
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
      <TopBarSearch />
      <DevTopBarItems />
      <Button variant="ghost" size="icon" className="-mr-1 size-7" onClick={toggle} data-tour="fullscreen" aria-label={fsLabel} title={fsLabel}>
        {fullScreen ? <Minimize /> : <Maximize />}
      </Button>
    </header>
  )
}

/**
 * The top bar's search field: looks like an input and opens the command
 * palette (the same as Ctrl+K), on the Settings scope on a Settings page.
 * Typing a letter while it has focus opens the palette with that letter.
 * On narrow windows it shrinks to an icon button.
 */
function TopBarSearch() {
  const start = (query = '') => openSearch({ query, ...(isSettingsPath(currentPath()) ? { scope: 'settings' as const } : {}) })
  return (
    <button
      type="button"
      data-tour="search"
      onClick={() => start()}
      onKeyDown={(e) => {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
          e.preventDefault()
          start(e.key)
        }
      }}
      aria-label="Search MonoRail (Ctrl+K)"
      title="Search MonoRail (Ctrl+K)"
      className="flex h-7 shrink-0 items-center gap-2 rounded-md border border-input bg-card px-2 text-xs text-muted-foreground transition-colors outline-none hover:border-ring/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:w-64 lg:w-80"
    >
      <Search className="size-3.5 shrink-0" aria-hidden />
      <span className="hidden flex-1 truncate text-left md:inline">Search or browse the catalog</span>
      <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
    </button>
  )
}
