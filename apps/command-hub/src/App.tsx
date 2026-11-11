import { useEffect, useState } from 'react'

import { allNavItems, type PageId } from '@/components/layout/nav'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HomePage } from '@/pages/HomePage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

export default function App() {
  const [page, setPage] = useState<PageId>('home')
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const current = allNavItems.find((i) => i.id === page)!

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        <SideNav
          current={page}
          onNavigate={setPage}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <TopBar title={current.label} dark={dark} onToggleDark={() => setDark((d) => !d)} />
          {/* Content container: MUI Container maxWidth="xl" with 24/32px gutters */}
          <main className="mx-auto w-full max-w-[1440px] px-6 py-8 lg:px-8">
            {page === 'home' ? <HomePage /> : <PlaceholderPage title={current.label} />}
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
