import { Suspense, useCallback, useEffect, useState } from 'react'

import { AppBody, AppFrame } from '@/apps/AppFrame'
import { findAppByPath, isWorkspaceApp } from '@/apps/registry'
import { appEntryPath, rememberAppPath, rememberHubPath } from '@/apps/session'

import { findNavItem, flattenNav, SETTINGS_SECTION, useNavSections, type NavItem } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { Inspector } from '@/components/dev/Inspector'
import { TooltipProvider } from '@/components/ui/tooltip'
import { extensionsLoaded, useExtensionList } from '@/extensions/store'
import { isDesktop } from '@/modules/client'
import { currentPath, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { findModuleByPath } from '@/modules/registry'
import { SettingsLayout } from '@/modules/settings/SettingsLayout'
import { UpdateToast } from '@/modules/settings/UpdateToast'
import { AgentsPage } from '@/pages/agents/AgentsPage'
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
  if (path === '/agents') return <AgentsPage />
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

  const workspaceApp = activeApp && isWorkspaceApp(activeApp) ? activeApp : undefined

  // Remember the hub page, so leaving a full-screen app comes back to it, and
  // where a workspace app was, so going back to it resumes there.
  useEffect(() => {
    if (!activeApp) rememberHubPath(path)
    else if (isWorkspaceApp(activeApp)) rememberAppPath(activeApp, path)
  }, [activeApp, path])

  // Opening an app from the nav resumes it where it was left; clicking the
  // nav item of the workspace app already open goes to its start page.
  const openPath = useCallback(
    (p: string) => {
      // In-app routers move the hash without telling useRoute, so read it now.
      if (workspaceApp) rememberAppPath(workspaceApp, currentPath())
      const app = findAppByPath(p)
      if (!app || p !== app.path) return navigate(p)
      navigate(app.id === workspaceApp?.id ? app.path : appEntryPath(app))
    },
    [navigate, workspaceApp],
  )

  const found = findNavItem(navSections, path)
  const current = found?.item
  const section = found?.section.heading

  if (activeApp && !workspaceApp) {
    return (
      <TooltipProvider>
        <AppFrame key={activeApp.id} app={activeApp} />
        <UpdateToast />
        <Inspector />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        <SideNav
          current={current?.path ?? path}
          onNavigate={openPath}
          collapsed={collapsed}
        />
        <div className={cn('flex min-w-0 flex-1 flex-col', workspaceApp ? 'overflow-hidden' : 'overflow-y-auto')}>
          <TopBar
            section={section}
            parent={found?.parent ? { label: found.parent.label, path: found.parent.path } : undefined}
            onNavigate={openPath}
            title={current?.label ?? 'Not found'}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
          />
          {workspaceApp ? (
            // A workspace app owns the whole page body, with its own look and scrolling.
            <main className="min-h-0 flex-1 overflow-auto">
              <AppBody key={workspaceApp.id} app={workspaceApp} />
            </main>
          ) : (
            // Content container: max 1536px with 24/32px gutters
            <main className="mx-auto w-full max-w-[96rem] p-6 lg:p-8">
              {findModuleByPath(path, extensionList)?.nav.section === SETTINGS_SECTION ? (
                <SettingsLayout path={path}>
                  <RouteView path={path} navItems={navItems} onOpen={openPath} />
                </SettingsLayout>
              ) : (
                <RouteView path={path} navItems={navItems} onOpen={openPath} />
              )}
            </main>
          )}
        </div>
      </div>
      <UpdateToast />
      <Inspector />
    </TooltipProvider>
  )
}
