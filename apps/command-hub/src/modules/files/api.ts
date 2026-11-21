import { useSyncExternalStore } from 'react'

import { prefs } from '@/lib/prefs'
import { moduleClient } from '@/modules/client'

import { sampleInvoke } from './sample'
import type { TagColor } from './types'

/** Call the Files backend; in the browser dev server, the fictional sample. */
export const call = moduleClient('files', sampleInvoke)

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

// Thumbnails: Windows shell thumbnails, kept in memory for this session only.
const thumbs = new Map<string, Promise<string | null>>()
let running = 0
const waiting: (() => void)[] = []
export function thumbnail(path: string, modified: number, size = 160): Promise<string | null> {
  const key = `${path}|${modified}|${size}`
  let p = thumbs.get(key)
  if (!p) {
    p = new Promise<void>((go) => (running < 4 ? (running++, go()) : waiting.push(() => (running++, go()))))
      .then(() => call('thumbnail', { path, size }))
      .catch(() => null)
      .finally(() => {
        running--
        waiting.shift()?.()
      })
    thumbs.set(key, p)
    if (thumbs.size > 600) thumbs.delete(thumbs.keys().next().value as string)
  }
  return p
}

/**
 * A small per-person store kept in prefs (src/lib/prefs.ts): pinned folders,
 * recent folders, tags, view choices. Subscribable so every pane re-renders.
 */
function prefStore<T>(key: string, fallback: T, check: (v: unknown) => boolean) {
  let value: T = fallback
  try {
    const raw = prefs.getItem(key)
    const parsed = raw ? JSON.parse(raw) : undefined
    if (parsed !== undefined && check(parsed)) value = parsed as T
  } catch {
    /* keep the default */
  }
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set(next: T | ((v: T) => T)) {
      value = typeof next === 'function' ? (next as (v: T) => T)(value) : next
      prefs.setItem(key, JSON.stringify(value))
      subs.forEach((f) => f())
    },
    subscribe(f: () => void) {
      subs.add(f)
      return () => subs.delete(f)
    },
  }
}

type Store<T> = ReturnType<typeof prefStore<T>>
export function usePref<T>(store: Store<T>): [T, Store<T>['set']] {
  return [useSyncExternalStore(store.subscribe, store.get), store.set]
}

const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string')
const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

export const pinnedStore = prefStore<string[]>('monorail.files.pinned', [], isStrings)
export const recentStore = prefStore<string[]>('monorail.files.recent', [], isStrings)
export const tagsStore = prefStore<Record<string, TagColor>>(
  'monorail.files.tags',
  {},
  (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((c) => TAG_COLORS.includes(c as string)),
)
export const optionsStore = prefStore<{ view: 'details' | 'grid' | 'columns'; sortKey: 'name' | 'modified' | 'size' | 'type'; sortDir: 'asc' | 'desc'; showHidden: boolean; preview: boolean; foldersFirst: boolean }>(
  'monorail.files.options',
  { view: 'details', sortKey: 'name', sortDir: 'asc', showHidden: false, preview: true, foldersFirst: true },
  (v) => !!v && typeof v === 'object',
)
export const tabsStore = prefStore<{ tabs: { id: string; panes: string[] }[]; active: number }>('monorail.files.tabs', { tabs: [], active: 0 }, (v) => !!v && typeof v === 'object' && Array.isArray((v as { tabs?: unknown }).tabs))

/** Remember a folder in the recent list (newest first, 12 kept). */
export function rememberRecent(path: string) {
  recentStore.set((r) => [path, ...r.filter((x) => x.toLowerCase() !== path.toLowerCase())].slice(0, 12))
}
