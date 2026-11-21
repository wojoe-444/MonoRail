import { prefs } from '@/lib/prefs'
import { invokeModule, isDesktop } from '@/modules/client'
import type { SessionSummary } from '@/modules/agent-chat/types'
import { pages as wikiPages, type WikiPage } from '@/modules/wiki/index-data'
import { CATEGORIES, ENTITY_TYPES, SECTIONS, category, type EntityType } from '@/standard'

import { matchesAll, rank, words } from './matching'

/**
 * What the command palette looks through. Every source
 * reads what MonoRail already has in memory or on demand; nothing is cached
 * to disk, and only the last few opened results are kept, in `prefs`.
 */

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

export function searchWiki(query: string): WikiPage[] {
  const ws = words(query)
  if (!ws.length) return wikiPages.filter((p) => p.id.startsWith('guide/')).sort((a, b) => a.title.localeCompare(b.title))
  return wikiPages
    .filter((p) => matchesAll(`${p.title} ${p.summary} ${p.id}`, ws))
    .map((p) => ({ p, score: rank(p.title, ws) + (p.audience.includes('human') ? 0 : 0.5) }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.p)
}

/** Chat's session list (allowed folders only), or the fictional one in the browser dev server. Archived chats are left out. */
export async function loadChats(): Promise<SessionSummary[]> {
  const list = isDesktop()
    ? await invokeModule('agent-chat', 'listSessions')
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
  const res = await call('search', {
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
