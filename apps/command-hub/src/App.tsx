import { Suspense, useCallback, useEffect, useState } from 'react'

import { AppFrame } from '@/apps/AppFrame'
import { findAppByPath } from '@/apps/registry'
import { appEntryPath, rememberHubPath } from '@/apps/session'

import { findNavItem, flattenNav, useNavSections, type NavItem } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { extensionsLoaded, useExtensionList } from '@/extensions/store'
import { isDesktop } from '@/modules/client'
import { useRoute } from '@/lib/router'
import { findModuleByPath } from '@/modules/registry'
import { AppsPage } from '@/pages/AppsPage'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function RouteView({ path, navItems, onOpen }: { path: string; navItems: NavItem[]; onOpen: (path: string) => void }) {
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
  if (path === '/apps') return <AppsPage onOpen={onOpen} />
  // Extension pages are known once the installed list has loaded.
  if ((path.startsWith('/x/') || path.startsWith('/apps/')) && isDesktop() && !extensionsLoaded()) return null
  const item = navItems.find((i) => i.path === path)
  return <PlaceholderPage title={item?.label ?? 'Not found'} />
}

export default function App() {
  const [path, navigate] = useRoute()
  const extensionList = useExtensionList()
  const navSections = useNavSections()
  const navItems = flattenNav(navSections)
  const activeApp = findAppByPath(path, extensionList)
  const [collapsed, setCollapsed] = useState(false)

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

  const found = findNavItem(navSections, path)
  const current = found?.item
  const section = found?.section.heading

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
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopBar
            section={section}
            parent={found?.parent ? { label: found.parent.label, path: found.parent.path } : undefined}
            onNavigate={openPath}
            title={current?.label ?? 'Not found'}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
          />
          {/* Content container: max 1536px with 24/32px gutters */}
          <main className="mx-auto w-full max-w-[96rem] p-6 lg:p-8">
            <RouteView path={path} navItems={navItems} onOpen={openPath} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
