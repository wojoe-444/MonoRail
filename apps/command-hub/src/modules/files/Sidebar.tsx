import type { ReactNode } from 'react'
import { Clock, Download, FileText, Film, Folder, FolderGit2, HardDrive, Home, Image, Monitor, Music, Pin, X, Cloud, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { baseName, formatSize, samePath, TAGS } from './kinds'
import type { Places, TagColor } from './types'

const PLACE_ICON: Record<string, LucideIcon> = {
  home: Home,
  desktop: Monitor,
  documents: FileText,
  downloads: Download,
  pictures: Image,
  music: Music,
  videos: Film,
  repos: FolderGit2,
  onedrive: Cloud,
}

export function Sidebar({
  places,
  pinned,
  recent,
  tags,
  current,
  onGo,
  onUnpin,
}: {
  places: Places | undefined
  pinned: string[]
  recent: string[]
  tags: Record<string, TagColor>
  current: string
  onGo: (path: string) => void
  onUnpin: (path: string) => void
}) {
  const tagCounts = TAGS.map((t) => ({ ...t, count: Object.values(tags).filter((c) => c === t.color).length }))
  const is = (p: string) => samePath(p, current)
  return (
    <nav aria-label="Places" className="flex min-h-0 flex-col gap-4 overflow-y-auto p-3 text-sm">
      <Group title="Places">
        {places?.places.map((p) => (
          <Item key={p.id} icon={PLACE_ICON[p.id] ?? Folder} label={p.label} title={p.path} active={is(p.path)} onClick={() => onGo(p.path)} />
        ))}
      </Group>

      <Group title="Pinned">
        {pinned.length === 0 && <p className="px-2 text-xs text-muted-foreground">Right-click a folder and pick Pin to keep it here.</p>}
        {pinned.map((p) => (
          <Item
            key={p}
            icon={Pin}
            label={baseName(p)}
            title={p}
            active={is(p)}
            onClick={() => onGo(p)}
            extra={
              <button type="button" aria-label={`Unpin ${baseName(p)}`} className="invisible rounded p-0.5 text-muted-foreground group-hover:visible hover:text-foreground" onClick={(e) => (e.stopPropagation(), onUnpin(p))}>
                <X className="size-3" />
              </button>
            }
          />
        ))}
      </Group>

      <Group title="Tags">
        <div className="flex flex-wrap gap-1.5 px-2">
          {tagCounts.map((t) => (
            <button
              key={t.color}
              type="button"
              onClick={() => onGo(`tag:${t.color}`)}
              title={`${t.label}: ${t.count} item${t.count === 1 ? '' : 's'}`}
              className={cn('flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs transition-colors hover:bg-muted', current === `tag:${t.color}` && 'border-primary bg-primary-soft')}
            >
              <span className="size-2.5 rounded-full" style={{ background: t.css }} />
              <span className="tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Drives">
        {places?.drives.map((d) => {
          const used = d.total ? (d.total - d.free) / d.total : 0
          return (
            <button key={d.path} type="button" onClick={() => onGo(d.path)} title={d.path} className={cn('flex w-full flex-col gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted', is(d.path) && 'bg-primary-soft hover:bg-primary-soft')}>
              <span className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <span className="font-medium">{d.label}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">{formatSize(d.free)} free</span>
              </span>
              <span className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className={cn('block h-full rounded-full', used > 0.9 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.round(used * 100)}%` }} />
              </span>
            </button>
          )
        })}
      </Group>

      {recent.length > 0 && (
        <Group title="Recent">
          {recent.slice(0, 8).map((p) => (
            <Item key={p} icon={Clock} label={baseName(p)} title={p} active={false} onClick={() => onGo(p)} />
          ))}
        </Group>
      )}
    </nav>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</div>
      {children}
    </div>
  )
}

function Item({ icon: Icon, label, title, active, onClick, extra }: { icon: LucideIcon; label: string; title: string; active: boolean; onClick: () => void; extra?: ReactNode }) {
  return (
    <div className={cn('group flex h-8 items-center rounded-lg pr-1 hover:bg-muted', active && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft')}>
      <button type="button" onClick={onClick} title={title} className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
        <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
        <span className="truncate">{label}</span>
      </button>
      {extra}
    </div>
  )
}
