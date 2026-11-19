import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { SearchField } from '@/components/ui/search-field'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import { typeInfo } from '../catalog'
import { displayName, isTier, tierOf } from '../util'
import { clearExploreQuery, peekExploreQuery, serviceOf, tierLabel, useAssets, type Asset } from './assets'
import { AssetRow, EmptyNote, ErrorNote, LoadNotes, Loading } from './assets-parts'
import type { OmTabProps } from './types'

const NONE = '\u0000none'

interface Facet {
  id: string
  label: string
  /** The values an asset has for this facet (NONE when it has none). */
  values: (e: Asset) => string[]
  format?: (v: string) => string
  noneLabel?: string
}

const FACETS: Facet[] = [
  { id: 'type', label: 'Type', values: (e) => [e.assetType], format: (v) => typeInfo(v)?.plural ?? v },
  { id: 'service', label: 'Service', values: (e) => [serviceOf(e) ?? NONE], noneLabel: 'No service' },
  { id: 'owner', label: 'Owner', values: (e) => (e.owners?.length ? e.owners.map((o) => displayName(o)) : [NONE]), noneLabel: 'No owner' },
  { id: 'tier', label: 'Tier', values: (e) => [tierOf(e.tags)?.tagFQN ?? NONE], format: tierLabel, noneLabel: 'No tier' },
  { id: 'tag', label: 'Tag', values: (e) => (e.tags ?? []).filter((t) => !isTier(t)).map((t) => t.tagFQN) },
  { id: 'domain', label: 'Domain', values: (e) => (e.domains?.length ? e.domains.map((d) => displayName(d)) : [NONE]), noneLabel: 'No domain' },
]

type Filters = Record<string, string[]>
type Sort = 'name' | 'updated'
const PAGE = 25

function matchesQuery(e: Asset, q: string) {
  if (!q) return true
  const hay = [e.name, e.displayName, e.fullyQualifiedName, e.description, serviceOf(e), ...(e.owners ?? []).map((o) => displayName(o)), ...(e.tags ?? []).map((t) => t.tagFQN)]
  return q.split(/\s+/).every((word) => hay.some((s) => s?.toLowerCase().includes(word)))
}

const passes = (e: Asset, filters: Filters, skip?: string) =>
  FACETS.every((f) => f.id === skip || !filters[f.id]?.length || f.values(e).some((v) => filters[f.id].includes(v)))

/** Search and filter the data assets, with facets on the left. The assets are listed from the catalog and filtered here. */
export default function ExploreTab({ counts }: OmTabProps) {
  const assets = useAssets(counts)
  const [q, setQ] = useState(() => peekExploreQuery() ?? '')
  useEffect(() => clearExploreQuery(), [])
  const query = useDeferredValue(q.trim().toLowerCase())
  const [filters, setFilters] = useState<Filters>({})
  const [sort, setSort] = useState<Sort>('name')
  const [shown, setShown] = useState(PAGE)

  const rows = assets.data?.assets
  const searched = useMemo(() => (rows ?? []).filter((e) => matchesQuery(e, query)), [rows, query])
  const results = useMemo(() => {
    const r = searched.filter((e) => passes(e, filters))
    return sort === 'name' ? r.sort((a, b) => displayName(a).localeCompare(displayName(b))) : r.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }, [searched, filters, sort])

  const toggle = (facet: string, value: string) => {
    setShown(PAGE)
    setFilters((f) => {
      const cur = f[facet] ?? []
      return { ...f, [facet]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] }
    })
  }
  const active = FACETS.flatMap((f) => (filters[f.id] ?? []).map((v) => ({ f, v })))

  if (counts.error && !counts.data) return <ErrorNote>{counts.error}</ErrorNote>
  if (!rows) return <Loading>Reading the data assets…</Loading>
  if (!rows.length)
    return (
      <div className="flex flex-col gap-4">
        {assets.data && <LoadNotes load={assets.data} />}
        <EmptyNote title="No data assets yet">Tables, dashboards, pipelines and the rest arrive through ingestion. Once there are some, search and filter them here.</EmptyNote>
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          className="min-w-0 flex-1"
          aria-label="Search the data assets"
          placeholder="Search by name, description, owner, tag or service…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setShown(PAGE)
          }}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="om-explore-sort" className="text-xs text-muted-foreground">
            Sort
          </Label>
          <NativeSelect id="om-explore-sort" className="w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">Name</option>
            <option value="updated">Last updated</option>
          </NativeSelect>
        </div>
      </div>
      {assets.data && <LoadNotes load={assets.data} />}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="gap-0 py-2">
          {FACETS.map((f) => (
            <FacetGroup key={f.id} facet={f} rows={searched.filter((e) => passes(e, filters, f.id))} selected={filters[f.id] ?? []} onToggle={(v) => toggle(f.id, v)} />
          ))}
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {formatCount(results.length)} {results.length === 1 ? 'result' : 'results'}
              {query ? ` for “${q.trim()}”` : ''}
            </span>
            {active.map(({ f, v }) => (
              <Button key={`${f.id}:${v}`} variant="secondary" size="sm" className="h-7" onClick={() => toggle(f.id, v)}>
                {f.label}: {v === NONE ? f.noneLabel : (f.format?.(v) ?? v)}
                <X />
              </Button>
            ))}
            {active.length > 0 && (
              <Button variant="link" size="sm" className="h-7" onClick={() => setFilters({})}>
                Clear filters
              </Button>
            )}
          </div>
          {results.length === 0 ? (
            <EmptyNote title="Nothing matches">Try fewer words, or clear the filters.</EmptyNote>
          ) : (
            <Card className="gap-0 py-2">
              <CardContent className="px-2">
                <ul className="flex flex-col divide-y">
                  {results.slice(0, shown).map((e) => (
                    <AssetRow key={`${e.assetType}:${e.id}`} e={e} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {results.length > shown && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCount(shown)} of {formatCount(results.length)} shown
              </span>
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** One facet: its values with how many results each would give, most first. */
function FacetGroup({ facet, rows, selected, onToggle }: { facet: Facet; rows: Asset[]; selected: string[]; onToggle: (v: string) => void }) {
  const [all, setAll] = useState(false)
  const values = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of rows) for (const v of new Set(facet.values(e))) m.set(v, (m.get(v) ?? 0) + 1)
    for (const v of selected) if (!m.has(v)) m.set(v, 0)
    // "None" goes last; the rest by count, then name.
    return [...m].sort(([a, x], [b, y]) => Number(a === NONE) - Number(b === NONE) || y - x || a.localeCompare(b))
  }, [rows, facet, selected])
  // A facet nobody uses (only "none") says nothing; leave it out.
  if (!values.length || (values.length === 1 && values[0][0] === NONE && !selected.length)) return null
  const visible = all ? values : values.slice(0, 6)
  return (
    <section className="flex flex-col gap-1 border-b px-3 py-3 last:border-0" aria-label={facet.label}>
      <h3 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{facet.label}</h3>
      <ul className="flex flex-col">
        {visible.map(([v, n]) => {
          const on = selected.includes(v)
          return (
            <li key={v}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(v)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted', on && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft', !n && !on && 'text-muted-foreground')}
              >
                <span className={cn('flex size-4 shrink-0 items-center justify-center rounded border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input')} aria-hidden>
                  {on && <Check className="size-3" />}
                </span>
                <span className={cn('min-w-0 flex-1 truncate', v === NONE && 'italic')}>{v === NONE ? facet.noneLabel : (facet.format?.(v) ?? v)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatCount(n)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {values.length > 6 && (
        <Button variant="link" size="sm" className="h-6 w-fit px-2 text-xs" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${values.length}`}
        </Button>
      )}
    </section>
  )
}
