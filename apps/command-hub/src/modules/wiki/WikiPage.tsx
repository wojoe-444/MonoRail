import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  ArrowRight,
  BookA,
  Bot,
  ChartLine,
  CircleHelp,
  Compass,
  ExternalLink,
  FileText,
  FolderGit2,
  KeyRound,
  MessagesSquare,
  PlugZap,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { invokeModule, isDesktop } from '@/modules/client'

import { findPage, groups, pages, plainText, resolveLink, slug, type Audience, type WikiPage as Page } from './content'
import { setWikiAudience, showWikiPage, useWikiAudience, useWikiLocation, type AudienceFilter } from './store'
import './wiki.css'

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

export default function WikiPage() {
  const location = useWikiLocation()
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

  const audience = useWikiAudience()
  const visible = (p: Page) => shows(audience, p)
  const results = useMemo(() => search(query), [query])
  const shown = results.filter((r) => shows(audience, r.page))

  function open(id: string | undefined, anchor?: string) {
    setQuery('')
    showWikiPage(id, anchor)
  }

  return (
    <div ref={top} className="flex scroll-mt-24 flex-col gap-8">
      <PageHeader
        eyebrow="Help"
        title={page ? page.title : 'Wiki'}
        description={page ? groupTitle(page.group) : 'Guides and reference for this version of MonoRail. The same pages are in the repository under docs/.'}
        actions={
          page && (
            <Button variant="outline" onClick={() => openExternal(`${REPO_DOCS}${page.id}.md`)}>
              <ExternalLink /> View on GitHub
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[256px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-6">
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
            <nav className="flex flex-col gap-4" aria-label="Wiki pages">
              <button
                type="button"
                onClick={() => open(undefined)}
                className={cn('rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent', !opened && !query && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft')}
              >
                Wiki home
              </button>
              {groups.map((g) => {
                // The open page stays listed even when the filter hides it.
                const list = g.pages.filter((p) => visible(p) || p.id === opened?.id)
                if (!list.length) return null
                return (
                <div key={g.id} className="flex flex-col gap-1">
                  <div className="px-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{g.title}</div>
                  {list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => open(p.id)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-left text-sm hover:bg-accent',
                        opened?.id === p.id && !query && 'bg-primary-soft font-medium text-primary-soft-foreground hover:bg-primary-soft',
                      )}
                    >
                      {navLabel(p)}
                    </button>
                  ))}
                </div>
                )
              })}
            </nav>
            <HiddenNote audience={audience} count={pages.filter((p) => !visible(p)).length} />
          </CardContent>
        </Card>

        {query ? (
          <SearchResults query={query} results={shown} hidden={results.length - shown.length} onOpen={open} />
        ) : page ? (
          <Article page={page} onOpen={open} />
        ) : (
          <WikiHome audience={audience} onOpen={open} />
        )}
      </div>
    </div>
  )
}

function groupTitle(id: string) {
  return groups.find((g) => g.id === id)?.title ?? ''
}

/** Short labels for the side list: a group's README is its "Overview". */
function navLabel(p: Page) {
  if (p.id.endsWith('/README') || p.id === 'README') return 'Overview'
  return p.title.replace(/\s*\(.*\)\s*$/, '').replace(/^Extensions roadmap$/, 'Roadmap').replace(/^Tutorial: .*/, 'Tutorial')
}

function shows(filter: AudienceFilter, page: Page) {
  return filter === 'all' || page.audience.includes(filter)
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
    <p className="px-3 text-xs text-muted-foreground">
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

/** Icons for the guide cards on the wiki's home page. */
const GUIDE_ICONS: Record<string, LucideIcon> = {
  'guide/README': Sparkles,
  'guide/first-ten-minutes': Compass,
  'guide/private-data': ShieldCheck,
  'guide/chat': MessagesSquare,
  'guide/create-an-agent': Plus,
  'guide/browse-repos': FolderGit2,
  'guide/connections': PlugZap,
  'guide/spend': ChartLine,
  'guide/agent-access': KeyRound,
  'guide/backups-and-updates': RefreshCw,
  'guide/extensions': Puzzle,
  'guide/glossary': BookA,
  'guide/faq': CircleHelp,
}

function WikiHome({ audience, onOpen }: { audience: AudienceFilter; onOpen: (id: string) => void }) {
  const guides = groups.find((g) => g.id === 'guide')?.pages.filter((p) => shows(audience, p)) ?? []
  const rest = groups.filter((g) => g.id !== 'guide').map((g) => ({ ...g, pages: g.pages.filter((p) => shows(audience, p)) })).filter((g) => g.pages.length)
  return (
    <div className="flex flex-col gap-8">
      {guides.length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Start here</h2>
            <p className="text-sm text-muted-foreground">Short guides in plain language. Pick whatever you are about to do.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {guides.map((p) => {
              const Icon = GUIDE_ICONS[p.id] ?? FileText
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="group flex items-start gap-4 rounded-xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-elevation-3"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{p.title}</span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{p.summary}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {rest.map((g) => (
        <Card key={g.id}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
            <CardDescription>{g.pages.length} pages</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ul className="divide-y">
              {g.pages.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onOpen(p.id)} className="flex w-full items-start gap-4 px-6 py-4 text-left hover:bg-accent/60">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.title}</span>
                      {p.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{p.summary}</span>}
                    </span>
                    <AudienceBadges audience={p.audience} className="hidden shrink-0 sm:inline-flex" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface Hit {
  page: Page
  snippet: string
  score: number
}

function search(query: string): Hit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: Hit[] = []
  for (const page of pages) {
    const text = plainText(page.markdown)
    const lower = text.toLowerCase()
    const title = page.title.toLowerCase()
    if (!words.every((w) => lower.includes(w) || title.includes(w))) continue
    const at = Math.max(0, lower.indexOf(words[0]))
    const start = Math.max(0, at - 60)
    const snippet = (start > 0 ? '…' : '') + text.slice(start, at + 140).trim() + (at + 140 < text.length ? '…' : '')
    const score = words.reduce((s, w) => s + (title.includes(w) ? 10 : 0) + lower.split(w).length - 1, 0)
    hits.push({ page, snippet, score })
  }
  return hits.sort((a, b) => b.score - a.score)
}

function SearchResults({ query, results, hidden, onOpen }: { query: string; results: Hit[]; hidden: number; onOpen: (id: string) => void }) {
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
                      {r.page.title} <span className="font-normal text-muted-foreground">· {groupTitle(r.page.group)}</span>
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

function Article({ page, onOpen }: { page: Page; onOpen: (id: string, anchor?: string) => void }) {
  const siblings = pages.filter((p) => p.group === page.group)
  const i = siblings.findIndex((p) => p.id === page.id)
  const prev = siblings[i - 1]
  const next = siblings[i + 1]

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
        return (
          <a
            href={target.kind === 'external' ? target.url : `#/wiki`}
            onClick={(e) => {
              // Never let a link navigate the hub's window.
              e.preventDefault()
              if (target.kind === 'external') openExternal(target.url)
              else if (target.kind === 'page') onOpen(target.id, target.anchor)
              else document.getElementById(target.anchor)?.scrollIntoView({ block: 'start' })
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
          <AudienceBadges audience={page.audience} className="mb-6" />
          <article className="wiki-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]} components={components}>
              {page.markdown}
            </ReactMarkdown>
          </article>
        </CardContent>
      </Card>
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
