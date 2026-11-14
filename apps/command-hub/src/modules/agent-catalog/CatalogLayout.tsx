import { BookOpen, ChevronRight, Users, MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

export const CATALOG_PATH = '/agents/catalog'
export const PROMPTS_PATH = '/agents/catalog/prompts'
export const SUBAGENTS_PATH = '/agents/catalog/subagents'

export function CatalogLayout({ path, children }: { path: string; children: ReactNode }) {
  const prompts = path === PROMPTS_PATH
  const subagents = path === SUBAGENTS_PATH || path === '/agents/pr-review'
  const linkClass = (active: boolean) => cn(
    'flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-primary-soft font-medium text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="shrink-0 lg:sticky lg:top-24 lg:w-60">
        <nav aria-label="Catalog" className="flex flex-col gap-0.5">
          <button type="button" onClick={() => navigate(CATALOG_PATH)} aria-current={!subagents && !prompts ? 'page' : undefined} className={linkClass(!subagents && !prompts)}>
            <BookOpen className="size-4 shrink-0" /> Templates
          </button>
          <button type="button" onClick={() => navigate(SUBAGENTS_PATH)} aria-current={subagents ? 'page' : undefined} className={cn(linkClass(subagents), 'pl-8')}>
            <Users className="size-4 shrink-0" /> Subagents
          </button>
          <button type="button" onClick={() => navigate(PROMPTS_PATH)} aria-current={prompts ? 'page' : undefined} className={cn(linkClass(prompts), 'pl-8')}>
            <MessageSquareText className="size-4 shrink-0" /> Prompts
          </button>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Catalog" title="Templates" description="Browse reusable templates for your agents." />
      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <button type="button" onClick={() => navigate(SUBAGENTS_PATH)} className="flex w-full items-center gap-4 rounded-xl p-6 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground"><Users className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">Subagents</span><span className="block text-sm text-muted-foreground">Browse, create and manage subagent templates.</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button type="button" onClick={() => navigate(PROMPTS_PATH)} className="flex w-full items-center gap-4 rounded-xl border-t p-6 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground"><MessageSquareText className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">Prompts</span><span className="block text-sm text-muted-foreground">Create and fill in versioned prompt templates.</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
