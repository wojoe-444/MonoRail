import { lazy, Suspense, useCallback, useEffect } from 'react'

import { AppBody, AppFrame } from '@/apps/AppFrame'
import { findAppByPath, isWorkspaceApp } from '@/apps/registry'
import { appEntryPath, rememberAppPath, rememberHubPath } from '@/apps/session'

import { findNavItem, flattenNav, SETTINGS_SECTION, useNavSections, type NavItem } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { HeaderRevealProvider, HeaderRevealTrigger } from '@/components/layout/HeaderReveal'
import { Inspector } from '@/components/dev/Inspector'
import { TourHost } from '@/components/tour/Tour'
import { TooltipProvider } from '@/components/ui/tooltip'
import { extensionsLoaded, useExtensionList } from '@/extensions/store'
import { isDesktop } from '@/modules/client'
import { currentPath, useRoute } from '@/lib/router'
import { findModuleByPath } from '@/modules/registry'
import { SettingsLayout } from '@/modules/settings/SettingsLayout'
import { UpdateToast } from '@/modules/settings/UpdateToast'
import { AgentsPage } from '@/pages/agents/AgentsPage'
import { DashboardLayout, DASHBOARD_PATH, isDashboardPath } from '@/pages/agents/DashboardLayout'
import { CLAUDE_STATS_PATH } from '@/modules/claude-stats'
import { PrReviewer } from '@/modules/agent-catalog/PrReviewer'
import { CatalogLayout, CATALOG_PATH, SUBAGENTS_PATH, PROMPTS_PATH } from '@/modules/agent-catalog/CatalogLayout'

import { AppsPage } from '@/pages/AppsPage'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ToolsPage } from '@/pages/ToolsPage'

const PromptsPage = lazy(() => import('@/modules/agent-catalog/PromptsPage'))
const CatalogPage = lazy(() => import('@/modules/agent-catalog/CatalogPage'))

function RouteView({ path, navItems, onOpen }: { path: string; navItems: NavItem[]; onOpen: (path: string) => void }) {
  if (path === PROMPTS_PATH) return <Suspense fallback={null}><PromptsPage /></Suspense>
  if (path === SUBAGENTS_PATH) return <Suspense fallback={null}><CatalogPage /></Suspense>
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
  if (path === '/tools') return <ToolsPage onOpen={onOpen} />
  if (path === DASHBOARD_PATH) return <AgentsPage />
  if (path === '/agents/pr-review') return <PrReviewer onBack={() => onOpen(SUBAGENTS_PATH)} />
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

  // Claude Stats moved from its own drawer item to a Dashboard tab; keep old links working.
  useEffect(() => {
    if (path === '/claude-stats') navigate(CLAUDE_STATS_PATH)
  }, [path, navigate])

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
        />
        <HeaderRevealProvider><div data-slot="app-body" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <HeaderRevealTrigger />
          <TopBar
            section={section}
            parent={found?.parent ? { label: found.parent.label, path: found.parent.path } : undefined}
            onNavigate={openPath}
            title={current?.label ?? 'Not found'}
          />
          {workspaceApp ? (
            // A workspace app owns the whole page body, with its own look and scrolling.
            <main className="min-h-0 flex-1 overflow-auto">
              <AppBody key={workspaceApp.id} app={workspaceApp} />
            </main>
          ) : findModuleByPath(path, extensionList)?.layout === 'full' ? (
            // A canvas page fills the body edge to edge.
            <main className="min-h-0 flex-1 overflow-hidden">
              <RouteView path={path} navItems={navItems} onOpen={openPath} />
            </main>
          ) : (
            // Scroll at the app edge; constrain only the content inside it.
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[96rem] p-6 lg:p-8">
                {findModuleByPath(path, extensionList)?.nav.section === SETTINGS_SECTION ? (
                  <SettingsLayout path={path}>
                    <RouteView path={path} navItems={navItems} onOpen={openPath} />
                  </SettingsLayout>
                ) : isDashboardPath(path) ? (
                  <DashboardLayout path={path}><RouteView path={path} navItems={navItems} onOpen={openPath} /></DashboardLayout>
                ) : (path === CATALOG_PATH || path === PROMPTS_PATH || path === SUBAGENTS_PATH || path === '/agents/pr-review') ? (
                  <CatalogLayout path={path}><RouteView path={path} navItems={navItems} onOpen={openPath} /></CatalogLayout>
                ) : (
                  <RouteView path={path} navItems={navItems} onOpen={openPath} />
                )}
              </div>
            </main>
          )}
        </div></HeaderRevealProvider>
      </div>
      <UpdateToast />
      <TourHost />
      <Inspector />
    </TooltipProvider>
  )
}
