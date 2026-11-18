import { ArrowRight } from 'lucide-react'

import { findAppByPath } from '@/apps/registry'
import { findNavItem, useNavSections } from '@/components/layout/nav'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { findModuleByPath } from '@/modules/registry'

/** The same destinations as the Tools flyout, with room to explain each one. */
export function ToolsPage({ onOpen }: { onOpen: (path: string) => void }) {
  const sections = useNavSections()
  const pages = findNavItem(sections, '/tools')?.item.children ?? []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tools" description="Your files, repositories, tasks, calendar, mail and reference material, together in one place." />
      <section aria-label="Tools" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => {
          const Icon = page.icon
          const description = findAppByPath(page.path)?.description ?? findModuleByPath(page.path)?.description
          return (
            <Card key={page.path} className="group relative gap-4 p-6 transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-elevation-2">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">
                  <button type="button" onClick={() => onOpen(page.path)} className="text-left outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
                    {page.label}
                  </button>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          )
        })}
      </section>
    </div>
  )
}
