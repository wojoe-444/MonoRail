import { useSyncExternalStore } from 'react'
import { prefs } from '@/lib/prefs'
import type { KindResult, ParsedQuery, SearchKind } from './types'

/** Result tabs, in order. History (the pickaxe) walks every diff, so it runs only when its tab is open. */
export const KINDS: { kind: SearchKind; label: string }[] = [
  { kind: 'code', label: 'Code' },
  { kind: 'files', label: 'Files' },
  { kind: 'commits', label: 'Commits' },
  { kind: 'history', label: 'Changes' },
  { kind: 'issues', label: 'Issues' },
]
export const EAGER_KINDS: SearchKind[] = ['code', 'files', 'commits', 'issues']
export const isKind = (v: string | null): v is SearchKind => KINDS.some((k) => k.kind === v)

export const ok = <T extends object>(r: KindResult<T> | undefined): T | null => (r && !('error' in r) ? (r as T) : null)
export const errorOf = (r: KindResult<object> | undefined): string | null => (r && 'error' in r ? (r as { error: string }).error : null)

/**
 * A RegExp that finds what the search matched, for highlighting lines in the
 * page. Approximates git's matching (git's ERE and JS regexes mostly agree);
 * null when it can't be built, and then nothing is highlighted.
 */
export function highlighter(q: ParsedQuery | null): RegExp | null {
  if (!q) return null
  let src: string
  if (q.def) src = q.def.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  else if (!q.text) return null
  else if (q.regex) src = q.text.replace(/\[\[:space:\]\]/g, '\\s').replace(/\[\[:alnum:\]\]/g, '[A-Za-z0-9]')
  else src = q.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (q.word || q.def) src = `\\b(?:${src})\\b`
  try {
    const re = new RegExp(src, q.caseSensitive || q.def ? 'g' : 'gi')
    return re.test('') ? null : re
  } catch {
    return null
  }
}

/** Splits text into plain and matched pieces. */
export function marks(text: string, re: RegExp | null): { t: string; m: boolean }[] {
  if (!re) return [{ t: text, m: false }]
  const out: { t: string; m: boolean }[] = []
  let at = 0
  re.lastIndex = 0
  for (const m of text.matchAll(re)) {
    if (!m[0]) continue
    const i = m.index ?? 0
    if (i > at) out.push({ t: text.slice(at, i), m: false })
    out.push({ t: m[0], m: true })
    at = i + m[0].length
  }
  if (at < text.length) out.push({ t: text.slice(at), m: false })
  return out.length ? out : [{ t: text, m: false }]
}

// Saved searches: per person (prefs), raw query text only.
const SAVED_KEY = 'commandHub.githubPlus.savedSearches'
const MAX_SAVED = 8
const listeners = new Set<() => void>()
let cache: string[] | null = null

function read(): string[] {
  if (cache) return cache
  try {
    const v = JSON.parse(prefs.getItem(SAVED_KEY) ?? '[]')
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_SAVED) : []
  } catch {
    cache = []
  }
  return cache
}

function write(list: string[]): void {
  cache = list.slice(0, MAX_SAVED)
  prefs.setItem(SAVED_KEY, JSON.stringify(cache))
  for (const l of listeners) l()
}

export const savedSearches = {
  list: read,
  has: (q: string) => read().includes(q.trim()),
  /** False when the list is full. */
  add(q: string): boolean {
    const t = q.trim()
    if (!t || read().includes(t)) return true
    if (read().length >= MAX_SAVED) return false
    write([...read(), t])
    return true
  },
  remove: (q: string) => write(read().filter((x) => x !== q.trim())),
  max: MAX_SAVED,
}

export function useSavedSearches(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
  )
}

/** The syntax, for the tips panel. */
export const TIPS: [string, string][] = [
  ['createNote', 'Text, anywhere in a line (not case-sensitive unless Aa is on)'],
  ['"two words"', 'An exact phrase'],
  ['/fetch(All)?Notes/', 'A regular expression'],
  ['path:src/apps', 'Only files whose path contains this; path:*.test.ts takes wildcards'],
  ['-path:node_modules', 'Leave these paths out'],
  ['lang:ts', 'Only TypeScript files (also js, py, cs, go, rs, md, sql, ...)'],
  ['ref:main', 'Search a branch, tag or commit instead of the working folder'],
  ['ref:main,feature/x', 'Search several at once and see where each match is'],
  ['ref:working', 'The working folder: uncommitted edits and new files'],
  ['def:formatDate', 'Where something is defined (function, class, const, def, fn, ...)'],
  ['author:ann', 'Commits and changes by someone'],
  ['after:2026-01-01 before:2026-06-30', 'Commits and changes in a date range'],
  ['is:open', 'Open (or closed) issues only'],
  ['repo:orbit', 'In All repositories: only repos whose name contains this'],
]
