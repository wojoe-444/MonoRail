import { Suspense, useEffect, useState } from 'react'

import { allNavItems } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoute } from '@/lib/router'
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
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const current = allNavItems.find((i) => i.path === path)

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        <SideNav
          current={path}
          onNavigate={navigate}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopBar title={current?.label ?? 'Not found'} dark={dark} onToggleDark={() => setDark((d) => !d)} />
          {/* Content container: MUI Container maxWidth="xl" with 24/32px gutters */}
          <main className="mx-auto w-full max-w-[1440px] px-6 py-8 lg:px-8">
            <RouteView path={path} />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
