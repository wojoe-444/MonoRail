import { useSyncExternalStore } from 'react'

/**
 * Whether the command palette (global search) is open, and how it opened.
 * One shared store so Ctrl+K, the top bar's search field and any page can
 * open it. Nothing here is stored on disk.
 */
export type SearchScope = 'all' | 'pages' | 'catalog' | 'chats' | 'settings' | 'wiki'

export const SCOPES: { id: SearchScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pages', label: 'Pages' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'chats', label: 'Chats' },
  { id: 'settings', label: 'Settings' },
  { id: 'wiki', label: 'Wiki' },
]

export interface SearchState {
  open: boolean
  scope: SearchScope
  /** A standard section id the catalog is narrowed to (browsing from a section tile). */
  section?: string
  /** Text to start with. */
  query: string
  /** Bumped on every open, so the palette resets its own state. */
  openId: number
}

let state: SearchState = { open: false, scope: 'all', query: '', openId: 0 }
const listeners = new Set<() => void>()

function set(next: SearchState) {
  state = next
  for (const l of listeners) l()
}

/** Open the command palette, optionally on one scope or with text already typed. */
export function openSearch(opts: { scope?: SearchScope; section?: string; query?: string } = {}) {
  set({ open: true, scope: opts.scope ?? 'all', section: opts.section, query: opts.query ?? '', openId: state.openId + 1 })
}

export function closeSearch() {
  if (state.open) set({ ...state, open: false })
}

export function useSearchState(): SearchState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
