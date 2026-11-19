import { createElement, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { StatTile } from '@/components/charts/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchField } from '@/components/ui/search-field'
import { formatCount, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useCall } from '../api'
import { typeInfo } from '../catalog'
import { CountText, TypeTile } from '../parts'
import { OM_TABS, openInCatalog, openTab } from '../tabs'
import type { OmCounts, OmEntity } from '../types'
import { ago, countOf, displayName } from '../util'
import { ASSET_TYPES, fqnOf, hasDescription, hasOwner, setExploreQuery, useAssets } from './assets'
import { EmptyNote, ErrorNote, Loading } from './assets-parts'
import type { OmTabProps } from './types'

/** Which count each shortcut shows. */
const SHORTCUT_COUNT: Record<string, string[]> = {
  explore: [...ASSET_TYPES],
  glossary: ['glossaryTerm'],
  classifications: ['tag'],
  domains: ['domain', 'dataProduct'],
  quality: ['testCase'],
  services: ['databaseService', 'dashboardService', 'messagingService', 'pipelineService', 'mlmodelService', 'storageService', 'searchService', 'apiService', 'metadataService'],
  teams: ['team', 'user'],
}
const SHORTCUTS = ['explore', 'lineage', 'insights', 'glossary', 'classifications', 'domains', 'quality', 'services', 'teams']

const sum = (counts: OmCounts | undefined, types: string[]) => types.reduce((n, t) => n + (countOf(counts, t).n ?? 0), 0)

/** Where people start: search, the catalog at a glance, what changed lately, and where to go next. */
export default function HomeTab({ counts }: OmTabProps) {
  const [q, setQ] = useState('')
  const assets = useAssets(counts)
  const c = counts.data
  const total = sum(c, [...ASSET_TYPES])
  const rows = assets.data?.assets ?? []
  const share = (n: number) => (rows.length ? formatPercent(n / rows.length) : assets.loading ? '…' : '–')
  const described = rows.filter(hasDescription).length
  const owned = rows.filter(hasOwner).length

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setExploreQuery(q.trim())
          openTab('explore')
        }}
      >
        <SearchField size="lg" aria-label="Search the data assets" placeholder="Search tables, dashboards, pipelines…" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>

      {counts.error && <ErrorNote>Counts: {counts.error}</ErrorNote>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile hero label="Data assets" value={c ? formatCount(total) : '…'} hint={c ? `${ASSET_TYPES.filter((t) => (countOf(c, t).n ?? 0) > 0).length} kinds in use` : 'Counting…'} />
        <StatTile label="Described" value={share(described)} hint={rows.length ? `${formatCount(rows.length - described)} without a description` : undefined} />
        <StatTile label="Owned" value={share(owned)} hint={rows.length ? `${formatCount(rows.length - owned)} without an owner` : undefined} />
        <StatTile label="Glossary terms" value={c ? formatCount(sum(c, ['glossaryTerm'])) : '…'} hint={c ? `${formatCount(sum(c, ['glossary']))} glossaries` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <RecentCard className="xl:col-span-2" />
        <Card>
          <CardHeader>
            <CardTitle>Assets by type</CardTitle>
            <CardDescription>The data assets in the catalog.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => openTab('explore')}>
                Explore <ArrowRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {!c ? (
              counts.error ? <p className="text-sm text-muted-foreground">Counts are not available.</p> : <Loading>Counting…</Loading>
            ) : (
              <ul className="flex flex-col gap-1">
                {ASSET_TYPES.map((t) => {
                  const info = typeInfo(t)
                  if (!info) return null
                  const n = countOf(c, t)
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        title={info.summary}
                        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', (!n.n || n.error) && 'text-muted-foreground')}
                        onClick={() => openInCatalog({ type: t })}
                      >
                        <info.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{info.plural}</span>
                        <CountText counts={c} type={t} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Go to</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SHORTCUTS.map((id) => {
            const tab = OM_TABS.find((t) => t.id === id)
            if (!tab) return null
            const types = SHORTCUT_COUNT[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => openTab(id)}
                className="flex items-start gap-3 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground" aria-hidden>
                  {createElement(tab.icon, { className: 'size-4' })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{tab.label}</span>
                    {types && c && <span className="text-xs text-muted-foreground tabular-nums">{formatCount(sum(c, types))}</span>}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{tab.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function RecentCard({ className }: { className?: string }) {
  const recent = useCall<OmEntity[]>('recent', { size: 12 })
  const items = (recent.data ?? []).filter((e) => typeInfo(e.entityType)).slice(0, 10)
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recently changed</CardTitle>
        <CardDescription>The latest edits across the catalog.</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.error ? (
          <ErrorNote>{recent.error}</ErrorNote>
        ) : !recent.data ? (
          <Loading>Loading…</Loading>
        ) : items.length === 0 ? (
          <EmptyNote title="Nothing yet">Entities show here as they are created or changed.</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((e) => (
              <li key={e.id}>
                <button type="button" className="flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50" onClick={() => openInCatalog({ type: e.entityType, fqn: fqnOf(e) })}>
                  <TypeTile type={e.entityType} className="size-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{displayName(e)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {typeInfo(e.entityType)?.name} · <span className="font-mono">{e.fullyQualifiedName}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="block">{ago(e.updatedAt)}</span>
                    {e.updatedBy && <span className="block truncate">{e.updatedBy}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
