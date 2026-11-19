import { useCallback, useEffect, useMemo, useState } from 'react'

import { parseMalloy, type MalloyModel } from './malloy'
import { malloyCall, type MalloyCompiled, type MalloyStatus, type OutlineField, type OutlineSource } from './malloyClient'
import type { MalloyListing } from './malloyTypes'

/**
 * Every Malloy model file in the connection's folder, compiled by the real
 * Malloy compiler (at most three files at a time), and the sources they
 * define. A source imported into several files is listed once, under its own
 * file. The last answer is kept in memory so switching tabs paints at once.
 */

export interface MalloySourceEntry {
  /** `path:name`, unique across the folder. */
  key: string
  /** The model file to compile and run it from (its own file when known). */
  path: string
  source: OutlineSource
  /** The other sources the same compile saw (to resolve joins). */
  siblings: OutlineSource[]
}

export interface MalloyModelsState {
  status?: MalloyStatus
  listing?: MalloyListing
  /** Compile answers by file path; missing while that file compiles. */
  compiled: Record<string, MalloyCompiled>
  /** The tolerant reader's view of each file (for definition text). */
  parsed: MalloyModel[]
  sources: MalloySourceEntry[]
  error?: string
  /** Status and listing are still loading. */
  loading: boolean
  /** Files still compiling. */
  compiling: number
  reload: () => void
}

interface Raw {
  status?: MalloyStatus
  listing?: MalloyListing
  compiled: Record<string, MalloyCompiled>
  error?: string
}

let cache: Raw | undefined

async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0
  const lane = async () => {
    while (next < items.length) await work(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}

export function useMalloyModels(): MalloyModelsState {
  const [raw, setRaw] = useState<Raw>(() => cache ?? { compiled: {} })
  const [loading, setLoading] = useState(!cache)
  const [compiling, setCompiling] = useState(0)
  const [run, setRun] = useState(0)

  useEffect(() => {
    let live = true
    const update = (f: (r: Raw) => Raw) => {
      if (!live) return
      setRaw((r) => {
        const n = f(r)
        cache = n
        return n
      })
    }
    void (async () => {
      setLoading(true)
      try {
        const [status, listing] = await Promise.all([malloyCall('status'), malloyCall('listModels')])
        update((r) => ({ ...r, status, listing, error: undefined }))
        if (!live) return
        setLoading(false)
        if (status.block || listing.block) return
        const paths = listing.files.filter((f) => !f.tooLarge).map((f) => f.path)
        // Drop answers for files that are gone.
        update((r) => ({ ...r, compiled: Object.fromEntries(Object.entries(r.compiled).filter(([p]) => paths.includes(p))) }))
        setCompiling(paths.length)
        await pool(paths, 3, async (path) => {
          if (!live) return
          let answer: MalloyCompiled
          try {
            answer = await malloyCall('compile', { path })
          } catch (e) {
            answer = { ok: false, sources: [], queries: [], problems: [{ message: e instanceof Error ? e.message : String(e), severity: 'error', file: path }] }
          }
          update((r) => ({ ...r, compiled: { ...r.compiled, [path]: answer } }))
          if (live) setCompiling((n) => n - 1)
        })
      } catch (e) {
        update((r) => ({ ...r, error: e instanceof Error ? e.message : String(e) }))
        if (live) setLoading(false)
      }
    })()
    return () => {
      live = false
    }
  }, [run])

  const parsed = useMemo(() => (raw.listing?.files ?? []).filter((f) => f.text !== undefined).map((f) => parseMalloy(f.path, f.text!)), [raw.listing])

  const sources = useMemo(() => {
    const out = new Map<string, MalloySourceEntry>()
    const paths = (raw.listing?.files ?? []).map((f) => f.path)
    for (const path of paths) {
      const c = raw.compiled[path]
      if (!c) continue
      for (const s of c.sources) {
        const own = s.file && paths.includes(s.file) ? s.file : path
        const key = `${own}:${s.name}`
        // Prefer what the source's own file's compile says about it.
        if (out.has(key) && own !== path) continue
        out.set(key, { key, path: own, source: s, siblings: c.sources })
      }
    }
    return [...out.values()].sort((a, b) => a.source.name.localeCompare(b.source.name))
  }, [raw.compiled, raw.listing])

  const reload = useCallback(() => setRun((n) => n + 1), [])
  return { ...raw, parsed, sources, loading: loading && !raw.listing, compiling, reload }
}

/** The fields a join brings: its own outline, else the joined source's from the same compile. */
export function joinFields(join: OutlineField, siblings: OutlineSource[]): OutlineField[] {
  if (join.fields?.length) return join.fields
  return siblings.find((s) => s.name === (join.source ?? join.name))?.fields ?? []
}

export const countKinds = (fields: OutlineField[]) => ({
  dimension: fields.filter((f) => f.kind === 'dimension').length,
  measure: fields.filter((f) => f.kind === 'measure').length,
  view: fields.filter((f) => f.kind === 'view').length,
  join: fields.filter((f) => f.kind === 'join').length,
})

/** The shared blocked card's reason for a status or listing block. */
export function blockedReason(block: MalloyStatus['block'] | MalloyListing['block']): 'not-set-up' | 'no-folder' | undefined {
  if (!block) return undefined
  return block === 'not-set-up' ? 'not-set-up' : 'no-folder'
}
