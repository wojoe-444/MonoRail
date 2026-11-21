import { Suspense } from 'react'
import { ArrowLeft, Moon, Sun } from 'lucide-react'

import { BrandTile } from '@/components/layout/BrandMark'
import { RouteErrorBoundary } from '@/components/layout/RouteErrorBoundary'
import { currentPath, navigate } from '@/lib/router'
import { useTheme } from '@/lib/theme'

import { hubReturnPath, rememberAppPath } from './session'
import type { AppDefinition } from './types'

/**
 * Full-screen host for an app (`placement: 'fullscreen'`, every extension app). The app gets the whole window below one
 * 48px hub bar, which is the same in every app: the drawer's colors from the
 * current color scheme, the MonoRail mark, and a "Back to MonoRail" button
 * filled like the active nav item. Apps style everything below it however
 * they like, but never the bar.
 */
export function AppFrame({ app }: { app: AppDefinition }) {
  const Icon = app.icon
  const [theme, toggleTheme] = useTheme()

  const exit = () => {
    rememberAppPath(app, currentPath())
    navigate(hubReturnPath())
  }

  return (
    <div data-slot="app-frame" className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
        <button
          type="button"
          onClick={exit}
          className="group flex h-8 items-center gap-2 rounded-md bg-sidebar-primary pr-3 pl-2 text-sm font-medium text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25 transition-colors outline-none hover:bg-sidebar-primary/85 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <BrandTile className="size-5" />
          Back to MonoRail
        </button>
        <span className="h-5 w-px bg-sidebar-border" aria-hidden />
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className="size-4 shrink-0 text-sidebar-muted-foreground" />
          <span className="truncate font-semibold text-sidebar-accent-foreground">{app.title}</span>
          <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-semibold text-sidebar-accent-foreground">App</span>
        </div>
        <span className="ml-auto hidden min-w-0 truncate text-xs text-sidebar-muted-foreground lg:block">{app.description}</span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:ml-0"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <AppBody app={app} />
      </div>
    </div>
  )
}

/**
 * An app's root inside its error boundary. Full-screen apps render it under
 * the hub bar; workspace apps render it as the page body under the drawer
 * and top bar (App.tsx).
 */
export function AppBody({ app }: { app: AppDefinition }) {
  const AppRoot = app.component
  return (
    <RouteErrorBoundary title={app.title} hint={app.placement === 'workspace' ? 'Open it again from the menu on the left.' : 'Use “Back to MonoRail” above, then open the app again.'}>
      <Suspense fallback={null}>
        <AppRoot basePath={app.path} />
      </Suspense>
    </RouteErrorBoundary>
  )
}
