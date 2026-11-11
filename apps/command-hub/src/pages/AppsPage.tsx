import { ArrowRight, Puzzle } from 'lucide-react'

import { allApps, apps as builtInApps } from '@/apps/registry'
import type { AppDefinition } from '@/apps/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useExtensionList } from '@/extensions/store'

const builtInIds = new Set(builtInApps.map((a) => a.id))

/**
 * The Apps page: one card per app (built in and from extensions). Apps open
 * full screen; the bar across the top of every app leads back here.
 */
export function AppsPage({ onOpen }: { onOpen: (path: string) => void }) {
  const list = useExtensionList()
  const all = allApps(list)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Apps"
        description="Full-screen tools that run inside MonoRail. The bar at the top of every app brings you back."
        actions={
          <Button variant="outline" onClick={() => onOpen('/settings/extensions')}>
            <Puzzle />
            Get more apps
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {all.map((app) => (
          <AppCard key={app.id} app={app} builtIn={builtInIds.has(app.id)} onOpen={() => onOpen(app.path)} />
        ))}
      </section>

      {all.length === 0 && (
        <Card className="items-center px-6 text-center text-sm text-muted-foreground">No apps yet. Install one from Settings &gt; Extensions.</Card>
      )}
    </div>
  )
}

function AppCard({ app, builtIn, onOpen }: { app: AppDefinition; builtIn: boolean; onOpen: () => void }) {
  const Icon = app.icon
  return (
    <Card className="group relative gap-4 p-6 transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-elevation-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <Icon className="size-6" />
        </div>
        <Badge variant={builtIn ? 'secondary' : 'info'}>{builtIn ? 'Built in' : 'Extension'}</Badge>
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold">
          {/* The whole card is the click target; the link sits on the title for keyboard and screen readers. */}
          <button type="button" onClick={onOpen} className="text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
            {app.title}
          </button>
        </h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
      </div>
      <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
        Open
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Card>
  )
}
