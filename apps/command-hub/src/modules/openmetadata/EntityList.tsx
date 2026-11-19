import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { SearchField } from '@/components/ui/search-field'
import { Switch } from '@/components/ui/switch'

import { call, errorText, useCall, useDataVersion } from './api'
import { typeInfo } from './catalog'
import { Owners, Tags, TypeTile } from './parts'
import { ago, displayName, type View } from './util'
import { useAssetSearch } from './tabs/assets'
import type { OmEntity, OmPage } from './types'

/** Every entity of one type, a page at a time, as OpenMetadata lists them. */
export function EntityList({ type, total, onOpen }: { type: string; total?: number | { error: string }; onOpen: (v: View) => void }) {
  const info = typeInfo(type)
  const [deleted, setDeleted] = useState(false)
  const first = useCall<OmPage>('list', { type, deleted })
  const [more, setMore] = useState<{ key: string; rows: OmEntity[]; after?: string }>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string>()
  const [filter, setFilter] = useState('')

  // Pages loaded with "Load more" are dropped when the data changes (a sync finished).
  const key = `${deleted}|${useDataVersion()}`
  const extra = more?.key === key ? more : undefined
  const rows = [...(first.data?.data ?? []), ...(extra?.rows ?? [])]
  const after = extra ? extra.after : first.data?.paging?.after
  const count = first.data?.paging?.total ?? (typeof total === 'number' ? total : undefined)
  // A filter searches every entity of the type in the backend, not just the loaded pages.
  const f = filter.trim()
  const types = useMemo(() => [type], [type])
  const search = useAssetSearch(f, f ? types : null, { limit: 100, deleted })
  const searching = !!f
  const shown = searching ? (search.rows ?? []) : rows
  const hasOwners = rows.some((e) => 'owners' in e)
  const hasTags = rows.some((e) => 'tags' in e)

  async function loadMore() {
    setLoadingMore(true)
    setMoreError(undefined)
    try {
      const page = await call<OmPage>('list', { type, deleted, after })
      setMore({ key, rows: [...(extra?.rows ?? []), ...page.data], after: page.paging?.after })
    } catch (e) {
      setMoreError(errorText(e))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeTile type={type} className="size-7" />
          {info?.plural ?? type}
          {count !== undefined && (
            <Badge variant="secondary" className="tabular-nums">
              {count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{info?.summary}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Switch id="om-deleted" checked={deleted} onCheckedChange={setDeleted} />
          <Label htmlFor="om-deleted" className="text-xs font-normal text-muted-foreground">
            Include deleted
          </Label>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length > 0 && (
          <SearchField
            className="max-w-sm"
            size="sm"
            aria-label={`Filter ${info?.plural.toLowerCase() ?? 'entities'} by name`}
            placeholder="Search by name"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        {!first.data ? (
          first.error ? (
            <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">
              {first.error}
            </p>
          ) : (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading {info?.plural.toLowerCase()}…
            </p>
          )
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <TypeTile type={type} />
            <p className="text-sm font-medium">No {info?.plural.toLowerCase() ?? 'entities'}</p>
            <p className="max-w-md text-sm text-muted-foreground">This server has none yet. They arrive through ingestion, the API, or OpenMetadata&apos;s own tools.</p>
          </div>
        ) : searching && !search.rows ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </p>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{search.error ?? 'No names match.'}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {shown.map((e) => {
              const fqn = e.fullyQualifiedName ?? e.name
              return (
                <li key={e.id}>
                  <button type="button" className="grid w-full grid-cols-1 items-center gap-x-6 gap-y-1 rounded-md px-2 py-3 text-left hover:bg-muted/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" onClick={() => onOpen({ type, fqn })}>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{displayName(e)}</span>
                        {e.deleted && <Badge variant="outline">Deleted</Badge>}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">{fqn}</span>
                    </span>
                    <span className="hidden min-w-0 md:block">{hasOwners && <Owners owners={e.owners} empty="–" />}</span>
                    <span className="hidden min-w-0 md:block">{hasTags && <Tags tags={e.tags} empty="–" />}</span>
                    <span className="text-xs text-muted-foreground md:text-right">
                      {ago(e.updatedAt)}
                      {e.updatedBy && <span className="block">{e.updatedBy}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {searching && search.total > shown.length && (
          <p className="text-xs text-muted-foreground tabular-nums">
            The best {shown.length} of {search.total} matches. Type more of the name to narrow it down.
          </p>
        )}
        {moreError && <p role="alert" className="text-sm text-destructive">{moreError}</p>}
        {after && !searching && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground tabular-nums">
              {rows.length} of {count ?? '?'} loaded
            </span>
            <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore && <Loader2 className="animate-spin" />} Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
