import { useState } from 'react'
import { Bookmark, ExternalLink, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasLocalScreen, invokeModule, useModuleQuery } from '@/modules/client'
import { ConfirmDialog } from '@/modules/flashcards/dialogs'

type BookmarkItem = { id: string; name: string; description: string; target: string }
const message = (e: unknown) => e instanceof Error ? e.message : String(e)

export default function BookmarksPage() {
  const query = useModuleQuery<BookmarkItem[]>('bookmarks', 'list')
  const [editing, setEditing] = useState<BookmarkItem | null>()
  const [deleting, setDeleting] = useState<BookmarkItem>()
  const [error, setError] = useState<string>()
  async function open(item: BookmarkItem) {
    try { setError(undefined); await invokeModule('bookmarks', 'open', { id: item.id }) }
    catch (e) { setError(message(e)) }
  }
  return <div className="flex flex-col gap-6">
    <PageHeader title="Bookmarks" description="Keep links, files and folders close at hand." actions={<Button onClick={() => setEditing(null)}><Plus /> New bookmark</Button>} />
    {(error || query.error) && <p role="alert" className="text-sm text-destructive">{error ?? query.error?.message}</p>}
    {query.loading && <p className="text-sm text-muted-foreground">Loading bookmarks…</p>}
    {query.data?.length === 0 && <Card className="items-center p-10 text-center"><Bookmark className="size-8 text-muted-foreground" /><p className="font-medium">No bookmarks yet</p><p className="text-sm text-muted-foreground">Add a website, file or folder to get started.</p><Button onClick={() => setEditing(null)}><Plus /> New bookmark</Button></Card>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {query.data?.map((item) => {
        const web = /^https?:\/\//i.test(item.target)
        const Icon = web ? ExternalLink : FolderOpen
        return <Card key={item.id} className="relative gap-0 p-0 transition-colors hover:bg-muted/50">
          <button type="button" disabled={!hasLocalScreen()} onClick={() => void open(item)} className="flex min-h-40 w-full flex-col items-start gap-3 rounded-xl p-5 pr-12 text-left disabled:cursor-not-allowed" title={hasLocalScreen() ? `Open ${item.name}` : 'Opening bookmarks is available on this computer'}>
            <span className="rounded-lg border p-2"><Icon className="size-4" /></span>
            <span className="w-full break-words text-sm font-medium">{item.name}</span>
            {item.description && <span className="w-full break-words text-sm text-muted-foreground">{item.description}</span>}
            <span className="w-full break-all font-mono text-xs text-muted-foreground">{item.target}</span>
          </button>
          <div className="absolute top-3 right-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing(item)}><Pencil /> Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(item)}><Trash2 /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </Card>
      })}
    </div>
    {editing !== undefined && <BookmarkDialog item={editing ?? undefined} onClose={() => setEditing(undefined)} onSaved={() => void query.refresh()} />}
    <ConfirmDialog open={!!deleting} title="Delete bookmark?" body={`Remove “${deleting?.name ?? ''}” from bookmarks? The linked file or folder will not be deleted.`} action="Delete bookmark" onClose={() => setDeleting(undefined)} onConfirm={async () => {
      try { await invokeModule('bookmarks', 'remove', { id: deleting?.id }); setDeleting(undefined); setError(undefined); await query.refresh() } catch (e) { setError(message(e)); setDeleting(undefined) }
    }} />
  </div>
}

function BookmarkDialog({ item, onClose, onSaved }: { item?: BookmarkItem; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [target, setTarget] = useState(item?.target ?? '')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined)
    try { await invokeModule('bookmarks', 'save', { id: item?.id, name, description, target }); onSaved(); onClose() }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent><form onSubmit={save} className="flex flex-col gap-5">
    <DialogHeader><DialogTitle>{item ? 'Edit bookmark' : 'New bookmark'}</DialogTitle><DialogDescription>Enter a website URL or the full local path to a file or folder.</DialogDescription></DialogHeader>
    <div className="flex flex-col gap-2"><Label htmlFor="bookmark-name">Name</Label><Input id="bookmark-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></div>
    <div className="flex flex-col gap-2"><Label htmlFor="bookmark-description">Description</Label><Input id="bookmark-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Optional" /></div>
    <div className="flex flex-col gap-2"><Label htmlFor="bookmark-target">URL or local path</Label><Input id="bookmark-target" value={target} onChange={(e) => setTarget(e.target.value)} maxLength={4096} placeholder="https://example.com or C:\\Users\\…" required /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !name.trim() || !target.trim()}>{item ? 'Save' : 'Create bookmark'}</Button></DialogFooter>
  </form></DialogContent></Dialog>
}
