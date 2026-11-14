import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Compass, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isDesktop, invokeModule } from '@/modules/client'
import { useCatalog } from '@/modules/agent-catalog/api'
import { call as notesCall } from '@/modules/notes/api'
import { call as cardsCall } from '@/modules/flashcards/api'
import { sampleProject } from '@/modules/semantic/sample'
import type { SemanticProject } from '@/modules/semantic/types'
import type { NoteList } from '@/modules/notes/types'
import type { DeckList, CardList } from '@/modules/flashcards/types'

type Entry = { group: string; type: string; name: string; description?: string; fields: Record<string, unknown> }
type Field = { id: string; entry: Entry; name: string; value: unknown }
const display = (v: unknown): string => v == null || v === '' ? 'Not set' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)
function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (value && typeof value === 'object') {
    const parts = Object.entries(value)
    if (parts.length) return Object.assign({}, ...parts.map(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key)))
  }
  return { [prefix]: value }
}
const entry = (group: string, type: string, name: string, fields: object, description?: string): Entry => ({ group, type, name, fields: flatten(fields), description })

export default function ExplorePage() {
  const catalog = useCatalog()
  const [notes, setNotes] = useState<NoteList>()
  const [decks, setDecks] = useState<DeckList>()
  const [cards, setCards] = useState<CardList[]>([])
  const [project, setProject] = useState<SemanticProject>()
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('All sources')
  const [path, setPath] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    void Promise.allSettled([
      notesCall<NoteList>('list'),
      cardsCall<DeckList>('listDecks').then(async (d) => ({ d, cards: await Promise.all(d.decks.map((deck) => cardsCall<CardList>('listCards', { deckId: deck.id }))) })),
      isDesktop() ? invokeModule<SemanticProject>('semantic', 'getProject') : Promise.resolve(sampleProject),
    ]).then(([n, c, p]) => {
      if (!live) return
      const failures: string[] = []
      if (n.status === 'fulfilled') setNotes(n.value); else { setNotes(undefined); failures.push(`Notes: ${String(n.reason)}`) }
      if (c.status === 'fulfilled') { setDecks(c.value.d); setCards(c.value.cards) } else { setDecks(undefined); setCards([]); failures.push(`Flashcards: ${String(c.reason)}`) }
      if (p.status === 'fulfilled') setProject(p.value); else { setProject(undefined); failures.push(`Semantic: ${String(p.reason)}`) }
      setErrors(failures); setLoading(false)
    })
    return () => { live = false }
  }, [revision])

  const entries = useMemo(() => [
    ...(catalog.data?.subagents ?? []).map((s) => entry('Agents', 'Subagents', s.name, s, s.description)),
    ...(notes?.notes ?? []).map((n) => entry('Workspace', 'Notes', n.title, n, n.excerpt)),
    ...(decks?.decks ?? []).map((d) => entry('Learning', 'Decks', d.name, d, d.description)),
    ...cards.flatMap((list) => list.cards.map((c) => entry('Learning', `Cards · ${list.deck.name}`, c.front || 'Untitled card', c, c.back))),
    ...(project?.models ?? []).map((m) => entry('Semantic', 'Models', m.name, m, m.description)),
    ...(project?.metrics ?? []).map((m) => entry('Semantic', 'Metrics', m.name, m, m.description)),
    ...(project?.savedQueries ?? []).map((s) => entry('Semantic', 'Saved queries', s.name, s, s.description)),
  ], [catalog.data, notes, decks, cards, project])
  const groups = ['Agents', 'Workspace', 'Learning', 'Semantic']
  const types: Record<string, string[]> = {
    Agents: ['Subagents'], Workspace: ['Notes'], Learning: ['Decks', ...cards.map((c) => `Cards · ${c.deck.name}`)], Semantic: ['Models', 'Metrics', 'Saved queries'],
  }
  const fields = useMemo<Field[]>(() => entries.flatMap((e, i) => Object.entries(e.fields).map(([name, value]) => ({ id: `${i}:${name}`, entry: e, name, value }))), [entries])
  const visible = fields.filter((f) => (scope === 'All sources' || f.entry.group === scope) && (!path[0] || f.entry.group === path[0]) && (!path[1] || f.entry.type === path[1]) && (!path[2] || f.entry.name === path[2]) && (!path[3] || f.name === path[3]) && `${f.entry.group} ${f.entry.type} ${f.entry.name} ${f.name} ${display(f.value)}`.toLowerCase().includes(query.toLowerCase()))
  const pageFields = visible.slice(page * 100, (page + 1) * 100)
  const active = pageFields.find((f) => f.id === selected) ?? pageFields[0]
  const toggle = (key: string) => setExpanded((x) => x.includes(key) ? x.filter((v) => v !== key) : [...x, key])
  const choose = (p: string[]) => { setPath(p); setScope('All sources'); setSelected(''); setPage(0) }
  const node = (label: string, p: string[], count: number, children?: () => React.ReactNode) => {
    const key = JSON.stringify(p); const open = expanded.includes(key)
    return <div key={key}><div className={cn('flex items-center rounded-md text-sm hover:bg-muted', JSON.stringify(path) === key && 'bg-primary/10 text-primary')}>
      <button type="button" className="p-1" aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`} onClick={() => toggle(key)}>{children ? open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="block size-4" />}</button>
      <button type="button" className="min-w-0 flex-1 truncate py-1 text-left" onClick={() => choose(p)}>{label}</button><span className="px-2 text-xs text-muted-foreground">{count}</span></div>{open && children && <div className="ml-4 border-l pl-2">{children()}</div>}</div>
  }
  return <div className="flex flex-col gap-6">
    <PageHeader title="Explore" description="Browse the fields available from connected MonoRail sources." actions={<Button variant="outline" onClick={() => { setRevision((n) => n + 1); void catalog.refresh() }}><RefreshCw /> Refresh</Button>} />
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"><Search className="size-4 text-muted-foreground" /><Input className="min-w-48 flex-1" placeholder="Search names, fields and values" aria-label="Search catalog" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} /><select aria-label="Filter by source" className="rounded-md border bg-background px-3 py-2 text-sm" value={scope} onChange={(e) => { setScope(e.target.value); setPath([]); setPage(0) }}><option>All sources</option>{groups.map((g) => <option key={g}>{g}</option>)}</select><Button variant="ghost" onClick={() => { setQuery(''); setScope('All sources'); setPath([]); setPage(0) }}>Clear filters</Button></div>
    {(errors.length > 0 || catalog.error || cards.some((c) => c.truncated) || catalog.data?.truncated) && <div role="alert" className="rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-foreground">{[...errors, ...(catalog.error ? [`Agents: ${catalog.error.message}`] : []), ...(cards.some((c) => c.truncated) ? ['Some decks have more than 2,000 cards; only the first 2,000 per deck are shown.'] : []), ...(catalog.data?.truncated ? ['The subagent list is truncated.'] : [])].join(' ')}</div>}
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <section className="rounded-xl border bg-card p-4" aria-label="Browse estate">
        <div className="mb-1 flex items-center gap-2 font-semibold"><Compass className="size-4 text-primary" /> Browse estate</div>
        <p className="mb-4 text-xs text-muted-foreground">Available sources and their fields</p>
        <button className="mb-2 text-sm text-primary" onClick={() => choose([])}>All fields ({fields.length})</button>
        {groups.map((g) => node(g, [g], entries.filter((e) => e.group === g).length,
          () => types[g].map((t) => {
            const items = entries.filter((e) => e.group === g && e.type === t)
            return node(t, [g, t], items.length, () => items.map((e) =>
              node(e.name, [g, t, e.name], Object.keys(e.fields).length,
                () => Object.keys(e.fields).map((f) => node(f, [g, t, e.name, f], 1)))
            ))
          })
        ))}
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Includes subagents, note summaries, flashcards and the connected semantic project. Other MonoRail data is not yet indexed.</p>
        {project?.block && <p className="mt-2 text-xs text-muted-foreground">Semantic project unavailable: {project.block}. Set it up on Connections.</p>}
      </section>
      <section aria-label="Fields" className="min-w-0 rounded-xl border bg-card p-4"><div className="mb-4 flex justify-between gap-2 text-sm"><span className="font-medium">{path.join(' / ') || 'All fields'}</span><span className="text-muted-foreground">{visible.length} fields</span></div><div className="max-h-[70vh] space-y-2 overflow-auto">{pageFields.map((f) => <button key={f.id} onClick={() => setSelected(f.id)} className={cn('block w-full rounded-lg border p-4 text-left hover:bg-muted/50', active?.id === f.id && 'border-primary bg-primary/5')}><div className="truncate text-xs text-muted-foreground">{f.entry.group} / {f.entry.type} / {f.entry.name}</div><div className="mt-1 font-medium text-primary">{f.name}</div><div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{display(f.value)}</div></button>)}{visible.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{loading || catalog.loading ? 'Loading sources…' : 'No fields match this selection.'}</p>}</div>{visible.length > 100 && <div className="mt-4 flex items-center justify-between text-sm"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><span>Page {page + 1} of {Math.ceil(visible.length / 100)}</span><Button variant="outline" disabled={(page + 1) * 100 >= visible.length} onClick={() => setPage((p) => p + 1)}>Next</Button></div>}</section>
      <section aria-label="Field details" className="min-w-0 rounded-xl border bg-card p-4">{active ? <><div className="text-xs text-muted-foreground">FIELD DETAILS</div><h2 className="mt-2 break-words font-semibold">{active.name}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{active.entry.group} / {active.entry.type} / {active.entry.name}</p><div className="mt-4 border-t pt-4"><h3 className="text-sm font-medium">Value</h3><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{display(active.value)}</pre></div>{active.entry.description && <div className="mt-4 border-t pt-4"><h3 className="text-sm font-medium">About {active.entry.name}</h3><p className="mt-2 break-words text-sm text-muted-foreground">{active.entry.description}</p></div>}</> : <p className="text-sm text-muted-foreground">Select a field to inspect its value.</p>}</section>
    </div>
  </div>
}
