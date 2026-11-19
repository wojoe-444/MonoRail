import { useMemo } from 'react'

import { allApps } from '@/apps/registry'
import { flattenNav, SETTINGS_PATH, SETTINGS_SECTION, useNavSections } from '@/components/layout/nav'
import { useExtensionList } from '@/extensions/store'
import { prefs } from '@/lib/prefs'
import { invokeModule, isDesktop } from '@/modules/client'
import { allModules, findModuleByPath } from '@/modules/registry'
import { searchSettings } from '@/modules/settings/search'
import { useSettingsPages } from '@/modules/settings/SettingsLayout'
import type { IconComponent } from '@/modules/types'
import type { SessionSummary } from '@/modules/agent-chat/types'
import type { WikiPage } from '@/modules/wiki/content'
import { CATEGORIES, ENTITY_TYPES, SECTIONS, category, type EntityType } from '@/standard'

/**
 * What the command palette (and Home's search) look through. Every source
 * reads what MonoRail already has in memory or on demand; nothing is cached
 * to disk, and only the last few opened results are kept, in `prefs`.
 */

/** A page or a Settings page, card or option. */
export interface PageHit {
  kind: 'page' | 'setting'
  label: string
  detail: string
  path: string
  anchor?: string
  icon?: IconComponent
}

/** Words of a query, lower case. */
export const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)

/** 0 when the label starts with the first word, 1 when it contains it, 2 otherwise. */
export function rank(label: string, ws: string[]) {
  const l = label.toLowerCase()
  return !ws.length ? 0 : l.startsWith(ws[0]) ? 0 : l.includes(ws[0]) ? 1 : 2
}

const matchesAll = (hay: string, ws: string[]) => {
  const h = hay.toLowerCase()
  return ws.every((w) => h.includes(w))
}

/**
 * Every page in the drawer (with its module's or app's description) plus the
 * Settings search (pages, cards and options). Settings pages come from the
 * Settings search only, so each is listed once.
 */
export function usePageIndex(): { pages: PageHit[]; settings: PageHit[]; search: (query: string) => PageHit[] } {
  const list = useExtensionList()
  const sections = useNavSections()
  const settingsPages = useSettingsPages()
  return useMemo(() => {
    const described = new Map<string, string>()
    for (const m of allModules(list)) described.set(m.path, m.description)
    for (const a of allApps(list)) described.set(a.path, a.description)
    const settingsPaths = new Set(settingsPages.map((p) => p.path))
    const iconOf = new Map(settingsPages.map((p) => [p.path, p.icon]))
    const pages: PageHit[] = flattenNav(sections)
      .filter((i) => i.path !== '/' && i.path !== SETTINGS_PATH && !settingsPaths.has(i.path))
      .map((i) => ({ kind: 'page', label: i.label, detail: described.get(i.path) ?? '', path: i.path, icon: i.icon }))
    const settings: PageHit[] = settingsPages.map((p) => ({
      kind: 'setting',
      label: p.path === SETTINGS_PATH ? 'Settings' : p.title,
      detail: p.description,
      path: p.path,
      icon: p.icon,
    }))

    const search = (query: string) => {
      const ws = words(query)
      if (!ws.length) return []
      // Best first: name starts with the first word, then name contains it,
      // then a match elsewhere. Pages come before Settings on a tie.
      const pageHits = pages.filter((h) => matchesAll(`${h.label} ${h.detail}`, ws)).map((h) => ({ h, score: rank(h.label, ws) }))
      // searchSettings already checks every word and orders its own hits.
      const settingsHits = searchSettings(query, settingsPages).map((s, i) => ({
        h: {
          kind: 'setting' as const,
          label: s.label,
          detail: s.page === s.label ? `Settings · ${s.detail}` : `Settings › ${s.page} · ${s.detail}`,
          path: s.path,
          anchor: s.anchor,
          icon: iconOf.get(s.path),
        },
        score: rank(s.label, ws) + 0.5 + i / 1000,
      }))
      return [...pageHits, ...settingsHits].sort((a, b) => a.score - b.score).map((x) => x.h)
    }
    return { pages, settings, search }
  }, [list, sections, settingsPages])
}

/** Entity types of the MonoRail standard that match every word, best first; optionally only one section's. */
export function searchTypes(query: string, section?: string): EntityType[] {
  const ws = words(query)
  const inSection = section ? new Set(CATEGORIES.filter((c) => c.section === section).map((c) => c.id)) : undefined
  return ENTITY_TYPES.filter((t) => !inSection || inSection.has(t.category))
    .map((t) => {
      const cat = category(t.category)
      const hay = `${t.name} ${t.plural} ${t.type} ${t.summary} ${cat?.name ?? ''}`
      return { t, score: matchesAll(hay, ws) ? Math.min(rank(t.name, ws), rank(t.type, ws)) : -1 }
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name))
    .map((x) => x.t)
}

/** The standard's sections with how many categories and entity types each has. */
export const SECTION_SUMMARIES = SECTIONS.map((s) => {
  const cats = CATEGORIES.filter((c) => c.section === s.id)
  const types = ENTITY_TYPES.filter((t) => cats.some((c) => c.id === t.category))
  return { id: s.id, name: s.name, categories: cats.length, types: types.length, examples: types.slice(0, 4).map((t) => t.name) }
})

/** The wiki's pages, loaded on first use so the docs stay out of the main bundle. */
let wikiPages: Promise<WikiPage[]> | undefined
export function loadWikiPages(): Promise<WikiPage[]> {
  return (wikiPages ??= import('@/modules/wiki/content').then((m) => m.pages))
}

export function searchWiki(pages: WikiPage[], query: string): WikiPage[] {
  const ws = words(query)
  if (!ws.length) return pages.filter((p) => p.id.startsWith('guide/')).sort((a, b) => a.title.localeCompare(b.title))
  return pages
    .filter((p) => matchesAll(`${p.title} ${p.summary} ${p.id}`, ws))
    .map((p) => ({ p, score: rank(p.title, ws) + (p.audience.includes('human') ? 0 : 0.5) }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.p)
}

/** Chat's session list (allowed folders only), or the fictional one in the browser dev server. Archived chats are left out. */
export async function loadChats(): Promise<SessionSummary[]> {
  const list = isDesktop()
    ? await invokeModule<{ sessions: SessionSummary[] }>('agent-chat', 'listSessions')
    : (await import('@/modules/agent-chat/sample')).sampleSessions
  return list.sessions.filter((s) => !s.archived).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function searchChats(chats: SessionSummary[], query: string): SessionSummary[] {
  const ws = words(query)
  if (!ws.length) return chats
  return chats.filter((c) => matchesAll(`${c.title} ${c.preview} ${c.repo.name} ${c.branch ?? ''}`, ws))
}

/** A table (or other data asset) in the OpenMetadata catalog. */
export interface AssetHit {
  id: string
  type: string
  name: string
  fqn: string
  deleted?: boolean
}

/**
 * Tables and other data assets whose name matches, from the OpenMetadata
 * page's catalog (its backend `search`: the whole catalog, best matches first,
 * not a loaded page). Loaded lazily so the catalog code stays out of the main
 * bundle.
 */
export async function searchAssets(query: string, limit: number): Promise<{ rows: AssetHit[]; total: number }> {
  const [{ call }, { ASSET_TYPES }] = await Promise.all([import('@/modules/openmetadata/api'), import('@/modules/openmetadata/tabs/assets')])
  const res = await call<{ data: { id: string; entityType: string; name?: string; displayName?: string; fullyQualifiedName?: string; deleted?: boolean }[]; total: number }>('search', {
    q: query,
    types: [...ASSET_TYPES],
    limit,
  })
  return {
    rows: res.data.map((e) => ({ id: e.id, type: e.entityType, name: e.displayName || e.name || e.fullyQualifiedName || 'Unnamed', fqn: e.fullyQualifiedName ?? e.name ?? '', deleted: e.deleted })),
    total: res.total,
  }
}

/**
 * Where a result goes. Kept as data so recent results can be stored; it
 * never holds a file path (a chat is named by the id Chat's backend gave it).
 */
export type Target =
  | { kind: 'path'; path: string; anchor?: string }
  | { kind: 'type'; type: string }
  | { kind: 'wiki'; id: string; anchor?: string }
  | { kind: 'chat'; id: string }
  | { kind: 'entity'; type: string; fqn: string }

export interface Recent {
  kind: 'page' | 'setting' | 'type' | 'chat' | 'wiki' | 'asset'
  label: string
  detail: string
  target: Target
}

const RECENT_KEY = 'monorail.search.recent'
const RECENT_MAX = 5

export function readRecents(): Recent[] {
  try {
    const v = JSON.parse(prefs.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? (v as Recent[]).filter((r) => r && typeof r.label === 'string' && r.target).slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function addRecent(r: Recent) {
  const same = (a: Target, b: Target) => JSON.stringify(a) === JSON.stringify(b)
  const next = [r, ...readRecents().filter((x) => !same(x.target, r.target))].slice(0, RECENT_MAX)
  prefs.setItem(RECENT_KEY, JSON.stringify(next))
}

/** True on a Settings page: the palette then opens on the Settings scope. */
export const isSettingsPath = (path: string) => findModuleByPath(path)?.nav.section === SETTINGS_SECTION
