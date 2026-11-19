import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  ClipboardPaste,
  Columns2,
  Columns3,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  PanelRight,
  Pencil,
  Plus,
  RotateCw,
  Scissors,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react'

import { PageCommandBar } from '@/components/layout/PageCommandBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { hasLocalScreen, isDesktop } from '@/modules/client'
import { ConfirmDialog } from '@/modules/flashcards/dialogs'

import { call, errorText, optionsStore, pinnedStore, recentStore, rememberRecent, tabsStore, tagsStore, usePref } from './api'
import { baseName, crumbs, parentPath, samePath, tagCss } from './kinds'
import { Pane, type Ops } from './Pane'
import { PreviewPanel } from './PreviewPanel'
import { Sidebar } from './Sidebar'
import type { BatchResult, FileEntry, Listing, Places, SortKey, TagColor, ViewMode } from './types'

type NameDialogState = { kind: 'folder' | 'file'; dir: string } | { kind: 'rename'; entry: FileEntry } | null
type Notice = { text: string; tone: 'ok' | 'error' } | null

const newId = () => Math.random().toString(36).slice(2, 10)

/**
 * Files (Tools > Files, electron/modules/files.cjs): tabs, one or two panes per
 * tab, three views (details, grid with thumbnails, columns), a preview panel,
 * pins, color tags and a recursive search. Pins, tags, tabs and view choices
 * are the person's preferences (prefs); the backend keeps nothing.
 */
export default function FilesPage() {
  const desktop = isDesktop()
  const [places, setPlaces] = useState<Places>()
  const [opts, setOpts] = usePref(optionsStore)
  const [tabsState, setTabs] = usePref(tabsStore)
  const [pinned, setPinned] = usePref(pinnedStore)
  const [recent] = usePref(recentStore)
  const [tags, setTags] = usePref(tagsStore)
  const [activePane, setActivePane] = useState(0)
  const [version, setVersion] = useState(0)
  const [filter, setFilter] = useState('')
  const [deep, setDeep] = useState(false)
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'cut'; paths: string[] } | null>(null)
  const [sel, setSel] = useState<{ selection: FileEntry[]; focus: FileEntry | null; listing: Listing | null }>({ selection: [], focus: null, listing: null })
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null)
  const [trashing, setTrashing] = useState<FileEntry[] | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [editingPath, setEditingPath] = useState(false)
  // Back/forward per pane, for this session only.
  const [history, setHistory] = useState<Record<string, { back: string[]; fwd: string[] }>>({})
  const filterRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    call<Places>('places')
      .then(setPlaces)
      .catch((e) => setNotice({ text: errorText(e), tone: 'error' }))
  }, [])

  // First visit: one tab at home.
  useEffect(() => {
    if (places && tabsState.tabs.length === 0) setTabs({ tabs: [{ id: newId(), panes: [places.home] }], active: 0 })
  }, [places, tabsState.tabs.length, setTabs])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.tone === 'error' ? 7000 : 3500)
    return () => clearTimeout(t)
  }, [notice])

  const tabIndex = Math.min(tabsState.active, Math.max(0, tabsState.tabs.length - 1))
  const tab = tabsState.tabs[tabIndex]
  const paneIndex = tab ? Math.min(activePane, tab.panes.length - 1) : 0
  const currentPath = tab?.panes[paneIndex] ?? ''
  const sep = places?.sep ?? '\\'
  const keyOf = (i: number) => `${tab?.id}:${i}`

  const updateTab = useCallback(
    (fn: (panes: string[]) => string[]) => setTabs((s) => ({ ...s, tabs: s.tabs.map((t, i) => (i === Math.min(s.active, s.tabs.length - 1) ? { ...t, panes: fn(t.panes) } : t)) })),
    [setTabs],
  )

  const go = useCallback(
    (i: number, path: string, push = true) => {
      if (!tab) return
      const cur = tab.panes[i]
      if (cur && samePath(cur, path)) return
      if (push && cur) {
        const key = `${tab.id}:${i}`
        setHistory((all) => ({ ...all, [key]: { back: [...(all[key]?.back ?? []), cur].slice(-50), fwd: [] } }))
      }
      updateTab((panes) => panes.map((p, j) => (j === i ? path : p)))
      setFilter('')
      setDeep(false)
      if (!path.startsWith('tag:')) rememberRecent(path)
    },
    [tab, updateTab],
  )

  const step = (i: number, dir: 'back' | 'fwd') => {
    const h = history[keyOf(i)]
    if (!h || !tab) return
    const from = dir === 'back' ? h.back : h.fwd
    const target = from[from.length - 1]
    if (!target) return
    const cur = tab.panes[i]
    setHistory((all) => ({ ...all, [keyOf(i)]: dir === 'back' ? { back: h.back.slice(0, -1), fwd: [...h.fwd, cur] } : { back: [...h.back, cur], fwd: h.fwd.slice(0, -1) } }))
    go(i, target, false)
  }

  const refresh = () => setVersion((v) => v + 1)
  const report = (r: BatchResult, verb: string) => {
    refresh()
    if (r.failed.length) setNotice({ text: `${r.failed.length} could not be ${verb}: ${r.failed[0].name}: ${r.failed[0].error}`, tone: 'error' })
    else setNotice({ text: `${r.done.length} ${r.done.length === 1 ? 'item' : 'items'} ${verb}.`, tone: 'ok' })
  }
  const fail = (e: unknown) => setNotice({ text: errorText(e), tone: 'error' })

  function newTab(path = currentPath || places?.home || '') {
    if (!path) return
    setTabs((s) => ({ tabs: [...s.tabs, { id: newId(), panes: [path.startsWith('tag:') ? (places?.home ?? path) : path] }], active: s.tabs.length }))
    setActivePane(0)
  }
  function closeTab(i: number) {
    setTabs((s) => {
      if (s.tabs.length <= 1) return s
      const tabs = s.tabs.filter((_, j) => j !== i)
      return { tabs, active: Math.min(s.active > i || s.active === tabs.length ? s.active - 1 : s.active, tabs.length - 1) }
    })
  }
  function toggleSplit() {
    updateTab((panes) => (panes.length > 1 ? [panes[paneIndex]] : [panes[0], panes[0]]))
    setActivePane(tab && tab.panes.length > 1 ? 0 : 1)
  }

  const movePrefs = (from: string, to: string) => {
    const remap = (p: string) => (samePath(p, from) ? to : p.toLowerCase().startsWith(`${from.toLowerCase()}${sep}`) ? to + p.slice(from.length) : p)
    setTags((t) => Object.fromEntries(Object.entries(t).map(([p, c]) => [remap(p), c])))
    setPinned((ps) => ps.map(remap))
  }

  const makeOps = (i: number): Ops => ({
    navigate: (p) => go(i, p),
    back: () => step(i, 'back'),
    forward: () => step(i, 'fwd'),
    up: () => {
      const p = tab?.panes[i]
      const up = p && !p.startsWith('tag:') ? parentPath(p, sep) : null
      if (up) go(i, up)
    },
    open: (e) => {
      if (e.kind === 'dir') return go(i, e.path)
      if (!hasLocalScreen()) return setNotice({ text: desktop ? 'Open files on the PC itself.' : 'Opening files works in the desktop app.', tone: 'error' })
      void call('open', { path: e.path }).catch(fail)
    },
    openInNewTab: (p) => newTab(p),
    rename: (entry) => setNameDialog({ kind: 'rename', entry }),
    trash: (es) => es.length && setTrashing(es),
    copy: (es) => {
      setClipboard({ mode: 'copy', paths: es.map((e) => e.path) })
      setNotice({ text: `${es.length} copied. Paste in any folder.`, tone: 'ok' })
    },
    cut: (es) => {
      setClipboard({ mode: 'cut', paths: es.map((e) => e.path) })
      setNotice({ text: `${es.length} cut. Paste in another folder to move.`, tone: 'ok' })
    },
    paste: (dir) => {
      if (!clipboard) return
      const mode = clipboard.mode === 'cut' ? 'move' : 'copy'
      void call<BatchResult & { pairs?: { from: string; to: string }[] }>('paste', { sources: clipboard.paths, dir, mode })
        .then((r) => {
          if (mode === 'move') {
            r.pairs?.forEach((x) => movePrefs(x.from, x.to))
            setClipboard(null)
          }
          report(r, mode === 'move' ? 'moved' : 'copied')
        })
        .catch(fail)
    },
    newFolder: (dir) => setNameDialog({ kind: 'folder', dir }),
    newFile: (dir) => setNameDialog({ kind: 'file', dir }),
    copyPath: (es) => {
      void navigator.clipboard.writeText(es.map((e) => e.path).join('\n')).then(
        () => setNotice({ text: es.length === 1 ? 'Path copied.' : `${es.length} paths copied.`, tone: 'ok' }),
        fail,
      )
    },
    reveal: (e) => void call('reveal', { path: e.path }).catch(fail),
    togglePin: (p) => setPinned((ps) => (ps.some((x) => samePath(x, p)) ? ps.filter((x) => !samePath(x, p)) : [...ps, p])),
    setTag: (paths, color) =>
      setTags((t) => {
        const n = { ...t }
        for (const p of paths) {
          if (color) n[p] = color
          else delete n[p]
        }
        return n
      }),
    drop: (paths, dir, copy) => {
      void call<BatchResult & { pairs?: { from: string; to: string }[] }>('paste', { sources: paths, dir, mode: copy ? 'copy' : 'move' })
        .then((r) => {
          if (!copy) r.pairs?.forEach((x) => movePrefs(x.from, x.to))
          report(r, copy ? 'copied' : 'moved')
        })
        .catch(fail)
    },
    canPaste: !!clipboard && desktop,
    canWrite: desktop,
    canUseScreen: hasLocalScreen(),
  })

  const activeOps = makeOps(paneIndex)
  const h = history[keyOf(paneIndex)]
  const inTag = currentPath.startsWith('tag:')
  const currentDir = inTag ? null : currentPath
  // Stable objects: panes report their selection from effects keyed on these.
  const sort = useMemo(() => ({ key: opts.sortKey, dir: opts.sortDir }), [opts.sortKey, opts.sortDir])
  const cutPaths = useMemo(() => new Set(clipboard?.mode === 'cut' ? clipboard.paths : []), [clipboard])

  const previewTarget = sel.focus
    ? { path: sel.focus.path, name: sel.focus.name, kind: sel.focus.kind, ext: sel.focus.ext, modified: sel.focus.modified }
    : sel.listing && !inTag
      ? { path: sel.listing.path, name: sel.listing.name, kind: 'dir' as const, ext: '', modified: 0 }
      : null

  function onRootKey(ev: KeyboardEvent<HTMLDivElement>) {
    const ctrl = ev.ctrlKey || ev.metaKey
    const k = ev.key.toLowerCase()
    if (ctrl && k === 't') newTab()
    else if (ctrl && k === 'w') closeTab(tabIndex)
    else if (ctrl && k === 'l') setEditingPath(true)
    else if (ctrl && k === 'f') filterRef.current?.focus()
    else if (ctrl && ev.key === 'Tab' && tabsState.tabs.length > 1) setTabs((s) => ({ ...s, active: (s.active + (ev.shiftKey ? s.tabs.length - 1 : 1)) % s.tabs.length }))
    else if (ev.key === 'F5') refresh()
    else return
    ev.preventDefault()
  }

  const sortLabels: Record<SortKey, string> = { name: 'Name', modified: 'Date modified', size: 'Size', type: 'Type' }
  const selection = sel.selection

  return (
    <div className="flex h-full min-h-0 flex-col" onKeyDown={onRootKey}>
      <PageCommandBar
        title="Files"
        description={desktop ? 'A file explorer with tabs, split view, previews, pins and color tags. Deleting always goes to the Recycle Bin.' : 'Sample folders: the real explorer works in the desktop app.'}
        actions={
          <>
            <BarButton label={tab && tab.panes.length > 1 ? 'Single pane' : 'Split into two panes'} pressed={!!tab && tab.panes.length > 1} onClick={toggleSplit}>
              <Columns2 />
            </BarButton>
            <BarButton label={opts.preview ? 'Hide preview' : 'Show preview'} pressed={opts.preview} onClick={() => setOpts((o) => ({ ...o, preview: !o.preview }))}>
              <PanelRight />
            </BarButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-7" disabled={!currentDir || !desktop}>
                  <Plus /> New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => currentDir && activeOps.newFolder(currentDir)}>
                  <FolderPlus /> Folder <span className="ml-auto pl-4 text-xs text-muted-foreground">Ctrl+Shift+N</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => currentDir && activeOps.newFile(currentDir)}>
                  <FilePlus2 /> Text file
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        {/* Folder tabs, drawn like the command bar's page tabs. */}
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Folder tabs">
          {tabsState.tabs.map((t, i) => {
            const p = t.panes[0]
            const label = (q: string | undefined) => (q?.startsWith('tag:') ? `${q.slice(4)} tag` : baseName(q ?? '') || q)
            const current = i === tabIndex
            const TabIcon = t.panes.length > 1 ? Columns2 : p?.startsWith('tag:') ? Tag : Folder
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={current}
                tabIndex={0}
                onClick={() => (setTabs((s) => ({ ...s, active: i })), setActivePane(0))}
                onAuxClick={(e) => e.button === 1 && closeTab(i)}
                onKeyDown={(e) => e.key === 'Enter' && setTabs((s) => ({ ...s, active: i }))}
                className={cn(
                  'group inline-flex h-7 max-w-56 shrink-0 cursor-default items-center gap-2 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  current ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
                title={t.panes.join('  |  ')}
              >
                <TabIcon className="size-3.5 shrink-0" />
                <span className="truncate">{t.panes.map(label).join(' | ')}</span>
                {tabsState.tabs.length > 1 && (
                  <button
                    type="button"
                    aria-label="Close tab"
                    className={cn('-mr-1 rounded p-0.5 hover:bg-foreground/10', current ? 'opacity-70' : 'opacity-0 group-hover:opacity-70')}
                    onClick={(e) => (e.stopPropagation(), closeTab(i))}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            )
          })}
          <BarButton label="New tab (Ctrl+T)" onClick={() => newTab()}>
            <Plus />
          </BarButton>
        </div>
      </PageCommandBar>

      <div className="relative flex min-h-0 flex-1 flex-col bg-card">
        {/* Navigation, path, filter, actions and view in one row */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1.5">
          <div className="flex items-center">
            <IconButton label="Back (Alt+Left)" disabled={!h?.back.length} onClick={() => activeOps.back()}>
              <ArrowLeft />
            </IconButton>
            <IconButton label="Forward (Alt+Right)" disabled={!h?.fwd.length} onClick={() => activeOps.forward()}>
              <ArrowRight />
            </IconButton>
            <IconButton label="Up (Backspace)" disabled={!currentDir || !parentPath(currentDir, sep)} onClick={() => activeOps.up()}>
              <ArrowUp />
            </IconButton>
            <IconButton label="Refresh (F5)" onClick={refresh}>
              <RotateCw />
            </IconButton>
          </div>
          <PathBar path={currentPath} sep={sep} home={places?.home} editing={editingPath} setEditing={setEditingPath} onGo={(p) => activeOps.navigate(p)} />
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={filterRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filter.trim()) setDeep(true)
                if (e.key === 'Escape') {
                  setFilter('')
                  setDeep(false)
                }
              }}
              placeholder={deep ? 'Search subfolders' : 'Filter this folder'}
              title="Filter this folder. Enter also searches subfolders."
              aria-label="Filter or search"
              className="h-8 pr-24 pl-8"
              disabled={inTag}
            />
            {filter && (
              <button
                type="button"
                onClick={() => setDeep((d) => !d)}
                className={cn('absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs', deep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
                title="Also look in every folder below this one"
              >
                Subfolders
              </button>
            )}
          </div>
          <Divider />
          <IconButton label="Cut (Ctrl+X)" disabled={!selection.length || !desktop} onClick={() => activeOps.cut(selection)}>
            <Scissors />
          </IconButton>
          <IconButton label="Copy (Ctrl+C)" disabled={!selection.length} onClick={() => activeOps.copy(selection)}>
            <Copy />
          </IconButton>
          <IconButton label={clipboard ? `Paste ${clipboard.paths.length} (Ctrl+V)` : 'Paste (Ctrl+V)'} disabled={!activeOps.canPaste || !currentDir} onClick={() => currentDir && activeOps.paste(currentDir)}>
            <ClipboardPaste />
          </IconButton>
          <IconButton label="Rename (F2)" disabled={selection.length !== 1 || !desktop} onClick={() => activeOps.rename(selection[0])}>
            <Pencil />
          </IconButton>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8" disabled={!selection.length} aria-label="Tag">
                    <Tag />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Tag</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Tag {selection.length === 1 ? selection[0].name : `${selection.length} items`}</DropdownMenuLabel>
              {(['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as TagColor[]).map((c) => (
                <DropdownMenuItem key={c} onSelect={() => activeOps.setTag(selection.map((e) => e.path), c)}>
                  <span className="size-3 rounded-full" style={{ background: tagCss(c) }} /> <span className="capitalize">{c}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => activeOps.setTag(selection.map((e) => e.path), null)}>Clear tag</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label="Move to Recycle Bin (Delete)" disabled={!selection.length || !desktop} onClick={() => activeOps.trash(selection)}>
            <Trash2 />
          </IconButton>
          <Divider />
          <ViewSwitch value={opts.view} onChange={(v) => setOpts((o) => ({ ...o, view: v }))} />
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8" aria-label={`Sort: ${sortLabels[opts.sortKey]}`}>
                    <ArrowDownUp />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                Sort: {sortLabels[opts.sortKey]} {opts.sortDir === 'asc' ? '↑' : '↓'}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                <DropdownMenuItem key={k} onSelect={() => setOpts((o) => ({ ...o, sortKey: k, sortDir: o.sortKey === k && o.sortDir === 'asc' ? 'desc' : 'asc' }))}>
                  {sortLabels[k]} {opts.sortKey === k && <span className="ml-auto pl-4">{opts.sortDir === 'asc' ? '↑' : '↓'}</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setOpts((o) => ({ ...o, foldersFirst: !o.foldersFirst }))}>{opts.foldersFirst ? 'Mix folders with files' : 'Folders first'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label={opts.showHidden ? 'Hide hidden items' : 'Show hidden items'} pressed={opts.showHidden} onClick={() => setOpts((o) => ({ ...o, showHidden: !o.showHidden }))}>
            {opts.showHidden ? <Eye /> : <EyeOff />}
          </IconButton>
        </div>

        {/* Body: sidebar, panes and preview, edge to edge */}
        <div className={cn('grid min-h-0 flex-1 grid-cols-1', opts.preview ? 'md:grid-cols-[224px_1fr] xl:grid-cols-[224px_1fr_300px]' : 'md:grid-cols-[224px_1fr]')}>
          <aside className="hidden min-h-0 border-r md:flex md:flex-col">
            <Sidebar places={places} pinned={pinned} recent={recent} tags={tags} current={currentPath} onGo={(p) => activeOps.navigate(p)} onUnpin={(p) => activeOps.togglePin(p)} />
          </aside>
          <div className="flex min-h-0 min-w-0">
            {tab?.panes.map((p, i) => (
              <div key={`${tab.id}:${i}`} className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col', i > 0 && 'border-l')}>
                {tab.panes.length > 1 && (
                  <div className={cn('flex h-7 shrink-0 items-center gap-2 border-b px-3 text-xs', i === paneIndex ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground')}>
                    <span className={cn('size-1.5 rounded-full', i === paneIndex ? 'bg-primary' : 'bg-muted-foreground/40')} />
                    <span className="truncate font-mono">{p.startsWith('tag:') ? `${p.slice(4)} tag` : p}</span>
                  </div>
                )}
                <Pane
                  path={p}
                  active={i === paneIndex}
                  onActivate={() => setActivePane(i)}
                  view={opts.view}
                  sort={sort}
                  onSort={(s) => setOpts((o) => ({ ...o, sortKey: s.key, sortDir: s.dir }))}
                  foldersFirst={opts.foldersFirst}
                  showHidden={opts.showHidden}
                  version={version}
                  filter={i === paneIndex ? filter : ''}
                  deep={i === paneIndex && deep}
                  cutPaths={cutPaths}
                  tags={tags}
                  pinned={pinned}
                  ops={makeOps(i)}
                  onSelection={(selection, focus, listing) => setSel({ selection, focus, listing })}
                />
              </div>
            ))}
          </div>
          {opts.preview && (
            <aside className="hidden min-h-0 overflow-y-auto border-l bg-background xl:block">
              <PreviewPanel target={previewTarget} count={selection.length} tags={tags} pinned={pinned} ops={activeOps} />
            </aside>
          )}
        </div>

        {notice && (
          <div role="status" className={cn('absolute bottom-12 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-2 text-sm shadow-elevation-3', notice.tone === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-foreground text-background')}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <NameDialog
        state={nameDialog}
        onClose={() => setNameDialog(null)}
        onDone={(path, from) => {
          setNameDialog(null)
          if (from) movePrefs(from, path)
          refresh()
        }}
      />
      <ConfirmDialog
        open={!!trashing}
        title={trashing?.length === 1 ? `Move "${trashing[0].name}" to the Recycle Bin?` : `Move ${trashing?.length ?? 0} items to the Recycle Bin?`}
        body="You can bring them back from the Recycle Bin until it is emptied."
        action="Move to Recycle Bin"
        onClose={() => setTrashing(null)}
        onConfirm={async () => {
          const paths = trashing?.map((e) => e.path) ?? []
          setTrashing(null)
          try {
            const r = await call<BatchResult>('trash', { paths })
            setTags((t) => Object.fromEntries(Object.entries(t).filter(([p]) => !r.done.some((d) => samePath(d, p)))))
            report(r, 'moved to the Recycle Bin')
          } catch (e) {
            fail(e)
          }
        }}
      />
    </div>
  )
}

function PathBar({ path, sep, home, editing, setEditing, onGo }: { path: string; sep: string; home?: string; editing: boolean; setEditing: (v: boolean) => void; onGo: (p: string) => void }) {
  const [text, setText] = useState(path)
  useEffect(() => setText(path), [path, editing])
  if (!path && !editing) return <div className="h-8 min-w-48 flex-1 rounded-md border bg-muted/40" />
  if (editing)
    return (
      <Input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false)
          if (e.key === 'Enter') {
            let p = text.trim().replace(/^"(.*)"$/, '$1')
            if (home && (p === '~' || p.startsWith('~/') || p.startsWith('~\\'))) p = home + p.slice(1)
            if (p) onGo(p)
            setEditing(false)
          }
        }}
        className="h-8 min-w-48 flex-1 font-mono text-sm"
        aria-label="Folder path"
        placeholder="Type a folder path"
      />
    )
  if (path.startsWith('tag:'))
    return (
      <div className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm">
        <span className="size-2.5 rounded-full" style={{ background: tagCss(path.slice(4) as TagColor) }} />
        <span className="capitalize">{path.slice(4)} tag</span>
      </div>
    )
  const parts = crumbs(path, sep)
  return (
    <div
      className="flex h-8 min-w-48 flex-1 cursor-text items-center overflow-x-auto rounded-md border bg-background px-1 text-sm [scrollbar-width:none]"
      onClick={(e) => e.target === e.currentTarget && setEditing(true)}
      title="Click an empty spot to type a path (Ctrl+L)"
    >
      {parts.map((c, i) => (
        <span key={c.path} className="flex shrink-0 items-center">
          {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
          <button type="button" onClick={() => onGo(c.path)} className={cn('rounded px-1.5 py-0.5 hover:bg-muted', i === parts.length - 1 && 'font-medium')}>
            {c.label}
          </button>
        </span>
      ))}
      <span className="h-full min-w-8 flex-1" onClick={() => setEditing(true)} />
    </div>
  )
}

function NameDialog({ state, onClose, onDone }: { state: NameDialogState; onClose: () => void; onDone: (path: string, from?: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setError(undefined)
    setBusy(false)
    if (!state) return
    const initial = state.kind === 'rename' ? state.entry.name : state.kind === 'folder' ? 'New folder' : 'New text file.txt'
    setName(initial)
    // Select the name without its extension, as Explorer does.
    setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      const dot = state.kind === 'folder' || (state.kind === 'rename' && state.entry.kind === 'dir') ? -1 : initial.lastIndexOf('.')
      el.focus()
      el.setSelectionRange(0, dot > 0 ? dot : initial.length)
    }, 30)
  }, [state])

  async function submit() {
    if (!state) return
    setBusy(true)
    try {
      if (state.kind === 'rename') {
        const r = await call<{ path: string }>('rename', { path: state.entry.path, name })
        onDone(r.path, state.entry.path)
      } else {
        const r = await call<{ path: string }>(state.kind === 'folder' ? 'createFolder' : 'createFile', { dir: state.dir, name })
        onDone(r.path)
      }
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  const title = state?.kind === 'rename' ? 'Rename' : state?.kind === 'folder' ? 'New folder' : 'New text file'
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{state?.kind === 'rename' ? `Give "${state.entry.name}" a new name.` : `In ${state ? baseName(state.dir) || state.dir : ''}.`}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-2"
        >
          <Input ref={inputRef} value={name} onChange={(e) => (setName(e.target.value), setError(undefined))} aria-label="Name" aria-invalid={!!error} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {state?.kind === 'rename' ? 'Rename' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function IconButton({ label, children, onClick, disabled, pressed, className }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className={cn('size-8', pressed && 'bg-primary-soft text-primary hover:bg-primary-soft', className)}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

/** A small icon button for the command bar in the top bar, named in a tooltip. */
function BarButton({ label, children, onClick, pressed }: { label: string; children: React.ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} aria-pressed={pressed} onClick={onClick} className={cn('size-7 shrink-0', pressed && 'bg-primary-soft text-primary hover:bg-primary-soft')}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const VIEWS: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: 'details', label: 'Details', icon: List },
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'columns', label: 'Columns', icon: Columns3 },
]

/** Details / Grid / Columns as an icon button group. */
function ViewSwitch({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div role="radiogroup" aria-label="View" className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {VIEWS.map((v) => (
        <Tooltip key={v.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={value === v.value}
              aria-label={v.label}
              onClick={() => onChange(v.value)}
              className={cn(
                'flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                value === v.value ? 'bg-card text-foreground shadow-elevation-1' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <v.icon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{v.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
