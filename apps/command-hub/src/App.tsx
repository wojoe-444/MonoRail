import { Suspense, useCallback, useEffect, useState } from 'react'

import { AppFrame } from '@/apps/AppFrame'
import { findAppByPath } from '@/apps/registry'
import { appEntryPath, rememberHubPath } from '@/apps/session'

import { allNavItems } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoute } from '@/lib/router'
import { useTheme } from '@/lib/theme'
import { findModuleByPath } from '@/modules/registry'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function RouteView({ path }: { path: string }) {
  const mod = findModuleByPath(path)
  if (mod) {
    const Page = mod.component
    return (
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    )
  }
  if (path === '/') return <HomePage />
  const item = allNavItems.find((i) => i.path === path)
  return <PlaceholderPage title={item?.label ?? 'Not found'} />
}

export default function App() {
  const [path, navigate] = useRoute()
  const activeApp = findAppByPath(path)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, toggleTheme] = useTheme()

  // Remember the hub page, so leaving an app comes back to it.
  useEffect(() => {
    if (!activeApp) rememberHubPath(path)
  }, [activeApp, path])

  // Opening an app from the nav resumes it where it was left.
  const openPath = useCallback(
    (p: string) => {
      const app = findAppByPath(p)
      navigate(app && p === app.path ? appEntryPath(app) : p)
    },
    [navigate],
  )

  const current = allNavItems.find((i) => i.path === path)

  if (activeApp) {
    return (
      <TooltipProvider>
        <AppFrame key={activeApp.id} app={activeApp} />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        <SideNav
          current={path}
          onNavigate={openPath}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopBar title={current?.label ?? 'Not found'} dark={theme === 'dark'} onToggleDark={toggleTheme} />
          {/* Content container: MUI Container maxWidth="xl" with 24/32px gutters */}
          <main className="mx-auto w-full max-w-[1440px] px-6 py-8 lg:px-8">
            <RouteView path={path} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
