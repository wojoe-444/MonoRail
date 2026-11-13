import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'

import { SETTINGS_PATH, SETTINGS_SECTION } from '@/components/layout/nav'
import { useExtensionList } from '@/extensions/store'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { allModules } from '@/modules/registry'
import type { ModuleDefinition } from '@/modules/types'

import { useSettingsAlerts } from './alerts'
import { searchSettings, type SearchHit } from './search'

/** Groups in menu order; a page with another group is listed after these, under its own heading. */
const GROUP_ORDER = ['App', 'Accounts & access']

/** Every Settings page (modules with `nav.section: 'Settings'`), in menu order. */
export function useSettingsPages(): ModuleDefinition[] {
  const list = useExtensionList()
  return useMemo(
    () => allModules(list).filter((m) => m.nav.section === SETTINGS_SECTION).sort((a, b) => (a.nav.order ?? 100) - (b.nav.order ?? 100)),
    [list],
  )
}

function groupPages(pages: ModuleDefinition[]): { heading?: string; pages: ModuleDefinition[] }[] {
  const groups = new Map<string, ModuleDefinition[]>()
  for (const p of pages) {
    const g = p.path === SETTINGS_PATH ? '' : (p.nav.group ?? 'More')
    groups.set(g, [...(groups.get(g) ?? []), p])
  }
  const rank = (g: string) => (g === '' ? -1 : GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length)
  return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([heading, pages]) => ({ heading: heading || undefined, pages }))
}

/** Scroll to an element on the page just opened, once it has rendered, and flash it. */
function scrollToAnchor(id: string) {
  let tries = 0
  const t = setInterval(() => {
    const el = document.getElementById(id)
    if (el || ++tries > 40) clearInterval(t)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('settings-flash')
    setTimeout(() => el.classList.remove('settings-flash'), 1600)
  }, 50)
}

/**
 * The frame of every Settings page: a menu of the pages (grouped, with the
 * alert count on Home) and a search box above it, beside the page. Search
 * results replace the menu while there is a query; Ctrl+K focuses the box.
 */
export function SettingsLayout({ path, children }: { path: string; children: ReactNode }) {
  const pages = useSettingsPages()
  const { alerts } = useSettingsAlerts()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => searchSettings(query, pages), [query, pages])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function open(hit: SearchHit) {
    setQuery('')
    navigate(hit.path)
    if (hit.anchor) scrollToAnchor(hit.anchor)
  }

  const connectionAlerts = alerts.filter((a) => a.path === '/connections').length

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-60">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
              else if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, hits.length - 1))
              else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
              else if (e.key === 'Enter' && hits[active]) open(hits[active])
              else return
              e.preventDefault()
            }}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-9 w-full rounded-md border border-input bg-card pr-14 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              Ctrl K
            </kbd>
          )}
        </div>

        {query.trim() ? (
          <div role="listbox" aria-label="Search results">
            <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : 'No results'}
            </div>
            {hits.length === 0 && <p className="px-3 text-sm text-muted-foreground">Nothing in Settings matches "{query.trim()}".</p>}
            <ul className="flex flex-col gap-0.5">
              {hits.map((h, i) => (
                <li key={`${h.path}|${h.label}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => open(h)}
                    className={cn('flex w-full flex-col rounded-md px-3 py-2 text-left', i === active && 'bg-muted')}
                  >
                    <span className="text-sm font-medium">{h.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {h.page === h.label ? h.detail : `${h.page} · ${h.detail}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <nav aria-label="Settings" className="flex flex-wrap gap-x-6 gap-y-4 lg:flex-col lg:flex-nowrap lg:gap-6">
            {groupPages(pages).map((g) => (
              <div key={g.heading ?? 'home'}>
                {g.heading && <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{g.heading}</div>}
                <ul className="flex flex-wrap gap-0.5 lg:flex-col">
                  {g.pages.map((p) => {
                    const on = p.path === path
                    const Icon = p.icon
                    const count = p.path === SETTINGS_PATH ? alerts.length : 0
                    const dot = p.path === '/connections' && connectionAlerts > 0
                    return (
                      <li key={p.path}>
                        <button
                          type="button"
                          onClick={() => navigate(p.path)}
                          aria-current={on ? 'page' : undefined}
                          className={cn(
                            'flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            on ? 'bg-primary-soft font-medium text-primary-soft-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="flex-1 truncate">{p.path === SETTINGS_PATH ? 'Home' : p.title}</span>
                          {count > 0 && (
                            <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] leading-5 font-semibold text-black">{count}</span>
                          )}
                          {dot && <span className="size-1.5 rounded-full bg-warning" aria-label="Needs attention" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
