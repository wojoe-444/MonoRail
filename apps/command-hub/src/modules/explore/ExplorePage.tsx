import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Compass, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { isDesktop, invokeModule } from '@/modules/client'
import { useCatalog } from '@/modules/agent-catalog/api'
import { call as notesCall } from '@/modules/notes/api'
import { call as cardsCall } from '@/modules/flashcards/api'
import { call as flowsCall } from '@/modules/flows/api'
import { openWiki } from '@/modules/wiki/store'
import { takeExploreHandoff } from './handoff'
import type { FlowList } from '@/modules/flows/types'
import { sampleProject } from '@/modules/semantic/sample'
import type { SemanticProject } from '@/modules/semantic/types'
import type { NoteList } from '@/modules/notes/types'
import type { DeckList, CardList } from '@/modules/flashcards/types'
import { SECTIONS, STANDARD, allowedValues, categoriesIn, category, docsTarget, entityType, entityTypesIn, standardField, type EntityType } from '@/standard'

type Bookmark = { id: string; name: string; description: string; target: string; kind?: 'folder' | 'bookmark'; parentId?: string | null; color?: string }
type Prompt = { id: string; versions: { version: number; name: string; text: string; savedAt: string }[] }

/**
 * A MonoRail prompt template in the shape of OpenMetadata's promptTemplate
 * (MonoRail adopted that type in 2.1, see docs/standard/data-assets/ai/prompt-template.md).
 * The newest version is the template; every version's number, name and time go
 * in `extension`, OpenMetadata's place for fields of MonoRail's own.
 */
function promptTemplateRecord(p: Prompt) {
  const last = p.versions.at(-1)
  const name = last?.name || 'Untitled prompt'
  const savedAt = last ? Date.parse(last.savedAt) : NaN
  return {
    id: p.id, name, displayName: name, fullyQualifiedName: name,
    templateContent: last?.text ?? '',
    templateVersion: last ? String(last.version) : undefined,
    updatedAt: Number.isFinite(savedAt) ? savedAt : undefined,
    extension: { versions: p.versions.map((v) => ({ version: v.version, name: v.name, savedAt: v.savedAt })) },
  }
}
type ScheduledTask = { name: string; path: string; description: string; command: string; schedule: string; state: string; lastRun: string | null; nextRun: string | null; result: number | null; writable: boolean }

/** One item of one entity type in the MonoRail standard (src/standard), with its fields flattened. */
type Entry = { category: string; type: string; name: string; description?: string; fields: Record<string, unknown> }
type Field = { id: string; entry: Entry; name: string; value: unknown }
const display = (v: unknown): string => v == null || v === '' ? 'Not set' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)
function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (value && typeof value === 'object') {
    const parts = Object.entries(value)
    if (parts.length) return Object.assign({}, ...parts.map(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key)))
  }
  return { [prefix]: value }
}
/** An entry of a standard entity type; its category comes from the standard, so Explore never invents one. */
function entry(type: string, name: string, fields: object, description?: string): Entry {
  const def = entityType(type)
  if (!def) throw new Error(`"${type}" is not an entity type in the MonoRail standard.`)
  return { category: def.category, type, name, fields: flatten(fields), description }
}
const openStandard = (def: EntityType) => { const t = docsTarget(def.docs); openWiki(t.id, t.anchor) }

/**
 * OpenMetadata's Database, Database Schema and Table, from the tables the
 * semantic project's models read. The manifest does not name the service,
 * so `service` stays unset and full names start at the database.
 */
function databaseEntries(project?: SemanticProject): Entry[] {
  const ref = (type: string, fullyQualifiedName: string, name: string) => ({ type, name, fullyQualifiedName })
  const databases = new Map<string, Set<string>>()
  const schemas = new Map<string, { database?: string; name: string; tables: Set<string> }>()
  const tables = new Map<string, { relation: { database?: string; schema?: string; name: string }; models: string[] }>()
  for (const m of project?.models ?? []) {
    const r = m.relation
    if (!r) continue
    const tableFqn = [r.database, r.schema, r.name].filter(Boolean).join('.')
    const t = tables.get(tableFqn) ?? { relation: r, models: [] }
    t.models.push(m.name)
    tables.set(tableFqn, t)
    if (r.schema) {
      const schemaFqn = [r.database, r.schema].filter(Boolean).join('.')
      const s = schemas.get(schemaFqn) ?? { database: r.database, name: r.schema, tables: new Set() }
      s.tables.add(tableFqn)
      schemas.set(schemaFqn, s)
      if (r.database) databases.set(r.database, (databases.get(r.database) ?? new Set()).add(schemaFqn))
    } else if (r.database && !databases.has(r.database)) databases.set(r.database, new Set())
  }
  const leaf = (fqn: string) => fqn.split('.').at(-1) ?? fqn
  return [
    ...[...databases].map(([name, schemaFqns]) => entry('database', name, {
      name, fullyQualifiedName: name,
      databaseSchemas: [...schemaFqns].map((f) => ref('databaseSchema', f, leaf(f))),
    }, 'A database the semantic project reads tables from.')),
    ...[...schemas].map(([fqn, s]) => entry('databaseSchema', s.name, {
      name: s.name, fullyQualifiedName: fqn,
      ...(s.database ? { database: ref('database', s.database, s.database) } : {}),
      tables: [...s.tables].map((f) => ref('table', f, leaf(f))),
    }, 'A schema the semantic project reads tables from.')),
    ...[...tables].map(([fqn, { relation: r, models }]) => entry('table', r.name, {
      name: r.name, fullyQualifiedName: fqn, columns: [],
      ...(r.database ? { database: ref('database', r.database, r.database) } : {}),
      ...(r.schema ? { databaseSchema: ref('databaseSchema', [r.database, r.schema].filter(Boolean).join('.'), r.schema) } : {}),
    }, `Read by the semantic model${models.length > 1 ? 's' : ''} ${models.join(', ')}.`)),
  ]
}

type CatalogTable = { name: string; tableType?: string; description?: string; deleted?: boolean; columns?: object[]; profile?: object; tags?: string[]; extension?: object }
type IngestionExplore = {
  services: { kind: string; name: string; displayName: string; category: string; serviceType: string }[]
  pipelines: ({ name: string; displayName?: string; description?: string } & Record<string, unknown>)[]
  catalog: Record<string, { serviceType?: string; updatedAt?: string; databases?: { name: string; schemas?: { name: string; tables?: CatalogTable[] }[] }[]; lineage?: { from: string; to: string }[] }>
}

/**
 * Services, ingestion pipelines and what the pipelines read (Settings >
 * Services). Local catalog tables get full names that start at the service,
 * as in OpenMetadata: service.database.schema.table.
 */
function ingestionEntries(data?: IngestionExplore): Entry[] {
  if (!data) return []
  const ref = (type: string, fullyQualifiedName: string, name: string) => ({ type, name, fullyQualifiedName })
  const out: Entry[] = []
  for (const s of data.services) {
    out.push(entry(s.category, s.displayName, { name: s.name, fullyQualifiedName: s.name, displayName: s.displayName, serviceType: s.serviceType, extension: { monorail: { runsOn: 'this PC', connection: s.kind } } }, `A data source on this PC (${s.serviceType}).`))
  }
  for (const p of data.pipelines) out.push(entry('ingestionPipeline', p.displayName || p.name, p, p.description || 'An ingestion pipeline that runs on this PC.'))
  for (const [service, svc] of Object.entries(data.catalog ?? {})) {
    // svc.lineage: the local database's lineage table between this service's tables, as { from, to } table keys
    // (the backend falls back to the field older versions kept on the service). The edges themselves are on
    // the OpenMetadata page's Lineage tab; here each table lists its neighbours by full name.
    const upstream = new Map<string, string[]>()
    const downstream = new Map<string, string[]>()
    for (const e of svc.lineage ?? []) {
      upstream.set(e.to, [...(upstream.get(e.to) ?? []), e.from])
      downstream.set(e.from, [...(downstream.get(e.from) ?? []), e.to])
    }
    for (const db of svc.databases ?? []) {
      const dbFqn = `${service}.${db.name}`
      out.push(entry('database', db.name, { name: db.name, fullyQualifiedName: dbFqn, service: ref('databaseService', service, service), databaseSchemas: (db.schemas ?? []).map((s) => ref('databaseSchema', `${dbFqn}.${s.name}`, s.name)) }, `Read by an ingestion pipeline from ${service}.`))
      for (const sc of db.schemas ?? []) {
        const scFqn = `${dbFqn}.${sc.name}`
        out.push(entry('databaseSchema', sc.name, { name: sc.name, fullyQualifiedName: scFqn, service: ref('databaseService', service, service), database: ref('database', dbFqn, db.name), tables: (sc.tables ?? []).map((t) => ref('table', `${scFqn}.${t.name}`, t.name)) }, `Read by an ingestion pipeline from ${service}.`))
        for (const t of sc.tables ?? []) {
          const key = `${db.name}.${sc.name}.${t.name}`
          const up = upstream.get(key)
          const down = downstream.get(key)
          const lineage = up || down ? { ...(up ? { upstream: up.map((u) => `${service}.${u}`) } : {}), ...(down ? { downstream: down.map((d) => `${service}.${d}`) } : {}) } : undefined
          out.push(entry('table', t.name, {
            name: t.name, fullyQualifiedName: `${scFqn}.${t.name}`, tableType: t.tableType, description: t.description, deleted: t.deleted || undefined,
            columns: t.columns ?? [], profile: t.profile, tags: t.tags,
            service: ref('databaseService', service, service), database: ref('database', dbFqn, db.name), databaseSchema: ref('databaseSchema', scFqn, sc.name),
            ...(lineage || t.extension ? { extension: { ...t.extension, ...(lineage ? { lineage } : {}) } } : {}),
          }, t.description || `Read by an ingestion pipeline from ${service}${t.deleted ? '; no longer in the source' : ''}.`))
        }
      }
    }
  }
  return out
}

type BigQueryEntity = Record<string, unknown> & { entityType: string; name?: string; displayName?: string; fullyQualifiedName?: string; description?: string }
type BigQueryExplore = { setUp?: boolean; source?: string; synced?: boolean; entities: BigQueryEntity[]; total: number; truncated?: boolean }

/**
 * Every entity in the copy of the BigQuery metadata dataset (the source of
 * truth, when it is set up), as OpenMetadata stores it. Types the standard
 * does not have are left out.
 */
function bigQueryEntries(data?: BigQueryExplore): Entry[] {
  if (!data?.entities.length) return []
  const out: Entry[] = []
  for (const { entityType: type, ...json } of data.entities) {
    if (!entityType(type)) continue
    const name = json.displayName || json.name || json.fullyQualifiedName || 'Unnamed'
    const about = typeof json.description === 'string' && json.description.trim() ? json.description.trim().split(/\r?\n/)[0] : `In the BigQuery metadata dataset ${data.source}.`
    out.push(entry(type, String(name), json, about))
  }
  return out
}

export default function ExplorePage() {
  const catalog = useCatalog()
  const [notes, setNotes] = useState<NoteList>()
  const [decks, setDecks] = useState<DeckList>()
  const [cards, setCards] = useState<CardList[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [flows, setFlows] = useState<FlowList>()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [project, setProject] = useState<SemanticProject>()
  const [ingestion, setIngestion] = useState<IngestionExplore>()
  const [bigquery, setBigquery] = useState<BigQueryExplore>()
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  /** A category id, or '' for all. */
  const [scope, setScope] = useState('')
  /** The entity type the command palette asked for, if Explore was opened from there. */
  const [handoff] = useState(() => { const t = takeExploreHandoff(); const def = t ? entityType(t) : undefined; return def ? [def.category, def.type] : undefined })
  /** [category id, entity type, entry index, field name], as deep as chosen. */
  const [path, setPath] = useState<string[]>(() => handoff ?? [])
  const [expanded, setExpanded] = useState<string[]>(() => handoff ? [JSON.stringify([handoff[0]])] : [])
  const [selected, setSelected] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    let live = true
    // oxlint-disable-next-line react/set-state-in-effect -- Set the loading state before requesting the workspace records.
    setLoading(true)
    void Promise.allSettled([
      notesCall<NoteList>('list'),
      cardsCall<DeckList>('listDecks').then(async (d) => ({ d, cards: await Promise.all(d.decks.map((deck) => cardsCall<CardList>('listCards', { deckId: deck.id }))) })),
      isDesktop() ? invokeModule<SemanticProject>('semantic', 'getProject') : Promise.resolve(sampleProject),
      isDesktop() ? invokeModule<Bookmark[]>('bookmarks', 'list') : Promise.resolve([]),
      flowsCall<FlowList>('list'),
      isDesktop() ? invokeModule<Prompt[]>('prompt-templates', 'list') : Promise.resolve([]),
      isDesktop() ? invokeModule<{ tasks: ScheduledTask[] }>('scheduled', 'list') : Promise.resolve({ tasks: [] }),
      isDesktop() ? invokeModule<IngestionExplore>('ingestion', 'explore') : Promise.resolve(undefined),
      isDesktop() ? invokeModule<BigQueryExplore>('openmetadata', 'explore') : Promise.resolve(undefined),
    ]).then(([n, c, p, b, f, t, s, g, q]) => {
      if (!live) return
      const failures: string[] = []
      if (n.status === 'fulfilled') setNotes(n.value); else { setNotes(undefined); failures.push(`Notes: ${String(n.reason)}`) }
      if (c.status === 'fulfilled') { setDecks(c.value.d); setCards(c.value.cards) } else { setDecks(undefined); setCards([]); failures.push(`Flashcards: ${String(c.reason)}`) }
      if (p.status === 'fulfilled') setProject(p.value); else { setProject(undefined); failures.push(`Semantic: ${String(p.reason)}`) }
      if (b.status === 'fulfilled') setBookmarks(b.value); else { setBookmarks([]); failures.push('Bookmarks: ' + String(b.reason)) }
      if (f.status === 'fulfilled') setFlows(f.value); else { setFlows(undefined); failures.push('Flows: ' + String(f.reason)) }
      if (t.status === 'fulfilled') setPrompts(t.value); else { setPrompts([]); failures.push('Prompts: ' + String(t.reason)) }
      if (s.status === 'fulfilled') setTasks(s.value.tasks); else { setTasks([]); failures.push('Scheduled tasks: ' + String(s.reason)) }
      if (g.status === 'fulfilled') setIngestion(g.value); else { setIngestion(undefined); failures.push('Services: ' + String(g.reason)) }
      if (q.status === 'fulfilled') setBigquery(q.value); else { setBigquery(undefined); failures.push('BigQuery metadata: ' + String(q.reason)) }
      setErrors(failures); setLoading(false)
    })
    return () => { live = false }
  }, [revision])

  const entries = useMemo(() => [
    ...(catalog.data?.subagents ?? []).map((s) => entry('subagent', s.name, s, s.description)),
    ...(flows?.flows ?? []).map((f) => entry('flow', f.name, f, f.description)),
    ...prompts.map((p) => { const rec = promptTemplateRecord(p); return entry('promptTemplate', rec.name, rec) }),
    ...(notes?.notes ?? []).map((n) => entry('note', n.title, n, n.excerpt)),
    ...bookmarks.map((b) => entry(b.kind === 'folder' ? 'bookmarkFolder' : 'bookmark', b.name, b, b.description)),
    ...tasks.map((t) => entry('scheduledTask', t.name, t, t.description)),
    ...(decks?.decks ?? []).map((d) => entry('flashcardDeck', d.name, d, d.description)),
    ...cards.flatMap((list) => list.cards.map((c) => entry('flashcard', c.front || 'Untitled card', c, `${list.deck.name}: ${c.back}`))),
    ...(project?.models ?? []).map((m) => entry('semanticModel', m.name, m, m.description)),
    ...(project?.metrics ?? []).map((m) => entry('semanticMetric', m.name, m, m.description)),
    ...(project?.savedQueries ?? []).map((s) => entry('savedQuery', s.name, s, s.description)),
    ...databaseEntries(project),
    ...ingestionEntries(ingestion),
    ...bigQueryEntries(bigquery),
  ], [catalog.data, notes, decks, cards, project, bookmarks, flows, prompts, tasks, ingestion, bigquery])
  const fields = useMemo<Field[]>(() => entries.flatMap((e, i) => Object.entries(e.fields).map(([name, value]) => ({ id: `${i}:${name}`, entry: e, name, value }))), [entries])
  const visible = fields.filter((f) => (!scope || f.entry.category === scope) && (!path[0] || f.entry.category === path[0]) && (!path[1] || f.entry.type === path[1]) && (!path[2] || String(entries.indexOf(f.entry)) === path[2]) && (!path[3] || f.name === path[3]) && `${f.entry.category} ${f.entry.type} ${f.entry.name} ${f.name} ${display(f.value)}`.toLowerCase().includes(query.toLowerCase()))
  const pageFields = visible.slice(page * 100, (page + 1) * 100)
  const active = pageFields.find((f) => f.id === selected) ?? pageFields[0]
  const chosenType = path[1] ? entityType(path[1]) : undefined
  const label = (e: Entry) => `${category(e.category)?.name ?? e.category} / ${entityType(e.type)?.plural ?? e.type} / ${e.name}`
  const toggle = (key: string) => setExpanded((x) => x.includes(key) ? x.filter((v) => v !== key) : [...x, key])
  const choose = (p: string[]) => { setPath(p); setScope(''); setSelected(''); setPage(0) }
  const node = (text: string, p: string[], count: number, children?: () => React.ReactNode) => {
    const key = JSON.stringify(p); const open = expanded.includes(key)
    return <div key={key}><div className={cn('flex items-center rounded-md text-sm hover:bg-muted', JSON.stringify(path) === key && 'bg-primary/10 text-primary')}>
      <button type="button" className="p-1" aria-label={`${open ? 'Collapse' : 'Expand'} ${text}`} onClick={() => toggle(key)}>{children ? open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="block size-4" />}</button>
      <button type="button" className="min-w-0 flex-1 truncate py-1 text-left" onClick={() => choose(p)}>{text}</button><span className="px-2 text-xs text-muted-foreground">{count}</span></div>{open && children && <div className="ml-4 border-l pl-2">{children()}</div>}</div>
  }
  const typeCard = (def: EntityType) => <>
    <div className="text-xs text-muted-foreground">ENTITY TYPE</div>
    <h2 className="mt-2 break-words font-semibold">{def.name}</h2>
    <div className="mt-2 flex flex-wrap gap-1.5"><Badge variant={def.origin === 'openmetadata' ? 'info' : 'primary'}>{def.origin === 'openmetadata' ? `OpenMetadata ${STANDARD.openMetadata.version}` : 'MonoRail'}</Badge><Badge variant="outline" className="font-mono">{def.type}</Badge></div>
    <p className="mt-3 text-sm text-muted-foreground">{def.summary}</p>
    <p className="mt-2 text-sm text-muted-foreground">{def.fields.length} fields in the standard.</p>
    <Button variant="outline" size="sm" className="mt-4" onClick={() => openStandard(def)}><BookOpen /> {def.name} in the standard</Button>
  </>
  const activeType = active ? entityType(active.entry.type) : undefined
  const activeField = active ? standardField(active.entry.type, active.name) : undefined

  return <div className="flex flex-col gap-6">
    <PageHeader title="Explore" description="Browse everything MonoRail knows, sorted by the MonoRail standard." actions={<Button variant="outline" onClick={() => { setPath([]); setExpanded([]); setSelected(''); setPage(0); setRevision((n) => n + 1); void catalog.refresh() }}><RefreshCw /> Refresh</Button>} />
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"><Search className="size-4 text-muted-foreground" /><Input className="min-w-48 flex-1" placeholder="Search names, fields and values" aria-label="Search catalog" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} /><select aria-label="Filter by category" className="rounded-md border bg-background px-3 py-2 text-sm" value={scope} onChange={(e) => { setScope(e.target.value); setPath([]); setPage(0) }}><option value="">All categories</option>{SECTIONS.map((s) => <optgroup key={s.id} label={s.name}>{categoriesIn(s.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}</select><Button variant="ghost" onClick={() => { setQuery(''); setScope(''); setPath([]); setPage(0) }}>Clear filters</Button></div>
    {(errors.length > 0 || catalog.error || cards.some((c) => c.truncated) || catalog.data?.truncated || bigquery?.truncated) && <div role="alert" className="rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-foreground">{[...errors, ...(catalog.error ? [`Agents: ${catalog.error.message}`] : []), ...(cards.some((c) => c.truncated) ? ['Some decks have more than 2,000 cards; only the first 2,000 per deck are shown.'] : []), ...(catalog.data?.truncated ? ['The subagent list is truncated.'] : []), ...(bigquery?.truncated ? [`Only the first ${bigquery.entities.length.toLocaleString()} of ${bigquery.total.toLocaleString()} entities from BigQuery are shown; the OpenMetadata page has them all.`] : [])].join(' ')}</div>}
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <section className="rounded-xl border bg-card p-4" aria-label="Browse estate">
        <div className="mb-1 flex items-center gap-2 font-semibold"><Compass className="size-4 text-primary" /> Browse estate</div>
        <p className="mb-4 text-xs text-muted-foreground">Categories and entity types of the MonoRail standard</p>
        <button className="mb-2 text-sm text-primary" onClick={() => choose([])}>All fields ({fields.length})</button>
        {SECTIONS.map((s) => <div key={s.id} role="group" aria-label={s.name}>
          <div className="mt-3 mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.name}</div>
          {categoriesIn(s.id).map((c) => node(c.name, [c.id], entries.filter((e) => e.category === c.id).length,
            () => entityTypesIn(c.id).map((t) => {
              const items = entries.filter((e) => e.type === t.type)
              return node(t.plural, [c.id, t.type], items.length, () => items.map((e) =>
                node(e.name, [c.id, t.type, String(entries.indexOf(e))], Object.keys(e.fields).length,
                  () => Object.keys(e.fields).map((f) => node(f, [c.id, t.type, String(entries.indexOf(e)), f], 1)))
              ))
            })
          ))}
        </div>)}
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Sorted by the MonoRail standard: every OpenMetadata {STANDARD.openMetadata.version} entity type plus MonoRail&apos;s own. Databases are the tables your semantic project&apos;s models read and what ingestion pipelines on this PC read (Settings &gt; Services); prompt templates are listed under AI assets. When a BigQuery dataset is the source of truth, its entities are listed too, from the copy on this PC. Your OpenMetadata server&apos;s own entities are on the OpenMetadata page. Other MonoRail data is not yet indexed.</p>
        <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => openWiki('standard/README')}>Read the standard</Button>
        {project?.block && <p className="mt-2 text-xs text-muted-foreground">Semantic project unavailable: {project.block}. Set it up on Connections.</p>}
      </section>
      <section aria-label="Fields" className="min-w-0 rounded-xl border bg-card p-4"><div className="mb-4 flex justify-between gap-2 text-sm"><span className="font-medium">{[...(path[0] ? [category(path[0])?.name ?? path[0]] : []), ...(chosenType ? [chosenType.plural] : []), ...(path[2] ? [entries[Number(path[2])]?.name ?? ''] : []), ...path.slice(3)].join(' / ') || 'All fields'}</span><span className="text-muted-foreground">{visible.length} fields</span></div><div className="max-h-[70vh] space-y-2 overflow-auto">{pageFields.map((f) => <button key={f.id} onClick={() => setSelected(f.id)} className={cn('block w-full rounded-lg border p-4 text-left hover:bg-muted/50', active?.id === f.id && 'border-primary bg-primary/5')}><div className="truncate text-xs text-muted-foreground">{label(f.entry)}</div><div className="mt-1 font-medium text-primary">{f.name}</div><div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{display(f.value)}</div></button>)}{visible.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">{loading || catalog.loading ? 'Loading sources…' : chosenType && !entries.some((e) => e.type === chosenType.type) ? `No ${chosenType.plural.toLowerCase()} yet. No MonoRail source has given Explore any so far.` : 'No fields match this selection.'}</p>}</div>{visible.length > 100 && <div className="mt-4 flex items-center justify-between text-sm"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><span>Page {page + 1} of {Math.ceil(visible.length / 100)}</span><Button variant="outline" disabled={(page + 1) * 100 >= visible.length} onClick={() => setPage((p) => p + 1)}>Next</Button></div>}</section>
      <section aria-label="Field details" className="min-w-0 rounded-xl border bg-card p-4">{active && activeType ? <>
        <div className="text-xs text-muted-foreground">FIELD DETAILS</div><h2 className="mt-2 break-words font-semibold">{active.name}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{label(active.entry)}</p>
        <div className="mt-4 border-t pt-4"><h3 className="text-sm font-medium">Value</h3><pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{display(active.value)}</pre></div>
        <div className="mt-4 border-t pt-4"><h3 className="text-sm font-medium">In the standard</h3>{activeField ? <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge variant="outline" className="font-mono">{activeField.name}: {activeField.type}</Badge>{activeField.required && <Badge variant="secondary">Required</Badge>}</div>
          <p className="mt-2 break-words text-sm text-muted-foreground">{activeField.description}</p>
          {allowedValues(activeField.type) && <div className="mt-3"><h4 className="text-xs font-medium text-muted-foreground">Allowed values</h4><div className="mt-1.5 flex flex-wrap gap-1.5">{allowedValues(activeField.type)!.map((v) => <Badge key={v.value} variant={v.origin === 'monorail' ? 'secondary' : 'outline'} className="font-mono" title={v.origin === 'monorail' ? `Added by MonoRail: ${v.summary}` : 'OpenMetadata'}>{v.value}{v.origin === 'monorail' ? ' · MonoRail' : ''}</Badge>)}</div></div>}
        </> :<p className="mt-2 text-sm text-muted-foreground">Not a field of {activeType.name} in the standard.</p>}
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => openStandard(activeType)}><BookOpen /> {activeType.name} in the standard</Button></div>
        {active.entry.description && <div className="mt-4 border-t pt-4"><h3 className="text-sm font-medium">About {active.entry.name}</h3><p className="mt-2 break-words text-sm text-muted-foreground">{active.entry.description}</p></div>}
      </> : chosenType ? typeCard(chosenType) : <p className="text-sm text-muted-foreground">Select a field to inspect its value.</p>}</section>
    </div>
  </div>
}
