import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, ClipboardPaste, Copy, ExternalLink, FilePlus2, FolderOpen, FolderPlus, GitBranch, Link2, Loader2, PanelTop, Pencil, Pin, Scissors, Search, Trash2 } from 'lucide-react'

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'

import { call, errorText, thumbnail } from './api'
import { formatDate, formatSize, hasThumbnail, lookOf, samePath, sortEntries, tagCss, TAGS, typeLabel } from './kinds'
import type { FileEntry, Listing, SearchResult, Sort, SortKey, TagColor, ViewMode } from './types'

/** Rows drawn before "Show all" (very large folders stay responsive). */
const RENDER_LIMIT = 1500
const DRAG_TYPE = 'application/x-monorail-files'

export interface Ops {
  navigate: (path: string) => void
  back: () => void
  forward: () => void
  up: () => void
  open: (e: FileEntry) => void
  openInNewTab: (path: string) => void
  rename: (e: FileEntry) => void
  trash: (es: FileEntry[]) => void
  copy: (es: FileEntry[]) => void
  cut: (es: FileEntry[]) => void
  paste: (dir: string) => void
  newFolder: (dir: string) => void
  newFile: (dir: string) => void
  copyPath: (es: FileEntry[]) => void
  reveal: (e: FileEntry) => void
  togglePin: (path: string) => void
  setTag: (paths: string[], color: TagColor | null) => void
  drop: (paths: string[], dir: string, copy: boolean) => void
  canPaste: boolean
  canWrite: boolean
  canUseScreen: boolean
}

export interface PaneProps {
  path: string
  active: boolean
  onActivate: () => void
  view: ViewMode
  sort: Sort
  onSort: (s: Sort) => void
  foldersFirst: boolean
  showHidden: boolean
  version: number
  filter: string
  deep: boolean
  cutPaths: Set<string>
  tags: Record<string, TagColor>
  pinned: string[]
  ops: Ops
  onSelection: (sel: FileEntry[], focus: FileEntry | null, listing: Listing | null) => void
}

const isTagPath = (p: string) => p.startsWith('tag:')

export function Pane(props: PaneProps) {
  const { path, active, onActivate, view, sort, foldersFirst, showHidden, version, filter, deep, tags, ops, onSelection } = props
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focus, setFocus] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  // Columns view: the item picked in any column (it may be deeper than this folder).
  const [picked, setPicked] = useState<FileEntry | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const typeAhead = useRef({ text: '', at: 0 })

  // Load the folder (or a tag's items).
  const tagColor = isTagPath(path) ? (path.slice(4) as TagColor) : null
  // One string, so tagging something elsewhere does not reload an ordinary folder.
  const tagKey = tagColor ? Object.keys(tags).filter((p) => tags[p] === tagColor).join('\n') : ''
  useEffect(() => {
    let alive = true
    setLoading(true)
    const load = tagColor
      ? call<FileEntry[]>('statMany', { paths: tagKey ? tagKey.split('\n') : [] }).then((entries): Listing => ({ path, name: `${tagColor} tag`, parent: null, entries, hiddenCount: 0, truncated: false, git: null }))
      : call<Listing>('list', { path, showHidden })
    load
      .then((l) => {
        if (!alive) return
        setListing(l)
        setError(undefined)
        setSelected((s) => new Set([...s].filter((p) => l.entries.some((e) => e.path === p))))
      })
      .catch((e) => alive && (setError(errorText(e)), setListing(null)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [path, showHidden, version, tagColor, tagKey])

  // A new folder starts with nothing selected.
  useEffect(() => {
    setSelected(new Set())
    setFocus(null)
    setAnchor(null)
    setShowAll(false)
    setPicked(null)
  }, [path])

  // Search below this folder (the toolbar's "Search subfolders").
  useEffect(() => {
    if (!active || !deep || !filter.trim() || tagColor) {
      setSearch(null)
      return
    }
    let alive = true
    setSearching(true)
    const t = setTimeout(() => {
      call<SearchResult>('search', { dir: path, query: filter, showHidden })
        .then((r) => alive && setSearch(r))
        .catch((e) => alive && setError(errorText(e)))
        .finally(() => alive && setSearching(false))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [active, deep, filter, path, showHidden, version, tagColor])

  const entries = useMemo(() => {
    let list = search && deep ? search.results : (listing?.entries ?? [])
    if (active && filter.trim() && !deep) {
      const q = filter.trim().toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    return sortEntries(list, sort, foldersFirst)
  }, [listing, search, deep, active, filter, sort, foldersFirst])
  const shown = showAll ? entries : entries.slice(0, RENDER_LIMIT)
  const listSelection = useMemo(() => entries.filter((e) => selected.has(e.path)), [entries, selected])
  const selection = useMemo(() => (listSelection.length ? listSelection : picked ? [picked] : []), [listSelection, picked])
  const focusEntry = picked ?? entries.find((e) => e.path === focus) ?? null

  useEffect(() => {
    if (active) onSelection(selection, focusEntry ?? selection[selection.length - 1] ?? null, listing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selection, focusEntry, listing])

  const select = useCallback(
    (e: FileEntry, ev?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
      onActivate()
      setPicked(null)
      if (ev?.shiftKey && anchor) {
        const a = entries.findIndex((x) => x.path === anchor)
        const b = entries.findIndex((x) => x.path === e.path)
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          setSelected(new Set(entries.slice(lo, hi + 1).map((x) => x.path)))
          setFocus(e.path)
          return
        }
      }
      if (ev?.ctrlKey || ev?.metaKey) {
        setSelected((s) => {
          const n = new Set(s)
          if (n.has(e.path)) n.delete(e.path)
          else n.add(e.path)
          return n
        })
      } else setSelected(new Set([e.path]))
      setFocus(e.path)
      setAnchor(e.path)
    },
    [anchor, entries, onActivate],
  )

  const currentDir = tagColor ? null : (listing?.path ?? path)

  function onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
    if ((ev.target as HTMLElement).closest('input, textarea')) return
    const ctrl = ev.ctrlKey || ev.metaKey
    const idx = entries.findIndex((e) => e.path === focus)
    const cols = view === 'grid' ? Math.max(1, Math.floor((rootRef.current?.clientWidth ?? 600) / 128)) : 1
    const move = (delta: number) => {
      const next = entries[Math.max(0, Math.min(entries.length - 1, (idx < 0 ? -1 : idx) + delta))]
      if (!next) return
      select(next, { shiftKey: ev.shiftKey })
      rootRef.current?.querySelector(`[data-path="${CSS.escape(next.path)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
    const key = ev.key
    if (key === 'ArrowDown') move(cols)
    else if (key === 'ArrowUp' && !ev.altKey) move(-cols)
    else if (key === 'ArrowRight' && view === 'grid') move(1)
    else if (key === 'ArrowLeft' && view === 'grid' && !ev.altKey) move(-1)
    else if (key === 'Home') move(-entries.length)
    else if (key === 'End') move(entries.length)
    else if (key === 'Enter' && focusEntry) ops.open(focusEntry)
    else if (key === 'Backspace' || (ev.altKey && key === 'ArrowUp')) ops.up()
    else if (ev.altKey && key === 'ArrowLeft') ops.back()
    else if (ev.altKey && key === 'ArrowRight') ops.forward()
    else if (key === 'F2' && focusEntry && ops.canWrite) ops.rename(focusEntry)
    else if (key === 'Delete' && selection.length && ops.canWrite) ops.trash(selection)
    else if (ctrl && key.toLowerCase() === 'a') setSelected(new Set(entries.map((e) => e.path)))
    else if (ctrl && key.toLowerCase() === 'c' && ev.shiftKey && selection.length) ops.copyPath(selection)
    else if (ctrl && key.toLowerCase() === 'c' && selection.length) ops.copy(selection)
    else if (ctrl && key.toLowerCase() === 'x' && selection.length && ops.canWrite) ops.cut(selection)
    else if (ctrl && key.toLowerCase() === 'v' && currentDir && ops.canPaste) ops.paste(currentDir)
    else if (ctrl && ev.shiftKey && key.toLowerCase() === 'n' && currentDir && ops.canWrite) ops.newFolder(currentDir)
    else if (key === 'Escape') setSelected(new Set())
    else if (key.length === 1 && !ctrl && !ev.altKey && /\S/.test(key)) {
      // Type the start of a name to jump to it.
      const t = typeAhead.current
      t.text = Date.now() - t.at > 800 ? key.toLowerCase() : t.text + key.toLowerCase()
      t.at = Date.now()
      const hit = entries.find((e) => e.name.toLowerCase().startsWith(t.text))
      if (hit) {
        select(hit)
        rootRef.current?.querySelector(`[data-path="${CSS.escape(hit.path)}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    } else return
    ev.preventDefault()
  }

  // Drag and drop between folders and panes: move, or copy with Ctrl.
  const dragProps = (e: FileEntry) => ({
    draggable: ops.canWrite && !e.locked,
    onDragStart: (ev: DragEvent) => {
      const paths = selected.has(e.path) ? selection.map((x) => x.path) : [e.path]
      ev.dataTransfer.setData(DRAG_TYPE, JSON.stringify(paths))
      ev.dataTransfer.setData('text/plain', paths.join('\n'))
      ev.dataTransfer.effectAllowed = 'copyMove'
    },
  })
  const dropProps = (dir: string | null, key: string) =>
    dir && ops.canWrite
      ? {
          onDragOver: (ev: DragEvent) => {
            if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return
            ev.preventDefault()
            ev.stopPropagation()
            ev.dataTransfer.dropEffect = ev.ctrlKey ? 'copy' : 'move'
            setDropTarget(key)
          },
          onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
          onDrop: (ev: DragEvent) => {
            const raw = ev.dataTransfer.getData(DRAG_TYPE)
            setDropTarget(null)
            if (!raw) return
            ev.preventDefault()
            ev.stopPropagation()
            const paths = (JSON.parse(raw) as string[]).filter((p) => !samePath(p, dir))
            if (paths.length) ops.drop(paths, dir, ev.ctrlKey)
          },
        }
      : {}

  const rowEvents = (e: FileEntry) => ({
    'data-path': e.path,
    onClick: (ev: MouseEvent) => select(e, ev),
    onDoubleClick: () => ops.open(e),
    onContextMenu: () => {
      onActivate()
      if (!selected.has(e.path)) {
        setSelected(new Set([e.path]))
        setFocus(e.path)
        setAnchor(e.path)
      }
    },
    ...dragProps(e),
    ...(e.kind === 'dir' ? dropProps(e.path, e.path) : {}),
  })

  const ctx: ViewCtx = {
    entries: shown,
    selected,
    focus,
    tags,
    cutPaths: props.cutPaths,
    dropTarget,
    repoRoot: listing?.git?.root ?? null,
    rowEvents,
    showFolder: deep && !!search,
  }

  const empty = !loading && !error && entries.length === 0

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseDown={onActivate}
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col outline-none', !active && 'opacity-[0.92]')}
      aria-label={`Folder ${listing?.name ?? path}`}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn('relative min-h-0 flex-1 overflow-auto', dropTarget === '__pane' && 'bg-primary-soft/40')}
            onClick={(ev) => {
              if (ev.target === ev.currentTarget) setSelected(new Set())
            }}
            onContextMenu={(ev) => {
              if (!(ev.target as HTMLElement).closest('[data-path]')) setSelected(new Set())
            }}
            {...dropProps(currentDir, '__pane')}
          >
            {error ? (
              <Message tone="error">{error}</Message>
            ) : view === 'columns' && !tagColor && !(deep && search) ? (
              <ColumnsView root={path} ctx={ctx} sort={sort} foldersFirst={foldersFirst} showHidden={showHidden} version={version} onPick={(e) => {
                  onActivate()
                  setSelected(new Set())
                  setPicked(e)
                }} ops={ops} />
            ) : view === 'grid' ? (
              <GridView ctx={ctx} />
            ) : (
              <DetailsView ctx={ctx} sort={sort} onSort={props.onSort} />
            )}
            {empty && <Message>{deep && filter ? 'Nothing below this folder matches.' : filter ? 'Nothing here matches the filter.' : tagColor ? 'Nothing has this tag yet. Pick a color in the preview panel to tag an item.' : 'This folder is empty.'}</Message>}
            {!showAll && entries.length > RENDER_LIMIT && (
              <div className="p-3 text-center">
                <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowAll(true)}>
                  Show all {entries.length.toLocaleString()} items
                </button>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <PaneMenu selection={selection} dir={currentDir} ops={ops} pinned={props.pinned} />
      </ContextMenu>
      <StatusBar listing={listing} entries={entries} selection={selection} loading={loading || searching} search={deep ? search : null} />
    </div>
  )
}

function PaneMenu({ selection, dir, ops, pinned }: { selection: FileEntry[]; dir: string | null; ops: Ops; pinned: string[] }) {
  const one = selection.length === 1 ? selection[0] : null
  if (!selection.length)
    return (
      <ContextMenuContent>
        {dir && ops.canWrite && (
          <>
            <ContextMenuItem onSelect={() => ops.newFolder(dir)}>
              <FolderPlus /> New folder
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => ops.newFile(dir)}>
              <FilePlus2 /> New text file
            </ContextMenuItem>
            <ContextMenuItem disabled={!ops.canPaste} onSelect={() => ops.paste(dir)}>
              <ClipboardPaste /> Paste
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {dir && (
          <>
            <ContextMenuItem onSelect={() => ops.togglePin(dir)}>
              <Pin /> {pinned.some((p) => samePath(p, dir)) ? 'Unpin this folder' : 'Pin this folder'}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => ops.copyPath([{ path: dir } as FileEntry])}>
              <Link2 /> Copy folder path
            </ContextMenuItem>
            {ops.canUseScreen && (
              <ContextMenuItem onSelect={() => ops.open({ path: dir, kind: 'file' } as FileEntry)}>
                <ExternalLink /> Open in File Explorer
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    )
  return (
    <ContextMenuContent>
      {one && (
        <ContextMenuItem onSelect={() => ops.open(one)}>
          <FolderOpen /> {one.kind === 'dir' ? 'Open' : 'Open with default app'}
        </ContextMenuItem>
      )}
      {one?.kind === 'dir' && (
        <>
          <ContextMenuItem onSelect={() => ops.openInNewTab(one.path)}>
            <PanelTop /> Open in new tab
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => ops.togglePin(one.path)}>
            <Pin /> {pinned.some((p) => samePath(p, one.path)) ? 'Unpin' : 'Pin to sidebar'}
          </ContextMenuItem>
        </>
      )}
      {one && ops.canUseScreen && (
        <ContextMenuItem onSelect={() => ops.reveal(one)}>
          <ExternalLink /> Show in File Explorer
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      {ops.canWrite && (
        <ContextMenuItem onSelect={() => ops.cut(selection)}>
          <Scissors /> Cut
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={() => ops.copy(selection)}>
        <Copy /> Copy
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => ops.copyPath(selection)}>
        <Link2 /> Copy path{selection.length > 1 ? 's' : ''}
      </ContextMenuItem>
      {one?.kind === 'dir' && ops.canWrite && ops.canPaste && (
        <ContextMenuItem onSelect={() => ops.paste(one.path)}>
          <ClipboardPaste /> Paste into folder
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <div className="flex items-center gap-1.5 px-2 py-1.5" role="group" aria-label="Tag">
        {TAGS.map((t) => (
          <button
            key={t.color}
            type="button"
            title={`Tag ${t.label.toLowerCase()}`}
            aria-label={`Tag ${t.label.toLowerCase()}`}
            className="size-4 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-125"
            style={{ background: t.css }}
            onClick={() => ops.setTag(selection.map((e) => e.path), t.color)}
          />
        ))}
        <button type="button" className="ml-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => ops.setTag(selection.map((e) => e.path), null)}>
          Clear
        </button>
      </div>
      {ops.canWrite && (
        <>
          <ContextMenuSeparator />
          {one && (
            <ContextMenuItem onSelect={() => ops.rename(one)}>
              <Pencil /> Rename
            </ContextMenuItem>
          )}
          <ContextMenuItem className="text-destructive" onSelect={() => ops.trash(selection)}>
            <Trash2 /> Move to Recycle Bin
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}

interface ViewCtx {
  entries: FileEntry[]
  selected: Set<string>
  focus: string | null
  tags: Record<string, TagColor>
  cutPaths: Set<string>
  dropTarget: string | null
  repoRoot: string | null
  rowEvents: (e: FileEntry) => Record<string, unknown>
  showFolder: boolean
}

function EntryIcon({ e, className, size = 'sm' }: { e: FileEntry; className?: string; size?: 'sm' | 'lg' }) {
  const look = lookOf(e)
  const Icon = look.icon
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-md', look.tile, size === 'sm' ? 'size-6' : 'size-14 rounded-xl', className)}>
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-7'} />
    </span>
  )
}

function TagDot({ color }: { color?: TagColor }) {
  if (!color) return null
  return <span className="size-2 shrink-0 rounded-full" style={{ background: tagCss(color) }} aria-label={`${color} tag`} />
}

function folderOf(p: string) {
  const i = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return i > 0 ? p.slice(0, i) : p
}

function DetailsView({ ctx, sort, onSort }: { ctx: ViewCtx; sort: Sort; onSort: (s: Sort) => void }) {
  const head = (key: SortKey, label: string, className?: string) => (
    <th className={cn('sticky top-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground', className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort({ key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' })}
      >
        {label}
        {sort.key === key && (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  )
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <thead>
        <tr className="[&>th]:border-b">
          {head('name', 'Name', 'w-auto')}
          {head('modified', 'Modified', 'hidden w-44 lg:table-cell')}
          {head('type', 'Type', 'hidden w-36 xl:table-cell')}
          {head('size', 'Size', 'w-24 text-right [&>button]:flex-row-reverse')}
        </tr>
      </thead>
      <tbody>
        {ctx.entries.map((e) => {
          const sel = ctx.selected.has(e.path)
          return (
            <tr
              key={e.path}
              {...ctx.rowEvents(e)}
              className={cn(
                'cursor-default select-none [&>td]:px-3 [&>td]:py-1.5',
                sel ? 'bg-primary-soft' : 'hover:bg-muted/70',
                ctx.focus === e.path && 'outline-1 -outline-offset-1 outline-ring/50',
                ctx.dropTarget === e.path && 'bg-primary-soft ring-2 ring-primary ring-inset',
                (ctx.cutPaths.has(e.path) || e.hidden) && 'opacity-55',
              )}
            >
              <td className="rounded-l-md">
                <span className="flex min-w-0 items-center gap-2.5">
                  <EntryIcon e={e} />
                  <span className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    {ctx.showFolder && <span className="block truncate font-mono text-[11px] text-muted-foreground">{folderOf(e.path)}</span>}
                  </span>
                  {e.link && <Link2 className="size-3 shrink-0 text-muted-foreground" aria-label="Link" />}
                  <TagDot color={ctx.tags[e.path]} />
                </span>
              </td>
              <td className="hidden text-muted-foreground lg:table-cell">{formatDate(e.modified)}</td>
              <td className="hidden truncate text-muted-foreground xl:table-cell">{typeLabel(e)}</td>
              <td className="rounded-r-md text-right font-mono text-xs text-muted-foreground tabular-nums">{e.kind === 'file' ? formatSize(e.size) : ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Thumb({ e }: { e: FileEntry }) {
  const [src, setSrc] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hasThumbnail(e)) return
    let alive = true
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((items) => {
      if (!items.some((i) => i.isIntersecting)) return
      io.disconnect()
      void thumbnail(e.path, e.modified).then((s) => alive && setSrc(s))
    })
    io.observe(el)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [e])
  return (
    <div ref={ref} className="flex h-20 w-full items-center justify-center">
      {src ? <img src={src} alt="" className="max-h-20 max-w-full rounded-md object-contain shadow-elevation-1" draggable={false} /> : <EntryIcon e={e} size="lg" />}
    </div>
  )
}

function GridView({ ctx }: { ctx: ViewCtx }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 p-3">
      {ctx.entries.map((e) => {
        const sel = ctx.selected.has(e.path)
        return (
          <div
            key={e.path}
            {...ctx.rowEvents(e)}
            title={e.name}
            className={cn(
              'flex cursor-default flex-col items-center gap-2 rounded-lg p-2 text-center select-none',
              sel ? 'bg-primary-soft' : 'hover:bg-muted/70',
              ctx.focus === e.path && 'outline-1 outline-ring/50',
              ctx.dropTarget === e.path && 'ring-2 ring-primary',
              (ctx.cutPaths.has(e.path) || e.hidden) && 'opacity-55',
            )}
          >
            <Thumb e={e} />
            <span className="flex w-full items-center justify-center gap-1">
              <TagDot color={ctx.tags[e.path]} />
              <span className="line-clamp-2 text-xs break-all">{e.name}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Miller columns: the pane's folder, then each folder picked to its right. */
function ColumnsView({ root, ctx, sort, foldersFirst, showHidden, version, onPick, ops }: { root: string; ctx: ViewCtx; sort: Sort; foldersFirst: boolean; showHidden: boolean; version: number; onPick: (e: FileEntry) => void; ops: Ops }) {
  const [chain, setChain] = useState<string[]>([])
  const [picked, setPicked] = useState<Record<number, string>>({})
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setChain([])
    setPicked({})
  }, [root])
  useEffect(() => end.current?.scrollIntoView({ inline: 'end', block: 'nearest' }), [chain.length])

  return (
    <div className="flex h-full min-h-[320px]">
      <Column entries={ctx.entries} ctx={ctx} pickedPath={picked[0]} onPick={(e) => pick(0, e)} />
      {chain.map((dir, i) => (
        <LoadedColumn key={dir} dir={dir} ctx={ctx} sort={sort} foldersFirst={foldersFirst} showHidden={showHidden} version={version} pickedPath={picked[i + 1]} onPick={(e) => pick(i + 1, e)} ops={ops} />
      ))}
      <div ref={end} className="w-px shrink-0" />
    </div>
  )

  function pick(level: number, e: FileEntry) {
    onPick(e)
    setPicked((p) => {
      const n: Record<number, string> = {}
      for (const k of Object.keys(p).map(Number)) if (k < level) n[k] = p[k]
      n[level] = e.path
      return n
    })
    setChain((c) => (e.kind === 'dir' ? [...c.slice(0, level), e.path] : c.slice(0, level)))
  }
}

function LoadedColumn({ dir, ctx, sort, foldersFirst, showHidden, version, pickedPath, onPick, ops }: { dir: string; ctx: ViewCtx; sort: Sort; foldersFirst: boolean; showHidden: boolean; version: number; pickedPath?: string; onPick: (e: FileEntry) => void; ops: Ops }) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [error, setError] = useState<string>()
  useEffect(() => {
    let alive = true
    call<Listing>('list', { path: dir, showHidden })
      .then((l) => alive && setEntries(sortEntries(l.entries, sort, foldersFirst)))
      .catch((e) => alive && setError(errorText(e)))
    return () => {
      alive = false
    }
  }, [dir, showHidden, version, sort, foldersFirst])
  if (error) return <div className="w-64 shrink-0 border-l p-3 text-xs text-destructive">{error}</div>
  if (!entries)
    return (
      <div className="flex w-64 shrink-0 items-start justify-center border-l p-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  return <Column entries={entries} ctx={{ ...ctx, rowEvents: (e) => ({ ...ctx.rowEvents(e), onDoubleClick: () => ops.open(e) }) }} pickedPath={pickedPath} onPick={onPick} />
}

function Column({ entries, ctx, pickedPath, onPick }: { entries: FileEntry[]; ctx: ViewCtx; pickedPath?: string; onPick: (e: FileEntry) => void }) {
  return (
    <ul className="w-64 shrink-0 overflow-y-auto border-r p-1.5 first:border-l-0">
      {entries.map((e) => {
        const ev = ctx.rowEvents(e)
        const on = pickedPath === e.path
        return (
          <li
            key={e.path}
            {...ev}
            onClick={() => onPick(e)}
            onContextMenu={() => onPick(e)}
            className={cn('flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-sm select-none', on ? 'bg-primary-soft' : 'hover:bg-muted/70', (ctx.cutPaths.has(e.path) || e.hidden) && 'opacity-55', ctx.dropTarget === e.path && 'ring-2 ring-primary')}
          >
            <EntryIcon e={e} />
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <TagDot color={ctx.tags[e.path]} />
            {e.kind === 'dir' && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
          </li>
        )
      })}
      {entries.length === 0 && <li className="px-2 py-3 text-xs text-muted-foreground">Empty</li>}
    </ul>
  )
}

function StatusBar({ listing, entries, selection, loading, search }: { listing: Listing | null; entries: FileEntry[]; selection: FileEntry[]; loading: boolean; search: SearchResult | null }) {
  const selBytes = selection.reduce((s, e) => s + (e.kind === 'file' ? e.size : 0), 0)
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t bg-background px-3 text-xs text-muted-foreground">
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      <span className="tabular-nums">
        {entries.length.toLocaleString()} {entries.length === 1 ? 'item' : 'items'}
        {search && ` found${search.truncated ? ' (stopped early, narrow the search)' : ''}`}
      </span>
      {selection.length > 0 && (
        <span className="tabular-nums">
          {selection.length} selected{selBytes ? ` · ${formatSize(selBytes)}` : ''}
        </span>
      )}
      {!!listing?.hiddenCount && <span>{listing.hiddenCount} hidden</span>}
      {listing?.truncated && <span className="text-warning-soft-foreground">Showing the first 20,000</span>}
      <span className="ml-auto" />
      {search && !loading && (
        <span className="flex items-center gap-1">
          <Search className="size-3" /> {search.visited.toLocaleString()} looked at in {(search.ms / 1000).toFixed(1)} s
        </span>
      )}
      {listing?.git && (
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success-soft-foreground" title={listing.git.root}>
          <GitBranch className="size-3" /> {listing.git.branch}
        </span>
      )}
    </div>
  )
}

function Message({ children, tone }: { children: ReactNode; tone?: 'error' }) {
  return <div className={cn('px-6 py-12 text-center text-sm', tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{children}</div>
}
