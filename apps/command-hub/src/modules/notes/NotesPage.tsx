import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, FolderGit2, GitCommitHorizontal, History, Loader2, MoreHorizontal, NotebookPen, Plus, Search, Trash2 } from 'lucide-react'

import { openInGitHubPlus } from '@/apps/github-plus/handoff'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { isDesktop } from '@/modules/client'
import { ConfirmDialog } from '@/modules/flashcards/dialogs'

import { call, errorText } from './api'
import type { Note, NoteList, NoteSummary, NoteVersion } from './types'

/** Autosave this long after the last keystroke. */
const SAVE_DELAY_MS = 800

/**
 * Notes (electron/modules/notes.cjs): a list on the left, the open note on the
 * right. A note is one Markdown file; its first line is its title. Typing saves
 * the file after a short pause, and the backend commits after a minute of quiet
 * or when the note is left, so the repo's history stays readable.
 */
export default function NotesPage() {
  const [list, setList] = useState<NoteList>()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string>()
  // The editor stays mounted while its note is renamed (a new note's file follows its title).
  const [editorKey, setEditorKey] = useState(0)
  const [error, setError] = useState<string>()
  const [deleting, setDeleting] = useState<NoteSummary>()
  const [historyOf, setHistoryOf] = useState<NoteSummary>()
  const lastOpen = useRef<NoteSummary>(undefined)

  const reload = useCallback(async (q = query) => {
    try {
      const l = await call<NoteList>('list', { query: q })
      setList(l)
      setError(undefined)
      return l
    } catch (e) {
      setError(errorText(e))
    }
  }, [query])

  useEffect(() => {
    const t = setTimeout(() => void reload(query), query ? 200 : 0)
    return () => clearTimeout(t)
  }, [query, reload])

  // Open the newest note on first load.
  useEffect(() => {
    if (!openId && list?.notes[0] && !query) {
      setOpenId(list.notes[0].id)
      setEditorKey((k) => k + 1)
    }
  }, [list, openId, query])

  async function newNote() {
    try {
      const n = await call<Note>('create', { body: '' })
      setQuery('')
      await reload('')
      setOpenId(n.id)
      setEditorKey((k) => k + 1)
    } catch (e) {
      setError(errorText(e))
    }
  }

  function open(id: string) {
    if (id === openId) return
    setOpenId(id)
    setEditorKey((k) => k + 1)
  }

  const notes = list?.notes ?? []
  // While a just-renamed note is not in the reloaded list yet, keep showing it.
  const current = notes.find((n) => n.id === openId) ?? (openId ? lastOpen.current : undefined)
  if (current) lastOpen.current = current

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <PageHeader
        title="Notes"
        description={
          isDesktop()
            ? 'An info dump for anything. Each note is a Markdown file in a local git repo that only lives on this computer.'
            : 'Sample notes: nothing is saved in the browser preview.'
        }
        actions={
          <>
            <Button variant="outline" disabled={!list?.repoPath} onClick={() => list?.repoPath && openInGitHubPlus(list.repoPath)}>
              <FolderGit2 /> Open in GitHub+
            </Button>
            <Button onClick={newNote}>
              <Plus /> New note
            </Button>
          </>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="grid min-h-[560px] flex-1 grid-cols-1 gap-0 overflow-hidden py-0 md:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
          <div className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" className="pl-9" aria-label="Search notes" />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted',
                    n.id === openId && 'bg-primary-soft hover:bg-primary-soft',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-sm font-medium', n.title === 'Untitled' && 'text-muted-foreground')}>{n.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relTime(n.updated)}</span>
                  </span>
                  {n.excerpt && <span className="line-clamp-2 text-xs text-muted-foreground">{n.excerpt}</span>}
                </button>
              </li>
            ))}
            {list && notes.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">{query ? 'No note matches.' : 'No notes yet.'}</li>
            )}
          </ul>
          <div className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
            <GitCommitHorizontal className="size-3.5" />
            <span>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} · local repo, never pushed
            </span>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {current ? (
            <Editor
              key={editorKey}
              id={current.id}
              onSaved={(n) => {
                if (n.id !== openId) setOpenId(n.id)
                void reload()
              }}
              onHistory={() => setHistoryOf(current)}
              onDelete={() => setDeleting(current)}
            />
          ) : (
            <Empty onNew={newNote} hasNotes={notes.length > 0} />
          )}
        </section>
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete this note?"
        body={`"${deleting?.title ?? ''}" is removed from the folder. Its earlier versions stay in the repo's git history.`}
        action="Delete note"
        onClose={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (!deleting) return
          await call('remove', { id: deleting.id })
          setDeleting(undefined)
          setOpenId(undefined)
          await reload()
        }}
      />
      <HistoryDialog note={historyOf} onClose={() => setHistoryOf(undefined)} />
    </div>
  )
}

function Editor({ id: firstId, onSaved, onHistory, onDelete }: { id: string; onSaved: (n: Note) => void; onHistory: () => void; onDelete: () => void }) {
  // The note's id can change on save (see notes-store.cjs save), so it lives in a ref.
  const idRef = useRef(firstId)
  const [note, setNote] = useState<Note>()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [state, setState] = useState<'idle' | 'dirty' | 'saving' | 'error'>('idle')
  const [error, setError] = useState<string>()
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef('')
  /** Typed in since it opened: only then does leaving it commit. */
  const touched = useRef(false)

  useEffect(() => {
    let alive = true
    call<Note>('get', { id: idRef.current })
      .then((n) => {
        if (!alive) return
        setNote(n)
        setText(n.body)
        latest.current = n.body
        if (!n.body) setMode('write')
      })
      .catch((e) => alive && setError(errorText(e)))
    return () => {
      alive = false
    }
  }, [])

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    setState('saving')
    try {
      const n = await call<Note>('save', { id: idRef.current, body: latest.current })
      idRef.current = n.id
      setNote(n)
      setState(n.body === latest.current ? 'idle' : 'dirty')
      onSaved(n)
    } catch (e) {
      setState('error')
      setError(errorText(e))
    }
  }, [onSaved])

  // Leaving the note (another note, or the page) saves what was typed and commits.
  useEffect(
    () => () => {
      if (!touched.current) return
      const pending = timer.current
      clearTimeout(pending)
      const saved = pending ? call('save', { id: idRef.current, body: latest.current }) : Promise.resolve()
      void saved.then(() => call('flush')).catch(() => {})
    },
    [],
  )

  function change(v: string) {
    setText(v)
    latest.current = v
    touched.current = true
    setState('dirty')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = undefined
      void save()
    }, SAVE_DELAY_MS)
  }

  const words = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text])

  if (!note) return <div className="p-6 text-sm text-muted-foreground">{error ?? 'Opening…'}</div>

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Segmented
          aria-label="Write or preview"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <SaveState state={state} committed={note.committed} error={error} />
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">{words} words</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Note actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onHistory}>
                <History /> History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {mode === 'write' ? (
        <textarea
          autoFocus={!note.body}
          value={text}
          onChange={(e) => change(e.target.value)}
          onBlur={() => timer.current && void save()}
          placeholder={'Dump anything here. The first line becomes the title.\n\nMarkdown works: # headings, - lists, `code`, links.'}
          spellCheck
          className="min-h-0 flex-1 resize-none bg-transparent px-6 py-5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
          aria-label="Note text"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{text.trim() ? <ChatMarkdown text={text} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}</div>
      )}
      <div className="border-t px-6 py-2 font-mono text-xs text-muted-foreground">{note.id}.md</div>
    </>
  )
}

function SaveState({ state, committed, error }: { state: 'idle' | 'dirty' | 'saving' | 'error'; committed: boolean; error?: string }) {
  if (state === 'error') return <span className="text-xs text-destructive">{error ?? 'Could not save'}</span>
  if (state === 'dirty' || state === 'saving')
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title={committed ? 'Saved and committed to the notes repo' : 'Saved. Committed after a minute of quiet or when you leave the note.'}>
      <Check className="size-3.5 text-success" /> {committed ? 'Saved · committed' : 'Saved'}
    </span>
  )
}

function Empty({ onNew, hasNotes }: { onNew: () => void; hasNotes: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <NotebookPen className="size-6" />
      </div>
      <div>
        <div className="font-medium">{hasNotes ? 'Pick a note' : 'Start your info dump'}</div>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Links, snippets, meeting scraps, half-formed ideas. No folders or fields: just type.</p>
      </div>
      <Button onClick={onNew}>
        <Plus /> New note
      </Button>
    </div>
  )
}

function HistoryDialog({ note, onClose }: { note?: NoteSummary; onClose: () => void }) {
  const [versions, setVersions] = useState<NoteVersion[]>()
  const [shown, setShown] = useState<{ oid: string; body: string }>()
  useEffect(() => {
    setVersions(undefined)
    setShown(undefined)
    if (note) void call<NoteVersion[]>('history', { id: note.id }).then(setVersions).catch(() => setVersions([]))
  }, [note])
  return (
    <Dialog open={!!note} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>History of “{note?.title}”</DialogTitle>
          <DialogDescription>Every commit that changed this note. Open GitHub+ for full diffs.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-4 sm:grid-cols-[220px_1fr]">
          <ul className="min-h-0 overflow-y-auto">
            {versions?.map((v) => (
              <li key={v.oid}>
                <button
                  type="button"
                  className={cn('w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', shown?.oid === v.oid && 'bg-muted')}
                  onClick={async () => note && setShown({ oid: v.oid, ...(await call<{ body: string }>('version', { id: note.id, oid: v.oid })) })}
                >
                  <div className="truncate">{v.message}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {v.oid.slice(0, 7)} · {new Date(v.time).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
            {versions?.length === 0 && <li className="text-sm text-muted-foreground">Not committed yet.</li>}
          </ul>
          <pre className="min-h-0 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{shown ? shown.body : 'Pick a version to see its text.'}</pre>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function relTime(ms: number) {
  const s = (Date.now() - ms) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
