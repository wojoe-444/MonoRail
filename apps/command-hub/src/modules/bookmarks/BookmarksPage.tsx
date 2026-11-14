import { useState } from 'react'
import { Bookmark, ChevronRight, Folder, FolderOpen, Globe, LayoutGrid, ListTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasLocalScreen, invokeModule, useModuleQuery } from '@/modules/client'
import { ConfirmDialog } from '@/modules/flashcards/dialogs'

type Item = { id: string; name: string; description: string; target: string; kind?: 'folder' | 'bookmark'; parentId?: string | null; color?: string }
type Editor = { item?: Item; kind: 'folder' | 'bookmark'; parentId: string | null }
const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const folder = (item?: Item) => item?.kind === 'folder'
const web = (item: Item) => /^https?:\/\//i.test(item.target)

export default function BookmarksPage() {
  const query = useModuleQuery<Item[]>('bookmarks', 'list')
  const [editing, setEditing] = useState<Editor>()
  const [deleting, setDeleting] = useState<Item>()
  const [error, setError] = useState<string>()
  const [view, setView] = useState<'cards' | 'tree'>('cards')
  const [current, setCurrent] = useState<string | null>(null)
  const items = query.data ?? []
  const folders = items.filter(folder)
  const children = (id: string | null) => items.filter((item) => (item.parentId || null) === id)
  const ancestors: Item[] = []
  let parent = folders.find((f) => f.id === current)
  while (parent && !ancestors.some((a) => a.id === parent?.id)) { ancestors.unshift(parent); parent = folders.find((f) => f.id === parent?.parentId) }
  async function open(item: Item) {
    if (folder(item)) { setCurrent(item.id); setView('cards'); return }
    try { setError(undefined); await invokeModule('bookmarks', 'open', { id: item.id }) } catch (e) { setError(message(e)) }
  }
  function icon(item: Item) {
    const Icon = web(item) ? Globe : folder(item) ? Folder : FolderOpen
    return <Icon className="size-4 shrink-0" style={!web(item) && item.color ? { color: item.color } : undefined} />
  }
  function actions(item: Item) {
    return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing({ item, kind: folder(item) ? 'folder' : 'bookmark', parentId: item.parentId || null })}><Pencil /> Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(item)}><Trash2 /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  }
  function tree(id: string | null, seen = new Set<string>()): React.ReactNode {
    return children(id).filter((item) => !seen.has(item.id)).map((item) => <li key={item.id}><div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1"><button type="button" disabled={!folder(item) && !hasLocalScreen()} onClick={() => void open(item)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left disabled:opacity-50">{icon(item)}<span className="truncate text-sm font-medium">{item.name}</span>{!folder(item) && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{item.target}</span>}</button>{actions(item)}</div>{folder(item) && children(item.id).length > 0 && <ul className="ml-5 flex flex-col gap-2 border-l pl-4 pt-2">{tree(item.id, new Set([...seen, item.id]))}</ul>}</li>)
  }
  return <div className="flex flex-col gap-6">
    <PageHeader title="Bookmarks" description="Keep links, files and folders close at hand." actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing({ kind: 'folder', parentId: current })}><Plus /> New folder</Button><Button onClick={() => setEditing({ kind: 'bookmark', parentId: current })}><Plus /> New bookmark</Button></div>} />
    {(error || query.error) && <p role="alert" className="text-sm text-destructive">{error ?? query.error?.message}</p>}
    {query.loading && <p className="text-sm text-muted-foreground">Loading bookmarks…</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Bookmark folder path" className="flex flex-wrap items-center gap-1 text-sm"><button className="hover:underline" onClick={() => setCurrent(null)}>All bookmarks</button>{ancestors.map((f) => <span key={f.id} className="flex items-center gap-1"><ChevronRight className="size-4" /><button className="hover:underline" onClick={() => { setCurrent(f.id); setView('cards') }}>{f.name}</button></span>)}</nav><div className="flex gap-1" aria-label="Bookmark view"><Button variant={view === 'cards' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid /> Cards</Button><Button variant={view === 'tree' ? 'secondary' : 'ghost'} size="sm" aria-pressed={view === 'tree'} onClick={() => setView('tree')}><ListTree /> Folder structure</Button></div></div>
    {!query.loading && items.length === 0 && <Card className="items-center p-10 text-center"><Bookmark className="size-8 text-muted-foreground" /><p className="font-medium">No bookmarks yet</p><p className="text-sm text-muted-foreground">Add a website, file or folder to get started.</p></Card>}
    {view === 'tree' ? <ul className="flex flex-col gap-2">{tree(null)}</ul> : <>{items.length > 0 && children(current).length === 0 && <p className="text-sm text-muted-foreground">This folder is empty.</p>}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children(current).map((item) => <Card key={item.id} className="relative gap-0 p-0 transition-colors hover:bg-muted/50"><button type="button" disabled={!folder(item) && !hasLocalScreen()} onClick={() => void open(item)} className="flex min-h-40 w-full flex-col items-start gap-3 rounded-xl p-5 pr-12 text-left disabled:cursor-not-allowed" title={folder(item) || hasLocalScreen() ? `Open ${item.name}` : 'Opening bookmarks is available on this computer'}><span className="rounded-lg border p-2">{icon(item)}</span><span className="w-full break-words text-sm font-medium">{item.name}</span>{item.description && <span className="w-full break-words text-sm text-muted-foreground">{item.description}</span>}{item.target && <span className="w-full break-all font-mono text-xs text-muted-foreground">{item.target}</span>}</button><div className="absolute top-3 right-3">{actions(item)}</div></Card>)}</div></>}
    {editing && <BookmarkDialog editor={editing} folders={folders} onClose={() => setEditing(undefined)} onSaved={() => void query.refresh()} />}
    <ConfirmDialog open={!!deleting} title={folder(deleting) ? 'Delete folder?' : 'Delete bookmark?'} body={folder(deleting) ? `Remove “${deleting?.name}” and all bookmarks and folders inside it? Linked files and folders will not be deleted.` : `Remove “${deleting?.name ?? ''}” from bookmarks? The linked file or folder will not be deleted.`} action="Delete" onClose={() => setDeleting(undefined)} onConfirm={async () => { try { await invokeModule('bookmarks', 'remove', { id: deleting?.id }); if (deleting && (deleting.id === current || ancestors.some((a) => a.id === deleting.id))) setCurrent(null); setDeleting(undefined); setError(undefined); await query.refresh() } catch (e) { setError(message(e)); setDeleting(undefined) } }} />
  </div>
}
function BookmarkDialog({ editor, folders, onClose, onSaved }: { editor: Editor; folders: Item[]; onClose: () => void; onSaved: () => void }) {
  const { item, kind } = editor
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [target, setTarget] = useState(item?.target ?? '')
  const [parentId, setParentId] = useState(editor.parentId ?? '')
  const [color, setColor] = useState(item?.color || '#2d653b')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const excluded = new Set(item ? [item.id] : [])
  let size
  do { size = excluded.size; for (const f of folders) if (f.parentId && excluded.has(f.parentId)) excluded.add(f.id) } while (size !== excluded.size)
  function folderPath(f: Item) { const names = [f.name]; const seen = new Set([f.id]); let p = folders.find((x) => x.id === f.parentId); while (p && !seen.has(p.id)) { seen.add(p.id); names.unshift(p.name); p = folders.find((x) => x.id === p?.parentId) } return names.join(' / ') }
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(undefined); try { await invokeModule('bookmarks', 'save', { id: item?.id, kind, name, description, target, parentId: parentId || null, color: kind === 'folder' || !/^https?:\/\//i.test(target) ? color : '' }); onSaved(); onClose() } catch (e) { setError(message(e)) } finally { setBusy(false) } }
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent><form onSubmit={save} className="flex flex-col gap-5"><DialogHeader><DialogTitle>{item ? 'Edit' : 'New'} {kind}</DialogTitle><DialogDescription>{kind === 'folder' ? 'Organize bookmarks in folders and subfolders.' : 'Enter a website URL or the full local path to a file or folder.'}</DialogDescription></DialogHeader>
    <div className="flex flex-col gap-2"><Label htmlFor="bookmark-name">Name</Label><Input id="bookmark-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></div>
    <div className="flex flex-col gap-2"><Label htmlFor="bookmark-parent">Folder</Label><select id="bookmark-parent" className="h-9 rounded-md border bg-background px-3 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">All bookmarks</option>{folders.filter((f) => !excluded.has(f.id)).map((f) => <option key={f.id} value={f.id}>{folderPath(f)}</option>)}</select></div>
    {kind === 'bookmark' && <><div className="flex flex-col gap-2"><Label htmlFor="bookmark-description">Description</Label><Input id="bookmark-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Optional" /></div><div className="flex flex-col gap-2"><Label htmlFor="bookmark-target">URL or local path</Label><Input id="bookmark-target" value={target} onChange={(e) => setTarget(e.target.value)} maxLength={4096} placeholder="https://example.com or C:\Users\…" required /></div></>}
    {(kind === 'folder' || !/^https?:\/\//i.test(target)) && <div className="flex items-center gap-3"><Label htmlFor="bookmark-color">Folder icon color</Label><input id="bookmark-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-background p-1" /></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || (kind === 'bookmark' && !target.trim())}>{item ? 'Save' : `Create ${kind}`}</Button></DialogFooter></form></DialogContent></Dialog>
}
