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
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  FolderOpen,
  Link2,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { codeLanguages } from '@/lib/highlight'
import { cn } from '@/lib/utils'
import { useAsyncResource } from '@/lib/useAsyncResource'
import { hasLocalScreen, invokeModule } from '@/modules/client'

import {
  findFolder,
  findPage,
  folderChain,
  headingsOf,
  isIndex,
  linksFrom,
  linksTo,
  loadMarkdown,
  navLabel,
  pages,
  readingOrder,
  resolveLink,
  shows,
  slug,
  type WikiPage as Page,
} from './content'
import { setWikiAudience, showWikiPage, useWikiAudience, useWikiLocation, type AudienceFilter } from './store'
import type { Hit } from './wiki-search'
import { AudienceBadges, AudiencePicker, HiddenNote, PageTree, type Open } from './WikiNavigation'
import { NodeCards, WikiHome } from './WikiHome'
import './wiki.css'

const loadSearch = () => import('./wiki-search')

// Also keep the extra languages that rehype-highlight supported by default.
const wikiLanguages = { arduino, ...codeLanguages, objectivec, 'php-template': phpTemplate, plaintext, 'python-repl': pythonRepl, shell, vbnet, wasm }

const REPO_DOCS = 'https://github.com/wojoe-444/MonoRail/blob/main/docs/'

function openExternal(url: string) {
  if (hasLocalScreen()) void invokeModule('extensions', 'openExternal', { url }).catch(() => {})
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
