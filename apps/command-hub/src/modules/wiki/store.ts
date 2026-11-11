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

/**
 * Which pages the wiki lists: written for people, for agents, or all. Kept in
 * localStorage; people see the plain-language guides first.
 */
export type AudienceFilter = 'human' | 'ai' | 'all'
const AUDIENCE_KEY = 'commandHub.wiki.audience'
let audience: AudienceFilter = readAudience()
const audienceListeners = new Set<() => void>()

function readAudience(): AudienceFilter {
  try {
    const v = localStorage.getItem(AUDIENCE_KEY)
    return v === 'ai' || v === 'all' ? v : 'human'
  } catch {
    return 'human'
  }
}

export function setWikiAudience(next: AudienceFilter) {
  audience = next
  try {
    localStorage.setItem(AUDIENCE_KEY, next)
  } catch {
    /* storage unavailable */
  }
  for (const l of audienceListeners) l()
}

export function useWikiAudience() {
  return useSyncExternalStore(
    (cb) => {
      audienceListeners.add(cb)
      return () => audienceListeners.delete(cb)
    },
    () => audience,
  )
}
