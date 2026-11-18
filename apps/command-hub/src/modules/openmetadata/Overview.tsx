import { Loader2 } from 'lucide-react'

import { StatTile } from '@/components/charts/StatTile'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useCall } from './api'
import { GROUPS, TYPES, typeInfo, type TypeInfo } from './catalog'
import { CountText, TypeTile } from './parts'
import { ago, countOf, displayName, type View } from './util'
import type { OmCounts, OmEntity, OmStatus } from './types'

/** The landing view: how much of each kind there is, the server, and what changed lately. */
export function Overview({ status, counts, countsError, onOpen }: { status: OmStatus; counts?: OmCounts; countsError?: string; onOpen: (v: View) => void }) {
  const tile = (label: string, types: TypeInfo[], hero?: boolean) => {
    const known = types.map((x) => countOf(counts, x.type))
    const total = known.reduce((n, c) => n + (c.n ?? 0), 0)
    const inUse = known.filter((c) => (c.n ?? 0) > 0).length
    return <StatTile label={label} value={counts ? formatCount(total) : '…'} hint={counts ? `${inUse} of ${types.length} types in use` : 'Counting…'} hero={hero} />
  }
  return (
    <div className="flex flex-col gap-6">
      {countsError && <p role="alert" className="rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-foreground">Counts: {countsError}</p>}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {tile('Entities', TYPES, true)}
        {GROUPS.filter((g) => ['assets', 'services', 'governance'].includes(g.id)).map((g) => (
          <div key={g.id}>{tile(g.name, g.types)}</div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Server</CardTitle>
            <CardDescription>Where these entities come from.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <Badge variant="success">Connected</Badge>
            </div>
            <dl className="flex flex-col gap-2">
              {([['Server', status.url], ['Version', status.version ? `OpenMetadata ${status.version}` : undefined], ['Signed in as', status.user]] as const).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="truncate text-sm" title={v}>
                    {v ?? '–'}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <RecentCard onOpen={onOpen} className="xl:col-span-2" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <CardTitle>{g.name}</CardTitle>
              <CardDescription>{g.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {g.types.map((x) => {
                  const c = countOf(counts, x.type)
                  return (
                    <li key={x.type}>
                      <button
                        type="button"
                        title={c.error ? `Not on this server: ${c.error}` : x.summary}
                        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', (c.n === 0 || c.error) && 'text-muted-foreground')}
                        onClick={() => onOpen({ type: x.type })}
                      >
                        <x.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{x.plural}</span>
                        <CountText counts={counts} type={x.type} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function RecentCard({ onOpen, className }: { onOpen: (v: View) => void; className?: string }) {
  const recent = useCall<OmEntity[]>('recent', {})
  const items = (recent.data ?? []).filter((e) => typeInfo(e.entityType)).slice(0, 8)
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recently changed</CardTitle>
        <CardDescription>The latest edits across every searchable type.</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.error ? (
          <p className="text-sm text-muted-foreground">{recent.error}</p>
        ) : !recent.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Entities show here as they are created or changed.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-3 rounded-md py-2 text-left hover:bg-muted/50"
                  onClick={() => onOpen({ type: e.entityType, fqn: e.fullyQualifiedName ?? e.name })}
                >
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
