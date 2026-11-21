import {
  ArrowRight,
  BookA,
  Bot,
  ChartLine,
  CircleHelp,
  Compass,
  Database,
  FileText,
  Folder,
  FolderGit2,
  FolderOpen,
  GraduationCap,
  KeyRound,
  MessagesSquare,
  Palette,
  PlugZap,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Shapes,
  ShieldCheck,
  Sigma,
  Sparkles,
  Telescope,
  UserRound,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import { findFolder, folderPages, folderShows, navLabel, shows, tree, type WikiFolder, type WikiNode } from './content'
import type { AudienceFilter } from './store'
import { AudienceBadges, type Open } from './WikiNavigation'

const ICONS: Record<string, LucideIcon> = {
  'guide/README': Sparkles,
  'guide/first-ten-minutes': Compass,
  'guide/private-data': ShieldCheck,
  'guide/search': Search,
  'guide/glossary': BookA,
  'guide/faq': CircleHelp,
  'guide/agents': Bot,
  'guide/agents/chat': MessagesSquare,
  'guide/agents/create-an-agent': Plus,
  'guide/agents/catalog': Shapes,
  'guide/agents/coordinator': Workflow,
  'guide/agents/flows': Workflow,
  'guide/agents/spend': ChartLine,
  'guide/agents/agent-access': KeyRound,
  'guide/agents/mochi-crew': Sparkles,
  'guide/workspace': FolderGit2,
  'guide/workspace/flashcards': GraduationCap,
  'guide/workspace/files': FolderOpen,
  'guide/data': Database,
  'guide/data/explore': Telescope,
  'guide/data/openmetadata': Shapes,
  'guide/data/services': Workflow,
  'guide/data/bigquery': Database,
  'guide/data/sqlx': FileText,
  'guide/data/malloy': Sigma,
  'guide/data/semantic': Sigma,
  'guide/setup': Wrench,
  'guide/setup/connections': PlugZap,
  'guide/setup/appearance': Palette,
  'guide/setup/backups-and-updates': RefreshCw,
  'guide/setup/extensions': Puzzle,
  'standard/README': Shapes,
  'standard/monorail': Sparkles,
  'standard/monorail/agents': Bot,
  'standard/monorail/workspace': FolderGit2,
  'standard/monorail/learning': GraduationCap,
  'standard/monorail/semantic': Sigma,
  'standard/data-assets': Database,
  'standard/governance': ShieldCheck,
  'standard/data-contracts': FileText,
  'standard/ontology': Workflow,
  'standard/teams-and-users': UserRound,
  'standard/data-quality': ChartLine,
  'standard/insights': ChartLine,
  'standard/collaboration': MessagesSquare,
  'standard/context-center': FolderOpen,
  'standard/platform': Wrench,
}

function iconFor(id: string, fallback: LucideIcon = FileText) {
  return ICONS[id] ?? fallback
}

export function WikiHome({ audience, onOpen }: { audience: AudienceFilter; onOpen: Open }) {
  const guide = findFolder('guide')
  const standard = findFolder('standard')
  const rest = tree.filter((f) => f.path !== 'guide' && f.path !== 'standard' && folderShows(audience, f))

  const guidePages = guide
    ? [...(guide.index ? [guide.index] : []), ...guide.children.flatMap((c) => (c.kind === 'page' ? [c.page] : []))].filter((p) => shows(audience, p))
    : []
  const guideTopics = guide
    ? guide.children.flatMap((c) => (c.kind === 'folder' && folderShows(audience, c.folder) ? [c.folder] : []))
    : []

  return (
    <div className="flex flex-col gap-8">
      {guidePages.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Start here</h2>
            <p className="text-sm text-muted-foreground">Short orientation guides in plain language. Follow links as you go.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {guidePages.map((p) => {
              const Icon = iconFor(p.id)
              return (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="group flex items-start gap-3.5 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-elevation-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{p.summary}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {guideTopics.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Guides by topic</h2>
            <p className="text-sm text-muted-foreground">Open a topic overview or jump straight to a guide.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {guideTopics.map((f) => {
              const Icon = iconFor(f.path, Folder)
              const inside = f.children.flatMap((c) => (c.kind === 'page' && shows(audience, c.page) ? [c.page] : []))
              return (
                <div key={f.path} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                  <button type="button" onClick={() => f.index && onOpen(f.index.id)} className="flex items-start gap-3.5 text-left">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{f.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{f.index?.summary ?? `${inside.length} pages`}</span>
                    </span>
                  </button>
                  <div className="flex flex-wrap gap-1.5 pl-12.5">
                    {inside.map((p) => (
                      <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
                        {navLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {standard && folderShows(audience, standard) && (
        <StandardDirectoryCard folder={standard} audience={audience} onOpen={onOpen} />
      )}

      {rest.map((f) => (
        <FolderListCard key={f.path} folder={f} audience={audience} onOpen={onOpen} />
      ))}
    </div>
  )
}

/** Compact directory card for the MonoRail standard so it stays scannable on Wiki home. */
function StandardDirectoryCard({ folder, audience, onOpen }: { folder: WikiFolder; audience: AudienceFilter; onOpen: Open }) {
  const categories = folder.children.filter((n) => (n.kind === 'folder' ? folderShows(audience, n.folder) : shows(audience, n.page)))
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle>The MonoRail standard</CardTitle>
          <CardDescription className="mt-1">Every entity type MonoRail knows and its fields: OpenMetadata 2.1 plus MonoRail's own types.</CardDescription>
        </div>
        {folder.index && (
          <Button variant="outline" size="sm" onClick={() => onOpen(folder.index!.id)}>
            Overview <ArrowRight className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((n) => {
            const id = n.kind === 'folder' ? n.folder.path : n.page.id
            const target = n.kind === 'folder' ? n.folder.index?.id : n.page.id
            const title = n.kind === 'folder' ? n.folder.title : n.page.title
            const count = n.kind === 'folder' ? folderPages(n.folder).filter((p) => shows(audience, p)).length : undefined
            const Icon = iconFor(id, Shapes)
            return (
              <button
                key={id}
                type="button"
                onClick={() => target && onOpen(target)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  {count !== undefined && <span className="block text-xs text-muted-foreground">{count} pages</span>}
                </span>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** A folder's contents as cards: pages, and subfolders with links to their pages. */
export function NodeCards({ folder, audience, onOpen, withIndex }: { folder: WikiFolder; audience: AudienceFilter; onOpen: Open; withIndex?: boolean }) {
  const nodes: WikiNode[] = [...(withIndex && folder.index ? [{ kind: 'page', page: folder.index } as WikiNode] : []), ...folder.children]
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
      {nodes.map((n) => {
        if (n.kind === 'page') {
          if (!shows(audience, n.page)) return null
          const Icon = iconFor(n.page.id)
          return (
            <button key={n.page.id} type="button" onClick={() => onOpen(n.page.id)} className="group flex items-start gap-3.5 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-elevation-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{n.page.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{n.page.summary}</span>
              </span>
            </button>
          )
        }
        const f = n.folder
        if (!folderShows(audience, f)) return null
        const Icon = iconFor(f.path, Folder)
        const inside = f.children.flatMap((c) => (c.kind === 'page' && shows(audience, c.page) ? [c.page] : []))
        return (
          <div key={f.path} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <button type="button" onClick={() => f.index && onOpen(f.index.id)} className="flex items-start gap-3.5 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-highlight text-highlight-foreground">
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{f.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{f.index?.summary ?? `${inside.length} pages`}</span>
              </span>
            </button>
            <div className="flex flex-wrap gap-1.5 pl-12.5">
              {inside.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
                  {navLabel(p)}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** A top-level folder on the wiki home: a card listing its pages and subfolders. */
function FolderListCard({ folder, audience, onOpen }: { folder: WikiFolder; audience: AudienceFilter; onOpen: Open }) {
  const rows = [...(folder.index ? [{ kind: 'page', page: folder.index } as WikiNode] : []), ...folder.children].filter((n) =>
    n.kind === 'page' ? shows(audience, n.page) : folderShows(audience, n.folder),
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle>{folder.title}</CardTitle>
        <CardDescription>{folderPages(folder).filter((p) => shows(audience, p)).length} pages</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((n) => {
            const p = n.kind === 'page' ? n.page : n.folder.index
            const key = n.kind === 'page' ? n.page.id : n.folder.path
            return (
              <li key={key}>
                <button type="button" onClick={() => p && onOpen(p.id)} className="flex w-full items-start gap-4 px-6 py-4 text-left hover:bg-accent/60">
                  {n.kind === 'page' ? <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Folder className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.kind === 'page' ? n.page.title : n.folder.title}</span>
                    {p?.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{p.summary}</span>}
                  </span>
                  {p && <AudienceBadges audience={p.audience} className="hidden shrink-0 sm:inline-flex" />}
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
