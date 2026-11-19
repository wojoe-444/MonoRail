import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

import { typeInfo } from '../catalog'
import { Owners, Tags, TypeTile } from '../parts'
import { openInCatalog } from '../tabs'
import { ago, displayName, tierOf } from '../util'
import { PER_TYPE_CAP, fqnOf, serviceOf, tierLabel, type Asset, type AssetLoad } from './assets'

/** A spinner line for a list that is still loading. */
export function Loading({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {children}
    </p>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive-soft p-4 text-sm text-destructive-soft-foreground">
      {children}
    </p>
  )
}

export function EmptyNote({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center', className)}>
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

/** What the asset load left out: types that failed, and types cut at the cap. */
export function LoadNotes({ load }: { load: AssetLoad }) {
  if (!load.errors.length && !load.truncated.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-foreground">
      {load.errors.map((e) => (
        <p key={e.type}>
          {typeInfo(e.type)?.plural ?? e.type} could not be read: {e.error}
        </p>
      ))}
      {load.truncated.length > 0 && (
        <p>
          Only the first {formatCount(PER_TYPE_CAP)} of each type are read here:{' '}
          {load.truncated.map((t) => `${typeInfo(t.type)?.plural.toLowerCase() ?? t.type} (${formatCount(t.total)})`).join(', ')}. Browse the rest on the Catalog tab.
        </p>
      )}
    </div>
  )
}

/** One asset in a list: type, name, full name, service, owners, tier and tags. Opens it in the Catalog tab. */
export function AssetRow({ e, compact }: { e: Asset; compact?: boolean }) {
  const tier = tierOf(e.tags)
  const service = serviceOf(e)
  return (
    <li>
      <button
        type="button"
        className={cn(
          'grid w-full grid-cols-1 items-center gap-x-6 gap-y-1 rounded-md px-2 py-3 text-left hover:bg-muted/50',
          !compact && 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]',
        )}
        onClick={() => openInCatalog({ type: e.assetType, fqn: fqnOf(e) })}
      >
        <span className="flex min-w-0 items-start gap-3">
          <TypeTile type={e.assetType} className="size-7" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{displayName(e)}</span>
              {tier && <Badge variant="primary">{tierLabel(tier.tagFQN)}</Badge>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {typeInfo(e.assetType)?.name}
              {service ? ` · ${service}` : ''} · <span className="font-mono">{fqnOf(e)}</span>
            </span>
            {!compact && e.description && <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground">{e.description}</span>}
          </span>
        </span>
        {!compact && (
          <>
            <span className="hidden min-w-0 md:block">
              <Owners owners={e.owners} empty="–" />
            </span>
            <span className="hidden min-w-0 md:block">
              <Tags tags={e.tags} empty="–" />
            </span>
            <span className="text-xs text-muted-foreground md:text-right">{ago(e.updatedAt)}</span>
          </>
        )}
      </button>
    </li>
  )
}
