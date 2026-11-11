import { useSyncExternalStore } from 'react'

import { navigate } from '@/lib/router'

/**
 * Which wiki page is open. Kept outside the route (module routes are exact
 * paths) and in sessionStorage, so the wiki reopens where it was left.
 */
const KEY = 'commandHub.wiki.page'
let current: { id: string; anchor?: string } | undefined = read()
const listeners = new Set<() => void>()

function read() {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as { id: string }) : undefined
  } catch {
    return undefined
  }
}

function set(next: { id: string; anchor?: string } | undefined) {
  current = next
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify({ id: next.id }))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: still works for this session */
  }
  for (const l of listeners) l()
}

export function useWikiLocation() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** Show a wiki page (undefined: the wiki's home), optionally at a heading. */
export function showWikiPage(id: string | undefined, anchor?: string) {
  set(id ? { id, anchor } : undefined)
}

/** Open the wiki at a page from anywhere in the hub, e.g. openWiki('extensions/manifest', 'settings'). */
export function openWiki(id?: string, anchor?: string) {
  showWikiPage(id, anchor)
  navigate('/wiki')
}
