import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { monorail } from '../monorail-sdk/client.js'

interface Note {
  id: string
  text: string
  createdAt: string
}

interface Info {
  version: string
  apiVersion: string
  notes: number
  folders: { path: string; write: boolean }[]
}

/** Opened on its own (e.g. `npm run dev`), there is no MonoRail and no backend: use fictional data. */
const sampleNotes: Note[] = [
  { id: 'a', text: 'Open this extension inside MonoRail to keep real notes.', createdAt: new Date().toISOString() },
  { id: 'b', text: 'Notes live in the extension’s private data folder.', createdAt: new Date().toISOString() },
]

function useNotes() {
  const [notes, setNotes] = useState<Note[]>(monorail.inMonoRail ? [] : sampleNotes)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!monorail.inMonoRail) return
    monorail.invoke<Note[]>('listNotes').then(setNotes, (e: Error) => setError(e.message))
    // The backend pushes the list whenever any page changes it.
    return monorail.on<Note[]>('notes', setNotes)
  }, [])
  const run = async (method: string, args: unknown) => {
    setError(undefined)
    try {
      if (monorail.inMonoRail) setNotes(await monorail.invoke<Note[]>(method, args))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return {
    notes,
    error,
    add: (text: string) => run('addNote', { text }),
    remove: (id: string) => run('deleteNote', { id }),
  }
}

export function App() {
  // The manifest points the app at index.html#board and the module page at index.html.
  return location.hash === '#board' ? <Board /> : <HelloPage />
}

// ------------------------------------------------------------- module page --

function HelloPage() {
  const { notes, error, add, remove } = useNotes()
  const [info, setInfo] = useState<Info>()
  const [uptime, setUptime] = useState<number>()
  const [folder, setFolder] = useState<{ path: string; entries: { name: string; dir: boolean }[] }>()
  const [folderError, setFolderError] = useState<string>()
  const [greeting, setGreeting] = useState('Hello from MonoRail')

  // Settings from monorail.json: read once, then follow changes the user saves.
  useEffect(() => {
    if (!monorail.inMonoRail) return
    const off = monorail.onSettings<{ greeting: string }>((s) => setGreeting(s.values.greeting))
    monorail.getSettings<{ greeting: string }>().then((s) => setGreeting(s.values.greeting), () => {})
    return off
  }, [])

  useEffect(() => {
    if (!monorail.inMonoRail) return
    monorail.invoke<Info>('getInfo').then(setInfo, () => {})
    return monorail.on<{ uptimeSeconds: number }>('heartbeat', (p) => setUptime(p.uptimeSeconds))
  }, [notes.length])

  async function pickFolder() {
    setFolderError(undefined)
    try {
      const granted = await monorail.pickFolder()
      if (!granted) return
      const entries = await monorail.invoke<{ name: string; dir: boolean }[]>('listFolder', { folder: granted.path })
      setFolder({ path: granted.path, entries })
    } catch (e) {
      setFolderError((e as Error).message)
    }
  }

  return (
    // Module pages sit inside MonoRail's page, under its header: keep the background transparent.
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <Card title="Notes" description="Saved by the backend in this extension's data folder." className="lg:col-span-2">
        <NoteForm onAdd={add} />
        {error && <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">{error}</p>}
        <ul className="divide-y">
          {notes.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No notes yet.</li>}
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-3">
              <span className="flex-1 text-sm">{n.text}</span>
              <button type="button" onClick={() => remove(n.id)} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                Delete
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-6">
        <Card title="Backend" description="Its own process, its own data folder.">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-right font-medium">{info?.version ?? '–'}</dd>
            <dt className="text-muted-foreground">Extension API</dt>
            <dd className="text-right font-medium">{info?.apiVersion ?? '–'}</dd>
            <dt className="text-muted-foreground">Uptime (live event)</dt>
            <dd className="text-right font-medium tabular-nums">{uptime === undefined ? '–' : `${uptime}s`}</dd>
          </dl>
        </Card>

        <Card title="Settings" description="Declared in monorail.json; MonoRail draws the form.">
          <p className="text-lg font-medium">{greeting}</p>
          <button
            type="button"
            onClick={() => void monorail.openSettings()}
            disabled={!monorail.inMonoRail}
            className="self-start rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-elevation-1 hover:bg-accent disabled:opacity-50"
          >
            Change settings…
          </button>
        </Card>

        <Card title="Folder access" description="Asks you for a folder, then lists it from the backend.">
          <button
            type="button"
            onClick={pickFolder}
            disabled={!monorail.inMonoRail}
            className="self-start rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-elevation-1 hover:bg-accent disabled:opacity-50"
          >
            Choose a folder…
          </button>
          {folderError && <p className="text-sm text-destructive">{folderError}</p>}
          {folder && (
            <div className="text-sm">
              <div className="mb-2 truncate font-mono text-xs text-muted-foreground">{folder.path}</div>
              <ul className="flex flex-col gap-1">
                {folder.entries.map((e) => (
                  <li key={e.name} className="truncate">
                    {e.dir ? '📁' : '📄'} {e.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------- app --

function Board() {
  const { notes, error, add, remove } = useNotes()
  // Apps fill the window under MonoRail's bar and may look like their own product.
  return (
    <div className="min-h-screen bg-gradient-to-br from-highlight-soft via-background to-primary-soft px-8 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Notes Board</h1>
            <p className="text-sm text-muted-foreground">{notes.length} notes, shared with the Hello page.</p>
          </div>
          <div className="w-full max-w-md">
            <NoteForm onAdd={add} />
          </div>
        </header>
        {error && <p className="rounded-lg bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">{error}</p>}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n, i) => (
            <article
              key={n.id}
              className={`group flex min-h-36 flex-col justify-between rounded-xl p-5 shadow-elevation-2 ${i % 3 === 0 ? 'bg-warning-soft text-warning-soft-foreground' : i % 3 === 1 ? 'bg-info-soft text-info-soft-foreground' : 'bg-success-soft text-success-soft-foreground'}`}
            >
              <p className="text-base">{n.text}</p>
              <footer className="mt-4 flex items-center justify-between text-xs opacity-80">
                <time>{new Date(n.createdAt).toLocaleDateString()}</time>
                <button type="button" onClick={() => remove(n.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                  Delete
                </button>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ pieces --

function NoteForm({ onAdd }: { onAdd: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await onAdd(text)
    setText('')
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a note"
        className="h-9 flex-1 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-elevation-1 hover:bg-primary/90">
        Add
      </button>
    </form>
  )
}

function Card({ title, description, className = '', children }: { title: string; description: string; className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col rounded-xl border bg-card shadow-elevation-1 ${className}`}>
      <header className="px-6 pt-6 pb-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-col gap-4 border-t px-6 py-5">{children}</div>
    </section>
  )
}
