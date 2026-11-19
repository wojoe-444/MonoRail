import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, ChevronRight, Compass, CornerDownLeft, FileText, MessageSquare, Search, Settings2, Shapes, X } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { currentPath, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { openInChat } from '@/modules/agent-chat/handoff'
import type { SessionSummary } from '@/modules/agent-chat/types'
import { openInExplore } from '@/modules/explore/handoff'
import { scrollToAnchor } from '@/modules/settings/search'
import type { IconComponent } from '@/modules/types'
import type { WikiPage } from '@/modules/wiki/content'
import { openWiki } from '@/modules/wiki/store'
import { CATEGORIES, SECTIONS, category, entityType } from '@/standard'

import {
  addRecent,
  isSettingsPath,
  loadChats,
  loadWikiPages,
  readRecents,
  searchChats,
  searchTypes,
  searchWiki,
  SECTION_SUMMARIES,
  usePageIndex,
  type Recent,
  type Target,
} from './sources'
import { closeSearch, openSearch, SCOPES, useSearchState, type SearchScope, type SearchState } from './store'

/** How many results each group shows on the All scope; a scope of its own shows up to `SCOPED_MAX`. */
const GROUP_MAX = 5
const SCOPED_MAX = 60

type Kind = Recent['kind'] | 'section'

interface Item {
  key: string
  kind: Kind
  label: string
  detail?: string
  icon?: IconComponent
  /** Small chip at the right edge (an entity type's origin, a chat's repo). */
  badge?: string
  target?: Target
  /** A standard section id: choosing it browses that section instead of leaving. */
  section?: string
}

interface Group {
  id: string
  heading: string
  /** Shown at the right of the heading: a count, or "Tab" to switch to that scope. */
  aside?: ReactNode
  /** Lay the items out as tiles (catalog sections). */
  tiles?: boolean
  items: Item[]
}

const KIND_ICON: Record<Kind, IconComponent> = {
  page: FileText,
  setting: Settings2,
  type: Shapes,
  chat: MessageSquare,
  wiki: BookOpen,
  section: Compass,
}

const KIND_TONE: Record<Kind, string> = {
  page: 'bg-primary-soft text-primary-soft-foreground',
  setting: 'bg-warning-soft text-warning-soft-foreground',
  type: 'bg-info-soft text-info-soft-foreground',
  chat: 'bg-success-soft text-success-soft-foreground',
  wiki: 'bg-muted text-muted-foreground',
  section: 'bg-info-soft text-info-soft-foreground',
}

const typeItem = (type: string): Item | undefined => {
  const t = entityType(type)
  if (!t) return undefined
  return {
    key: `type:${t.type}`,
    kind: 'type',
    label: t.name,
    detail: `${category(t.category)?.name ?? t.category} · ${t.summary}`,
    badge: t.origin === 'monorail' ? 'MonoRail' : 'OpenMetadata',
    target: { kind: 'type', type: t.type },
  }
}

const chatItem = (c: SessionSummary): Item => ({
  key: `chat:${c.id}`,
  kind: 'chat',
  label: c.title || 'Untitled chat',
  detail: [c.repo.name, c.branch].filter(Boolean).join(' · '),
  badge: c.source === 'pi' ? 'pi' : undefined,
  target: { kind: 'chat', id: c.id },
})

const wikiItem = (p: WikiPage): Item => ({
  key: `wiki:${p.id}`,
  kind: 'wiki',
  label: p.title,
  detail: p.summary,
  badge: p.audience.includes('human') ? 'Guide' : 'Reference',
  target: { kind: 'wiki', id: p.id },
})

/** Go where a result points. */
function go(target: Target) {
  switch (target.kind) {
    case 'path':
      navigate(target.path)
      if (target.anchor) scrollToAnchor(target.anchor)
      break
    case 'type':
      openInExplore(target.type)
      break
    case 'wiki':
      openWiki(target.id, target.anchor)
      break
    case 'chat':
      openInChat({ open: target.id })
      break
  }
}


/**
 * The command palette: one search over pages, Settings, the catalog (entity
 * types of the MonoRail standard, opened in Explore), chats and the wiki.
 * Ctrl+K opens it anywhere in the hub (on the Settings scope when a Settings
 * page is open); so does the top bar's search field. Before anything is
 * typed it shows recent results and the catalog's sections.
 */
export function CommandPalette() {
  const state = useSearchState()

  // Ctrl+K anywhere in the hub; a second press closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      if (state.open) closeSearch()
      else openSearch(isSettingsPath(currentPath()) ? { scope: 'settings' } : {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open])

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && closeSearch()}>
      <DialogContent
        showClose={false}
        aria-describedby="command-palette-help"
        className="top-[10vh] flex max-h-[min(640px,80vh)] max-w-2xl translate-y-0 flex-col gap-0 overflow-hidden p-0"
        // The body focuses its own input when it mounts.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Search MonoRail</DialogTitle>
        <DialogDescription id="command-palette-help" className="sr-only">
          Search pages, the catalog, chats, settings and the wiki. Up and down move, Enter opens, Tab changes what is searched, Escape closes.
        </DialogDescription>
        {/* Keyed by the open, so every open starts fresh from how it was opened; chats are re-read each time. */}
        <PaletteBody key={state.openId} start={state} />
      </DialogContent>
    </Dialog>
  )
}

function PaletteBody({ start }: { start: SearchState }) {
  const index = usePageIndex()
  const [query, setQuery] = useState(start.query)
  const [scope, setScope] = useState<SearchScope>(start.scope)
  const [section, setSection] = useState<string | undefined>(start.section)
  const [active, setActive] = useState(0)
  const [recents] = useState<Recent[]>(readRecents)
  const [wiki, setWiki] = useState<WikiPage[]>()
  const [chats, setChats] = useState<SessionSummary[]>()
  const [chatsError, setChatsError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const needsWiki = !wiki && (scope === 'wiki' || (scope === 'all' && query.trim() !== ''))
  useEffect(() => {
    if (!needsWiki) return
    let live = true
    void loadWikiPages().then((p) => live && setWiki(p))
    return () => {
      live = false
    }
  }, [needsWiki])

  const needsChats = chats === undefined && !chatsError && (scope === 'chats' || (scope === 'all' && query.trim() !== ''))
  useEffect(() => {
    if (!needsChats) return
    let live = true
    loadChats().then(
      (c) => live && setChats(c),
      (e: unknown) => live && setChatsError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
  }, [needsChats])

  const groups = useMemo<Group[]>(() => {
    const q = query.trim()
    const max = scope === 'all' ? GROUP_MAX : SCOPED_MAX
    const out: Group[] = []
    const want = (s: SearchScope) => scope === 'all' || scope === s
    const more = (s: SearchScope, total: number) =>
      scope === 'all' && total > GROUP_MAX ? (
        <button type="button" className="hover:text-foreground" onClick={() => { setScope(s); setActive(0); input.current?.focus() }}>
          See all {total}
        </button>
      ) : total > 0 ? <span>{total}</span> : undefined

    if (!q && scope === 'all') {
      const recent = recents.map((r): Item => ({ key: `recent:${JSON.stringify(r.target)}`, kind: r.kind, label: r.label, detail: r.detail, target: r.target }))
      if (recent.length) out.push({ id: 'recent', heading: 'Recent', items: recent })
      out.push({ id: 'sections', heading: 'Browse the catalog', tiles: true, items: SECTION_SUMMARIES.map(sectionItem) })
      return out
    }

    if (want('pages')) {
      const hits = q ? index.search(q).filter((h) => h.kind === 'page') : index.pages
      if (hits.length || scope === 'pages')
        out.push({ id: 'pages', heading: 'Pages', aside: more('pages', hits.length), items: hits.slice(0, max).map((h) => ({ key: `page:${h.path}`, kind: 'page', label: h.label, detail: h.detail, icon: h.icon, target: { kind: 'path', path: h.path } })) })
    }

    if (want('catalog')) {
      if (!q && !section) {
        out.push({ id: 'sections', heading: 'Sections', tiles: true, items: SECTION_SUMMARIES.map(sectionItem) })
      } else if (!q && section) {
        // One section, by category.
        for (const c of CATEGORIES.filter((c) => c.section === section)) {
          const items = searchTypes('', section).filter((t) => t.category === c.id).map((t) => typeItem(t.type)!)
          if (items.length) out.push({ id: `cat:${c.id}`, heading: c.name, aside: <span>{items.length}</span>, items })
        }
      } else {
        const hits = searchTypes(q, section)
        if (hits.length || scope === 'catalog')
          out.push({ id: 'catalog', heading: section ? `Catalog › ${SECTIONS.find((s) => s.id === section)?.name}` : 'Catalog', aside: more('catalog', hits.length), items: hits.slice(0, max).map((t) => typeItem(t.type)!) })
      }
    }

    if (want('chats') && chats) {
      const hits = searchChats(chats, q)
      if (hits.length || scope === 'chats') out.push({ id: 'chats', heading: 'Chats', aside: more('chats', hits.length), items: hits.slice(0, max).map(chatItem) })
    }

    if (want('settings')) {
      const hits = q ? index.search(q).filter((h) => h.kind === 'setting') : index.settings
      if (hits.length || scope === 'settings')
        out.push({ id: 'settings', heading: 'Settings', aside: more('settings', hits.length), items: hits.slice(0, max).map((h) => ({ key: `setting:${h.path}#${h.anchor ?? ''}|${h.label}`, kind: 'setting', label: h.label, detail: h.detail, icon: h.icon, target: { kind: 'path', path: h.path, anchor: h.anchor } })) })
    }

    if (want('wiki') && wiki) {
      const hits = searchWiki(wiki, q)
      if (hits.length || scope === 'wiki') out.push({ id: 'wiki', heading: q ? 'Wiki' : 'Guides', aside: more('wiki', hits.length), items: hits.slice(0, max).map(wikiItem) })
    }
    return out
  }, [query, scope, section, recents, index, chats, wiki])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const current = flat[Math.min(active, flat.length - 1)]

  // Keep the highlighted result in view.
  useEffect(() => {
    if (!current) return
    list.current?.querySelector(`[data-key="${CSS.escape(current.key)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  function choose(item: Item) {
    if (item.section) {
      setScope('catalog')
      setSection(item.section)
      setQuery('')
      setActive(0)
      input.current?.focus()
      return
    }
    if (!item.target) return
    addRecent({ kind: item.kind as Recent['kind'], label: item.label, detail: item.detail ?? '', target: item.target })
    closeSearch()
    go(item.target)
  }

  function cycleScope(dir: 1 | -1) {
    const i = SCOPES.findIndex((s) => s.id === scope)
    setScope(SCOPES[(i + dir + SCOPES.length) % SCOPES.length].id)
    setSection(undefined)
    setActive(0)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, flat.length - 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter' && current) choose(current)
    else if (e.key === 'Tab') cycleScope(e.shiftKey ? -1 : 1)
    else if (e.key === 'Backspace' && !query && (section || scope !== 'all')) {
      // Climb out: a section first, then the scope.
      if (section) setSection(undefined)
      else setScope('all')
      setActive(0)
    } else return
    e.preventDefault()
  }

  const loading = (scope === 'chats' && chats === undefined && !chatsError) || (scope === 'wiki' && !wiki)
  const sectionName = section ? SECTIONS.find((s) => s.id === section)?.name : undefined

  return (
    <>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {sectionName && (
            <button
              type="button"
              onClick={() => setSection(undefined)}
              className="flex shrink-0 items-center gap-1 rounded-md bg-info-soft px-2 py-0.5 text-xs font-semibold text-info-soft-foreground"
              aria-label={`Stop browsing ${sectionName}`}
            >
              {sectionName}
              <X className="size-3" />
            </button>
          )}
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={sectionName ? `Search ${sectionName}…` : 'Search pages, catalog, chats, settings…'}
            aria-label="Search MonoRail"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-results"
            aria-activedescendant={current ? `cp-${current.key}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground sm:block">Esc</kbd>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 border-b px-3 py-2" role="tablist" aria-label="What to search">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              onClick={() => {
                setScope(s.id)
                setSection(undefined)
                setActive(0)
                input.current?.focus()
              }}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                scope === s.id ? 'bg-primary-soft font-semibold text-primary-soft-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div ref={list} id="command-palette-results" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups.map((g) => (
            <div key={g.id} role="group" aria-label={g.heading} className="pb-1">
              <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>{g.heading}</span>
                {g.id === 'sections' && scope === 'all' ? (
                  <button type="button" onClick={() => { closeSearch(); navigate('/explore') }} className="normal-case tracking-normal hover:text-foreground">
                    Open Explore
                  </button>
                ) : (
                  g.aside && <span className="font-normal tracking-normal normal-case">{g.aside}</span>
                )}
              </div>
              {g.tiles ? (
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-1 sm:grid-cols-3">
                  {g.items.map((item) => (
                    <SectionTile key={item.key} item={item} on={item === current} onHover={() => setActive(flat.indexOf(item))} onChoose={() => choose(item)} />
                  ))}
                </div>
              ) : (
                g.items.map((item) => (
                  <Row key={item.key} item={item} on={item === current} onHover={() => setActive(flat.indexOf(item))} onChoose={() => choose(item)} />
                ))
              )}
            </div>
          ))}
          {flat.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {loading
                ? 'Loading…'
                : scope === 'chats' && chatsError
                  ? `Chats could not be read: ${chatsError}`
                  : query.trim()
                    ? `Nothing matches “${query.trim()}”.`
                    : 'Nothing here yet.'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
          <Hint keys={['↑', '↓']}>move</Hint>
          <Hint keys={[<CornerDownLeft key="enter" className="size-3" />]}>open</Hint>
          <Hint keys={['Tab']}>change scope</Hint>
          {(section || scope !== 'all') && <Hint keys={['⌫']}>back</Hint>}
          <span className="ml-auto hidden sm:inline">Catalog types open in Explore</span>
        </div>
    </>
  )
}

function sectionItem(s: (typeof SECTION_SUMMARIES)[number]): Item {
  return { key: `section:${s.id}`, kind: 'section', label: s.name, detail: `${s.types} types · ${s.examples.join(', ')}`, section: s.id }
}

function Row({ item, on, onHover, onChoose }: { item: Item; on: boolean; onHover: () => void; onChoose: () => void }) {
  const Icon = item.icon ?? KIND_ICON[item.kind]
  return (
    <button
      type="button"
      id={`cp-${item.key}`}
      data-key={item.key}
      role="option"
      aria-selected={on}
      tabIndex={-1}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn('flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left', on && 'bg-muted')}
    >
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', KIND_TONE[item.kind])}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
      </span>
      {item.badge && <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{item.badge}</span>}
      {on && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
    </button>
  )
}

function SectionTile({ item, on, onHover, onChoose }: { item: Item; on: boolean; onHover: () => void; onChoose: () => void }) {
  const [count, examples] = (item.detail ?? '').split(' · ')
  return (
    <button
      type="button"
      id={`cp-${item.key}`}
      data-key={item.key}
      role="option"
      aria-selected={on}
      tabIndex={-1}
      onMouseMove={onHover}
      onClick={onChoose}
      className={cn('flex min-w-0 flex-col rounded-lg p-2.5 text-left ring-1 ring-foreground/10', on && 'bg-muted ring-foreground/20')}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="truncate">{item.label}</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
      {examples && <span className="mt-0.5 truncate text-[11px] text-muted-foreground">{examples}</span>}
    </button>
  )
}

function Hint({ keys, children }: { keys: ReactNode[]; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <kbd key={i} className="inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1 font-mono text-[10px]">
          {k}
        </kbd>
      ))}
      {children}
    </span>
  )
}

