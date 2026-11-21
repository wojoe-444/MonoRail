import { useEffect, useState } from 'react'

import { call, errorText, useDataVersion, type CallState } from '../api'
import { typeInfo } from '../catalog'
import type { OmCounts, OmEntity, OmRef } from '../types'
import { countOf, tierOf } from '../util'

/**
 * The data assets the Explore, Lineage and Insights tabs work over: the types
 * OpenMetadata's search calls data assets. There is no search method, so they
 * are listed type by type (`list`, a page of 100 at a time, at most
 * PER_TYPE_CAP each) and filtered in the page. Kept in memory per counts
 * answer, so the three tabs share one load and the page's Refresh starts over.
 */
export const ASSET_TYPES = [
  'table',
  'dashboard',
  'chart',
  'pipeline',
  'topic',
  'mlmodel',
  'container',
  'searchIndex',
  'storedProcedure',
  'dashboardDataModel',
  'apiEndpoint',
  'metric',
] as const

/** At most this many entities of one type are read; the tabs say when a type was cut. */
export const PER_TYPE_CAP = 500
const PAGE = 100

export interface Asset extends OmEntity {
  /** The entity type it was listed under. */
  assetType: string
}

export interface AssetLoad {
  assets: Asset[]
  /** Types that could not be listed, with the reason. */
  errors: { type: string; error: string }[]
  /** Types with more entities than were read. */
  truncated: { type: string; total: number }[]
}

export interface AssetsState {
  data: AssetLoad | undefined
  loading: boolean
  /** Types with at least one entity, in ASSET_TYPES order. */
  types: string[]
}

const cache = new WeakMap<OmCounts, Promise<AssetLoad>>()

async function listType(type: string, total: number): Promise<{ rows: Asset[]; truncated: boolean }> {
  const rows: Asset[] = []
  let after: string | undefined
  do {
    const page = await call('list', { type, limit: PAGE, ...(after ? { after } : {}) })
    for (const e of page.data) rows.push({ ...e, assetType: type })
    after = page.paging?.after
  } while (after && rows.length < PER_TYPE_CAP)
  return { rows: rows.slice(0, PER_TYPE_CAP), truncated: !!after || total > PER_TYPE_CAP }
}

function load(counts: OmCounts): Promise<AssetLoad> {
  const hit = cache.get(counts)
  if (hit) return hit
  const types = assetTypesIn(counts)
  const p = Promise.all(
    types.map((type) => {
      const total = countOf(counts, type).n ?? 0
      return listType(type, total).then(
        (r) => ({ type, total, ...r }),
        (e: unknown) => ({ type, total, rows: [] as Asset[], truncated: false, error: errorText(e) }),
      )
    }),
  ).then((parts) => ({
    assets: parts.flatMap((p) => p.rows),
    errors: parts.flatMap((p) => ('error' in p && p.error ? [{ type: p.type, error: p.error }] : [])),
    truncated: parts.filter((p) => p.truncated).map((p) => ({ type: p.type, total: p.total })),
  }))
  cache.set(counts, p)
  return p
}

/** The asset types the catalog has at least one of. */
export function assetTypesIn(counts: OmCounts | undefined): string[] {
  return ASSET_TYPES.filter((t) => typeInfo(t) && (countOf(counts, t).n ?? 0) > 0)
}

/** Every data asset in the catalog (capped per type), once the counts are in. */
export function useAssets(counts: CallState<OmCounts>): AssetsState {
  const ready = !counts.loading ? counts.data : undefined
  const [state, setState] = useState<{ of?: OmCounts; data?: AssetLoad }>({})
  useEffect(() => {
    if (!ready) return
    let live = true
    void load(ready).then((data) => live && setState({ of: ready, data }))
    return () => {
      live = false
    }
  }, [ready])
  const data = ready && state.of === ready ? state.data : undefined
  return { data, loading: !data && !counts.error, types: assetTypesIn(counts.data) }
}

/** The service an asset belongs to: its `service` reference, or the first part of its full name. */
export function serviceOf(e: OmEntity): string | undefined {
  const s = e.service as OmRef | undefined
  return s?.name || s?.fullyQualifiedName || e.fullyQualifiedName?.split('.')[0] || undefined
}

export const hasDescription = (e: OmEntity) => !!e.description?.trim()
export const hasOwner = (e: OmEntity) => !!e.owners?.length
export const hasTier = (e: OmEntity) => !!tierOf(e.tags)
export const hasTags = (e: OmEntity) => !!e.tags?.some((t) => !t.tagFQN.startsWith('Tier.'))

/** "Tier.Tier1" -> "Tier 1". */
export const tierLabel = (fqn: string) => fqn.replace(/^Tier\.Tier(\d+)$/, 'Tier $1').replace(/^Tier\./, '')

/** The asset's full name, used as `fqn` when opening it in the Catalog tab. */
export const fqnOf = (e: { fullyQualifiedName?: string; name?: string }) => e.fullyQualifiedName ?? e.name ?? ''

let pendingQuery: string | undefined
/** Hand a search to the Explore tab (Home's search box). In memory only. */
export function setExploreQuery(q: string) {
  pendingQuery = q
}
/** The Explore tab's side: the search Home handed over. Read it on mount, then clear it. */
export const peekExploreQuery = (): string | undefined => pendingQuery
export function clearExploreQuery() {
  pendingQuery = undefined
}

/** The most matches one search brings back (the backend's limit too). */
export const SEARCH_LIMIT = 500

export interface AssetSearch {
  /** The best matches, best first; undefined until the first answer. */
  rows: Asset[] | undefined
  /** How many entities matched in the whole catalog (may be more than `rows`). */
  total: number
  /** A newer search is on its way; `rows` still shows the last answer. */
  loading: boolean
  error: string | undefined
}

/**
 * Search the whole catalog (the backend's `search`: SQL over every entity on
 * this PC, or the server's search index), not a capped load. Waits for typing
 * to pause, and keeps the last answer on screen while the next one loads.
 * `types` null: wait (counts not in yet); an empty list finds nothing.
 */
export function useAssetSearch(q: string, types: string[] | null, { limit = SEARCH_LIMIT, deleted = false, delayMs = 200 } = {}): AssetSearch {
  const text = q.trim()
  const key = types === null ? null : JSON.stringify({ q: text, types, limit, deleted })
  const version = useDataVersion()
  const [state, setState] = useState<{ key?: string; version?: number; rows?: Asset[]; total: number; error?: string }>({ total: 0 })
  useEffect(() => {
    if (key === null) return
    const args = JSON.parse(key) as { q: string; types: string[]; limit: number; deleted: boolean }
    if (!args.types.length) {
      setState({ key, version, rows: [], total: 0 })
      return
    }
    let live = true
    const t = setTimeout(
      () => {
        call('search', args).then(
          (res) => live && setState({ key, version, rows: res.data.map((e) => ({ ...e, assetType: e.entityType })), total: res.total }),
          (e: unknown) => live && setState((s) => ({ ...s, key, version, error: errorText(e) })),
        )
      },
      // The first search and a refresh go at once; typing waits for a pause.
      state.rows === undefined || state.key === key ? 0 : delayMs,
    )
    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, delayMs])
  return { rows: state.rows, total: state.total, loading: key !== null && (state.key !== key || state.version !== version), error: state.key === key ? state.error : undefined }
}
