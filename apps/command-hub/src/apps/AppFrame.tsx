import { Component, Suspense, type ReactNode } from 'react'
import { ArrowLeft, Moon, Sun } from 'lucide-react'

import { BrandMark } from '@/components/layout/BrandMark'
import { currentPath, navigate } from '@/lib/router'
import { useTheme } from '@/lib/theme'

import { hubReturnPath, rememberAppPath } from './session'
import type { AppDefinition } from './types'

/**
 * Full-screen host for an app. The app gets the whole window below one
 * 48px hub bar, which is the same in every app: the hub's dark drawer color,
 * the MonoHub mark, and a "Back to MonoHub" button. Apps style
 * everything below it however they like, but never the bar.
 */
export function AppFrame({ app }: { app: AppDefinition }) {
  const AppRoot = app.component
  const Icon = app.icon
  const [theme, toggleTheme] = useTheme()

  const exit = () => {
    rememberAppPath(app, currentPath())
    navigate(hubReturnPath())
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-3 text-sidebar-foreground">
        <button
          type="button"
          onClick={exit}
          className="group flex h-8 items-center gap-2 rounded-lg bg-sidebar-primary pr-3 pl-2 text-sm font-medium text-sidebar-primary-foreground shadow-elevation-1 transition-colors outline-none hover:bg-sidebar-primary/85 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="flex size-5 items-center justify-center rounded-md bg-sidebar-primary-foreground/15">
            <BrandMark className="size-3" />
          </span>
          Back to MonoHub
        </button>
        <span className="h-5 w-px bg-sidebar-border" aria-hidden />
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className="size-4 shrink-0 text-sidebar-muted-foreground" />
          <span className="truncate font-semibold text-sidebar-accent-foreground">{app.title}</span>
          <span className="rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[11px] font-semibold text-sidebar-primary">App</span>
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
        <AppErrorBoundary title={app.title}>
          <Suspense fallback={null}>
            <AppRoot basePath={app.path} />
          </Suspense>
        </AppErrorBoundary>
      </div>
    </div>
  )
}

/** If an app crashes, keep the hub bar so the way back still works. */
class AppErrorBoundary extends Component<{ title: string; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">{this.props.title} stopped working</h2>
        <p className="mt-2 text-sm text-muted-foreground">{this.state.error.message}</p>
        <p className="mt-4 text-sm text-muted-foreground">Use “Back to MonoHub” above, then open the app again.</p>
      </div>
    )
  }
}
