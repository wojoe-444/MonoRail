import { Bot, ChevronRight, UserRound, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import {
  folderPages,
  folderShows,
  navLabel,
  openPathsFor,
  shows,
  tree,
  type Audience,
  type WikiFolder,
  type WikiNode,
  type WikiPage as Page,
} from './content'
import { setWikiAudience, setWikiFolderOpen, useWikiFolders, type AudienceFilter } from './store'

export type Open = (id: string | undefined, anchor?: string) => void

const AUDIENCE_META: Record<Audience, { label: string; icon: LucideIcon; variant: 'success' | 'info'; hint: string }> = {
  human: { label: 'For people', icon: UserRound, variant: 'success', hint: 'Plain-language guide: no code needed to follow it.' },
  ai: { label: 'For agents', icon: Bot, variant: 'info', hint: 'Dense reference for agents and developers: exact names, paths and contracts.' },
}

export function AudiencePicker({ value }: { value: AudienceFilter }) {
  const options: { id: AudienceFilter; label: string }[] = [
    { id: 'human', label: 'People' },
    { id: 'ai', label: 'Agents' },
    { id: 'all', label: 'All' },
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-1 text-xs text-muted-foreground">Show pages written for</div>
      <div role="radiogroup" aria-label="Show pages written for" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => setWikiAudience(o.id)}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
              value === o.id && 'bg-card text-foreground shadow-elevation-1',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function HiddenNote({ audience, count }: { audience: AudienceFilter; count: number }) {
  if (audience === 'all' || count === 0) return null
  return (
    <p className="px-1 text-xs text-muted-foreground">
      {count} page{count === 1 ? '' : 's'} written {audience === 'human' ? 'for agents' : 'for people'} hidden.{' '}
      <button type="button" className="font-medium text-primary hover:underline" onClick={() => setWikiAudience('all')}>
        Show all
      </button>
    </p>
  )
}

export function AudienceBadges({ audience, className }: { audience: Audience[]; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap gap-1.5', className)}>
      {audience.map((a) => {
        const m = AUDIENCE_META[a]
        return (
          <Badge key={a} variant={m.variant} title={m.hint}>
            <m.icon /> {m.label}
          </Badge>
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------- page tree

/**
 * The page list as a folder tree, nested to any depth. Guides starts open
 * while deeper sections stay collapsed until clicked; the folders around the
 * open page always open. What the user opens or closes is remembered.
 */
export function PageTree({ audience, current, onOpen }: { audience: AudienceFilter; current?: Page; onOpen: Open }) {
  const stored = useWikiFolders()
  const forced = new Set(current ? openPathsFor(current) : [])
  const isOpen = (path: string) => forced.has(path) || (stored[path] ?? path === 'guide')
  return (
    <div className="flex flex-col gap-0.5">
      {tree
        .filter((f) => folderShows(audience, f) || (current && folderPages(f).includes(current)))
        .map((f) => (
          <TreeFolder key={f.path} folder={f} depth={0} audience={audience} current={current} isOpen={isOpen} onOpen={onOpen} />
        ))}
    </div>
  )
}

function TreeFolder({
  folder,
  depth,
  audience,
  current,
  isOpen,
  onOpen,
}: {
  folder: WikiFolder
  depth: number
  audience: AudienceFilter
  current?: Page
  isOpen: (path: string) => boolean
  onOpen: Open
}) {
  const open = isOpen(folder.path)
  const active = current && folder.index && current.id === folder.index.id
  const visible = (n: WikiNode) =>
    n.kind === 'page' ? shows(audience, n.page) || n.page.id === current?.id : folderShows(audience, n.folder) || (!!current && folderPages(n.folder).includes(current))
  const toggle = () => setWikiFolderOpen(folder.path, !open)
  return (
    <div className="flex flex-col gap-0.5">
      <div className={cn('group flex items-center rounded-md', active ? 'bg-primary-soft text-primary-soft-foreground' : 'hover:bg-accent')}>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Close' : 'Open'} ${folder.title}`} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground">
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => (folder.index ? onOpen(folder.index.id) : toggle())}
          className={cn(
            'min-w-0 flex-1 truncate py-1.5 pr-2 text-left',
            depth === 0 ? 'text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase' : 'text-sm font-medium',
            active && 'text-primary-soft-foreground',
          )}
        >
          {folder.title}
        </button>
      </div>
      {open && (
        <div className="ml-3.5 flex flex-col gap-0.5 border-l pl-2">
          {folder.children.filter(visible).map((n) =>
            n.kind === 'page' ? (
              <button
                key={n.page.id}
                type="button"
                onClick={() => onOpen(n.page.id)}
                className={cn(
                  'truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  current?.id === n.page.id && 'bg-primary-soft font-medium text-primary-soft-foreground hover:bg-primary-soft',
                )}
              >
                {navLabel(n.page)}
              </button>
            ) : (
              <TreeFolder key={n.folder.path} folder={n.folder} depth={depth + 1} audience={audience} current={current} isOpen={isOpen} onOpen={onOpen} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
