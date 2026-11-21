import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import arduino from 'highlight.js/lib/languages/arduino'
import objectivec from 'highlight.js/lib/languages/objectivec'
import phpTemplate from 'highlight.js/lib/languages/php-template'
import plaintext from 'highlight.js/lib/languages/plaintext'
import pythonRepl from 'highlight.js/lib/languages/python-repl'
import shell from 'highlight.js/lib/languages/shell'
import vbnet from 'highlight.js/lib/languages/vbnet'
import wasm from 'highlight.js/lib/languages/wasm'
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  Bot,
  ChartLine,
  ChevronRight,
  CircleHelp,
  Compass,
  CornerDownRight,
  Database,
  ExternalLink,
  FileText,
  Folder,
  FolderGit2,
  FolderOpen,
  GraduationCap,
  KeyRound,
  Link2,
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
  X,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { codeLanguages } from '@/lib/highlight'
import { cn } from '@/lib/utils'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { invokeModule, isDesktop } from '@/modules/client'

import {
  findFolder,
  findPage,
  folderChain,
  headingsOf,
  isIndex,
  linksFrom,
  linksTo,
  loadMarkdown,
  openPathsFor,
  pages,
  readingOrder,
  resolveLink,
  slug,
  tree,
  type Audience,
  type WikiFolder,
  type WikiNode,
  type WikiPage as Page,
} from './content'
import { setWikiAudience, setWikiFolderOpen, showWikiPage, useWikiAudience, useWikiFolders, useWikiLocation, type AudienceFilter } from './store'
import type { Hit } from './wiki-search'
import './wiki.css'

const loadSearch = () => import('./wiki-search')

// Also keep the extra languages that rehype-highlight supported by default.
const wikiLanguages = { arduino, ...codeLanguages, objectivec, 'php-template': phpTemplate, plaintext, 'python-repl': pythonRepl, shell, vbnet, wasm }

const REPO_DOCS = 'https://github.com/wojoe-444/MonoRail/blob/main/docs/'

function openExternal(url: string) {
  if (isDesktop()) void invokeModule('extensions', 'openExternal', { url }).catch(() => {})
  else window.open(url, '_blank', 'noopener')
}

/** The text inside rendered children, for heading anchors. */
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement<{ children?: ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('')
}

type Open = (id: string | undefined, anchor?: string) => void

export default function WikiPage() {
  const location = useWikiLocation()
  const audience = useWikiAudience()
  const [query, setQuery] = useState('')
  const opened = findPage(location?.id)
  // While searching, the results replace the page.
  const page = query ? undefined : opened
  const top = useRef<HTMLDivElement>(null)

  // A new page starts at the top, or at the heading it was opened at.
  useEffect(() => {
    const target = location?.anchor ? document.getElementById(location.anchor) : null
    ;(target ?? top.current)?.scrollIntoView({ block: 'start' })
  }, [location])

  function open(id: string | undefined, anchor?: string) {
    setQuery('')
    showWikiPage(id, anchor)
  }

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-8">
      <PageHeader
        eyebrow="Help"
        title={page ? page.title : 'Wiki'}
        description={page ? page.summary : 'Plain-language guides and technical reference for this version of MonoRail, linked like a notebook.'}
        actions={
          page && (
            <Button variant="outline" onClick={() => openExternal(`${REPO_DOCS}${page.id}.md`)}>
              <ExternalLink /> View on GitHub
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the wiki" className="pr-8 pl-9" aria-label="Search the wiki" />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <AudiencePicker value={audience} />
            <nav className="flex flex-col gap-1" aria-label="Wiki pages">
              <button
                type="button"
                onClick={() => open(undefined)}
                className={cn('rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-accent', !opened && !query && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft')}
              >
                Wiki home
              </button>
              <PageTree audience={audience} current={query ? undefined : opened} onOpen={open} />
            </nav>
            <HiddenNote audience={audience} count={pages.filter((p) => !shows(audience, p)).length} />
          </CardContent>
        </Card>

        {query ? (
          <WikiSearch query={query} audience={audience} onOpen={open} />
        ) : page ? (
          <ArticleLoader key={page.id} page={page} location={location} audience={audience} onOpen={open} />
        ) : (
          <WikiHome audience={audience} onOpen={open} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- audience

function shows(filter: AudienceFilter, page: Page) {
  return filter === 'all' || page.audience.includes(filter)
}

function folderPages(folder: WikiFolder): Page[] {
  return [...(folder.index ? [folder.index] : []), ...folder.children.flatMap((c) => (c.kind === 'page' ? [c.page] : folderPages(c.folder)))]
}

function folderShows(filter: AudienceFilter, folder: WikiFolder) {
  return folderPages(folder).some((p) => shows(filter, p))
}

const AUDIENCE_META: Record<Audience, { label: string; icon: LucideIcon; variant: 'success' | 'info'; hint: string }> = {
  human: { label: 'For people', icon: UserRound, variant: 'success', hint: 'Plain-language guide: no code needed to follow it.' },
  ai: { label: 'For agents', icon: Bot, variant: 'info', hint: 'Dense reference for agents and developers: exact names, paths and contracts.' },
}

function AudiencePicker({ value }: { value: AudienceFilter }) {
  const options: { id: AudienceFilter; label: string }[] = [
    { id: 'human', label: 'People' },
    { id: 'ai', label: 'Agents' },
    { id: 'all', label: 'All' },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 text-xs text-muted-foreground">Show pages written for</div>
      <div role="radiogroup" aria-label="Show pages written for" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => setWikiAudience(o.id)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
              value === o.id && 'bg-card text-foreground shadow-elevation-1',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function HiddenNote({ audience, count }: { audience: AudienceFilter; count: number }) {
  if (audience === 'all' || count === 0) return null
  return (
    <p className="px-1 text-xs text-muted-foreground">
      {count} page{count === 1 ? '' : 's'} written {audience === 'human' ? 'for agents' : 'for people'} hidden.{' '}
      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setWikiAudience('all')}>
        Show all
      </button>
    </p>
  )
}

export function AudienceBadges({ audience, className }: { audience: Audience[]; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap gap-1.5', className)}>
      {audience.map((a) => {
        const m = AUDIENCE_META[a]
        return (
          <Badge key={a} variant={m.variant} title={m.hint}>
            <m.icon /> {m.label}
          </Badge>
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------- page tree

/**
 * The page list as a folder tree, nested to any depth. Guides starts open
 * while deeper sections stay collapsed until clicked; the folders around the
 * open page always open. What the user opens or closes is remembered.
 */
function PageTree({ audience, current, onOpen }: { audience: AudienceFilter; current?: Page; onOpen: Open }) {
  const stored = useWikiFolders()
  const forced = new Set(current ? openPathsFor(current) : [])
  const isOpen = (path: string) => forced.has(path) || (stored[path] ?? path === 'guide')
  return (
    <div className="flex flex-col gap-0.5">
      {tree
        .filter((f) => folderShows(audience, f) || (current && folderPages(f).includes(current)))
        .map((f) => (
          <TreeFolder key={f.path} folder={f} depth={0} audience={audience} current={current} isOpen={isOpen} onOpen={onOpen} />
        ))}
    </div>
  )
}

function TreeFolder({
  folder,
  depth,
  audience,
  current,
  isOpen,
  onOpen,
}: {
  folder: WikiFolder
  depth: number
  audience: AudienceFilter
  current?: Page
  isOpen: (path: string) => boolean
  onOpen: Open
}) {
  const open = isOpen(folder.path)
  const active = current && folder.index && current.id === folder.index.id
  const visible = (n: WikiNode) =>
    n.kind === 'page' ? shows(audience, n.page) || n.page.id === current?.id : folderShows(audience, n.folder) || (!!current && folderPages(n.folder).includes(current))
  const toggle = () => setWikiFolderOpen(folder.path, !open)
  return (
    <div className="flex flex-col gap-0.5">
      <div className={cn('group flex items-center rounded-md', active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-accent')}>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Close' : 'Open'} ${folder.title}`} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground">
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => (folder.index ? onOpen(folder.index.id) : toggle())}
          className={cn(
            'min-w-0 flex-1 truncate py-1.5 pr-2 text-left',
            depth === 0 ? 'text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase' : 'text-sm font-medium',
            active && 'text-primary-soft-foreground',
          )}
        >
          {folder.title}
        </button>
      </div>
      {open && (
        <div className="ml-3.5 flex flex-col gap-0.5 border-l pl-2">
          {folder.children.filter(visible).map((n) =>
            n.kind === 'page' ? (
              <button
                key={n.page.id}
                type="button"
                onClick={() => onOpen(n.page.id)}
                className={cn(
                  'truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  current?.id === n.page.id && 'bg-primary-soft font-medium text-primary-soft-foreground hover:bg-primary-soft',
                )}
              >
                {navLabel(n.page)}
              </button>
            ) : (
              <TreeFolder key={n.folder.path} folder={n.folder} depth={depth + 1} audience={audience} current={current} isOpen={isOpen} onOpen={onOpen} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** Short labels for the tree. */
function navLabel(p: Page) {
  return p.title.replace(/\s*\(.*\)\s*$/, '').replace(/^Extensions roadmap$/, 'Roadmap').replace(/^Tutorial: .*/, 'Tutorial')
}

// ---------------------------------------------------------------- home

/** Icons for pages and folders shown as cards. */
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

function WikiHome({ audience, onOpen }: { audience: AudienceFilter; onOpen: Open }) {
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
function NodeCards({ folder, audience, onOpen, withIndex }: { folder: WikiFolder; audience: AudienceFilter; onOpen: Open; withIndex?: boolean }) {
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

// ---------------------------------------------------------------- search

function WikiSearch({ query, audience, onOpen }: { query: string; audience: AudienceFilter; onOpen: Open }) {
  const [resource, retry, retried] = useAsyncResource(loadSearch)
  const results = useMemo(() => resource.status === 'ready' ? resource.data.search(query) : [], [query, resource])
  if (resource.status !== 'ready') return <WikiLoadStatus status={resource.status} label="search" onRetry={retry} retried={retried} />
  const shown = results.filter((r) => shows(audience, r.page))
  return <SearchResults query={query} results={shown} hidden={results.length - shown.length} onOpen={onOpen} />
}

function SearchResults({ query, results, hidden, onOpen }: { query: string; results: Hit[]; hidden: number; onOpen: Open }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search</CardTitle>
        <CardDescription>
          {results.length === 0 ? `Nothing matches “${query}”.` : `${results.length} page${results.length === 1 ? '' : 's'} match “${query}”.`}
          {hidden > 0 && (
            <>
              {' '}
              {hidden} more in pages the filter hides.{' '}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setWikiAudience('all')}>
                Show all
              </button>
            </>
          )}
        </CardDescription>
      </CardHeader>
      {results.length > 0 && (
        <>
          <Separator />
          <CardContent className="p-0">
            <ul className="divide-y">
              {results.map((r) => (
                <li key={r.page.id}>
                  <button type="button" onClick={() => onOpen(r.page.id)} className="flex w-full flex-col gap-1 px-6 py-4 text-left hover:bg-accent/60">
                    <span className="text-sm font-medium">
                      {r.page.title} <span className="font-normal text-muted-foreground">· {folderChain(r.page).map((f) => f.title).join(' › ')}</span>
                    </span>
                    <AudienceBadges audience={r.page.audience} />
                    <span className="text-sm text-muted-foreground">{r.snippet}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- article

/** The folders above a page, each one a link to its index page. */
function Breadcrumbs({ page, onOpen }: { page: Page; onOpen: Open }) {
  const chain = folderChain(page)
  return (
    <nav aria-label="Where this page is" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <button type="button" onClick={() => onOpen(undefined)} className="rounded px-1 hover:text-foreground hover:underline">
        Wiki
      </button>
      {chain.map((f) => (
        <span key={f.path} className="flex items-center gap-1">
          <ChevronRight className="size-3.5" />
          {f.index ? (
            <button type="button" onClick={() => onOpen(f.index!.id)} className="rounded px-1 hover:text-foreground hover:underline">
              {f.title}
            </button>
          ) : (
            <span className="px-1">{f.title}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

/** A link to another wiki page, with a preview of that page on hover. */
function WikiLink({ target, anchor, onOpen, children }: { target: Page; anchor?: string; onOpen: Open; children: ReactNode }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <a
          href="#/wiki"
          className="wiki-link"
          onClick={(e) => {
            // Never let a link navigate the hub's window.
            e.preventDefault()
            onOpen(target.id, anchor)
          }}
        >
          {children}
        </a>
      </HoverCardTrigger>
      <HoverCardContent>
        <PagePreview page={target} />
      </HoverCardContent>
    </HoverCard>
  )
}

function PagePreview({ page }: { page: Page }) {
  const chain = folderChain(page)
  return (
    <div className="flex flex-col gap-2">
      {chain.length > 0 && <div className="text-xs text-muted-foreground">{chain.map((f) => f.title).join(' › ')}</div>}
      <div className="font-medium">{page.title}</div>
      {page.summary && <p className="line-clamp-4 text-sm text-muted-foreground">{page.summary}</p>}
      <div className="flex items-center justify-between gap-2">
        <AudienceBadges audience={page.audience} />
        <span className="text-xs text-muted-foreground">{linksTo(page).length} linked from</span>
      </div>
    </div>
  )
}

interface ArticleProps {
  page: Page
  location: ReturnType<typeof useWikiLocation>
  audience: AudienceFilter
  onOpen: Open
}

function ArticleLoader(props: ArticleProps) {
  const id = props.page.id
  const load = useCallback(() => loadMarkdown(id), [id])
  const [resource, retry, retried] = useAsyncResource(load)
  if (resource.status !== 'ready') return <WikiLoadStatus status={resource.status} label="page" onRetry={retry} retried={retried} />
  return <Article {...props} markdown={resource.data} />
}

function WikiLoadStatus({ status, label, onRetry, retried }: {
  status: 'loading' | 'error'
  label: 'search' | 'page'
  onRetry: () => void
  retried: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-6 text-sm text-muted-foreground">
        {status === 'loading' ? (
          <p role="status">Loading Wiki {label}…</p>
        ) : (
          <>
            <p role="alert">This Wiki {label} couldn’t load.</p>
            <Button size="sm" variant="outline" onClick={retried ? () => window.location.reload() : onRetry}>
              {retried ? 'Reload MonoRail' : 'Try again'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Article({ page, markdown, location, audience, onOpen }: ArticleProps & { markdown: string }) {
  const article = useRef<HTMLElement>(null)

  // The heading is present only once this article's Markdown has loaded.
  useEffect(() => {
    if (!location?.anchor) return
    article.current?.querySelector(`#${CSS.escape(location.anchor)}`)?.scrollIntoView({ block: 'start' })
  }, [location])

  // Previous and next follow the reading order within the page's top folder.
  const top = page.group.split('/')[0]
  const order = readingOrder.filter((p) => p.group.split('/')[0] === top && (shows(audience, p) || p.id === page.id))
  const i = order.findIndex((p) => p.id === page.id)
  const prev = order[i - 1]
  const next = order[i + 1]
  const folder = isIndex(page) ? findFolder(page.group) : undefined
  const headings = useMemo(() => headingsOf(markdown), [markdown])

  const components = useMemo<Components>(() => {
    const heading = (Tag: 'h2' | 'h3' | 'h4') =>
      function Heading({ children }: { children?: ReactNode }) {
        return (
          <Tag id={slug(textOf(children))} className="scroll-mt-24">
            {children}
          </Tag>
        )
      }
    return {
      // The page title is in the header above; the article starts after it.
      h1: () => null,
      h2: heading('h2'),
      h3: heading('h3'),
      h4: heading('h4'),
      a: ({ href, children }) => {
        const target = href ? resolveLink(page.id, href) : undefined
        if (!target) return <span>{children}</span>
        if (target.kind === 'page') {
          const to = findPage(target.id)
          if (to) {
            return (
              <WikiLink target={to} anchor={target.anchor} onOpen={onOpen}>
                {children}
              </WikiLink>
            )
          }
        }
        return (
          <a
            href={target.kind === 'external' ? target.url : '#/wiki'}
            onClick={(e) => {
              e.preventDefault()
              if (target.kind === 'external') openExternal(target.url)
              else if (target.kind === 'anchor') document.getElementById(target.anchor)?.scrollIntoView({ block: 'start' })
            }}
          >
            {children}
            {target.kind === 'external' && <ExternalLink className="ml-0.5 inline size-3 align-baseline" aria-label="(opens in your browser)" />}
          </a>
        )
      },
      // Docs ship no images; remote ones are never fetched.
      img: ({ alt }) => <span className="text-muted-foreground">[{alt || 'image'}]</span>,
    }
  }, [page.id, onOpen])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardContent className="px-6 py-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Breadcrumbs page={page} onOpen={onOpen} />
            <AudienceBadges audience={page.audience} />
          </div>
          {headings.length >= 3 && (
            <nav aria-label="On this page" className="mb-6 flex flex-wrap items-center gap-1.5 border-b pb-4">
              <span className="mr-1 text-xs font-medium text-muted-foreground">On this page:</span>
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
                >
                  {h.text}
                </button>
              ))}
            </nav>
          )}
          <article ref={article} className="wiki-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { languages: wikiLanguages }]]} components={components}>
              {markdown}
            </ReactMarkdown>
          </article>
        </CardContent>
      </Card>

      {folder && folder.children.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FolderOpen className="size-5 text-muted-foreground" /> In this section
          </h2>
          <NodeCards folder={folder} audience={audience} onOpen={onOpen} />
        </section>
      )}

      <Connections page={page} onOpen={onOpen} />

      {(prev || next) && (
        <div className="flex justify-between gap-4">
          {prev ? (
            <Button variant="outline" onClick={() => onOpen(prev.id)}>
              <ArrowLeft /> {navLabel(prev)}
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button variant="outline" onClick={() => onOpen(next.id)}>
              {navLabel(next)} <ArrowRight />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** "Linked from" (backlinks) and "Links on this page": the page's neighbours in the web of pages. */
function Connections({ page, onOpen }: { page: Page; onOpen: Open }) {
  const from = linksTo(page)
  const to = linksFrom(page)
  if (!from.length && !to.length) return null
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-6 px-6 py-5 md:grid-cols-2">
        <LinkList icon={CornerDownRight} title="Linked from" empty="No other page links here yet." pages={from} onOpen={onOpen} />
        <LinkList icon={Link2} title="Links on this page" empty="This page links to no other page." pages={to} onOpen={onOpen} />
      </CardContent>
    </Card>
  )
}

function LinkList({ icon: Icon, title, empty, pages: list, onOpen }: { icon: LucideIcon; title: string; empty: string; pages: Page[]; onOpen: Open }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <Icon className="size-3.5" /> {title} <span className="font-mono font-normal">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((p) => (
            <HoverCard key={p.id}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted/70 px-2.5 py-1 text-left text-xs font-medium text-foreground/90 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="truncate">{navLabel(p)}</span>
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="top">
                <PagePreview page={p} />
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>
      )}
    </div>
  )
}
