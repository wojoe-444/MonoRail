import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, ClipboardPaste, Copy, FileCode2, FolderPlus, Loader2, MoreHorizontal, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { hasLocalScreen, isDesktop } from '@/modules/client'
import { ConfirmDialog } from '@/modules/flashcards/dialogs'

import { call, errorText } from './api'
import { ConfigForm } from './ConfigForm'
import { ColumnsTable, TestsForm } from './ConfigTabs'
import { countColumns, countTests } from './config-values'
import type { Section } from './fields'
import {
  addBlock,
  buildSqlx,
  findBlock,
  formatConfigInner,
  getBody,
  getEntry,
  parseConfig,
  parseSqlx,
  references,
  removeBlock,
  setBlockInner,
  setBody,
  stringOf,
  type BlockKind,
  type ObjectValue,
  type SqlxFile,
} from './parse'
import { SqlxCode } from './SqlxCode'
import type { SqlxFileContent, SqlxFileEntry, SqlxFileList, SqlxProject, SqlxSaved } from './types'

type Source = { kind: 'project'; projectId: string; path: string } | { kind: 'scratch'; name: string }

interface Doc {
  source: Source
  original: string
  mtimeMs?: number
  file: SqlxFile
}

const TYPE_TONE: Record<string, 'primary' | 'info' | 'success' | 'warning' | 'secondary'> = {
  table: 'primary',
  incremental: 'info',
  view: 'success',
  assertion: 'warning',
  operations: 'secondary',
  declaration: 'secondary',
}

const BLOCK_LABEL: Record<Exclude<BlockKind, 'config'>, { title: string; hint: string; language: 'sql' | 'javascript' }> = {
  js: { title: 'JavaScript', hint: 'Constants and functions this file’s SQL can use.', language: 'javascript' },
  pre_operations: { title: 'Before the query', hint: 'pre_operations: statements run first.', language: 'sql' },
  post_operations: { title: 'After the query', hint: 'post_operations: statements run last.', language: 'sql' },
}

const fileName = (p: string) => p.split('/').pop() ?? p
const baseName = (p: string) => fileName(p).replace(/\.sqlx$/i, '')
const sameSource = (a: Source | undefined, b: Source) =>
  !!a && a.kind === b.kind && (a.kind === 'scratch' ? b.kind === 'scratch' && a.name === b.name : b.kind === 'project' && a.projectId === b.projectId && a.path === b.path)

/**
 * SQLX (electron/modules/sqlx.cjs): Dataform .sqlx files in tabs: the query,
 * the config block spread over Settings, Columns and Tests, the extra blocks,
 * and the raw file for anything else. Files come
 * from project folders picked in the system dialog, or are dropped or pasted
 * in (those can be copied but not saved).
 */
export default function SqlxPage() {
  const [projects, setProjects] = useState<SqlxProject[]>()
  const [projectId, setProjectId] = useState<string>()
  const [list, setList] = useState<SqlxFileList>()
  const [query, setQuery] = useState('')
  const [doc, setDoc] = useState<Doc>()
  const [tab, setTab] = useState<EditorTab>('query')
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState<'open' | 'save'>()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState<() => void>()
  const [dragging, setDragging] = useState(false)

  const project = projects?.find((p) => p.id === projectId)
  const text = doc ? buildSqlx(doc.file) : ''
  const dirty = !!doc && text !== doc.original

  const loadProjects = useCallback(async (select?: string) => {
    try {
      const ps = await call<SqlxProject[]>('listProjects')
      setProjects(ps)
      setProjectId((cur) => select ?? (ps.some((p) => p.id === cur) ? cur : ps[0]?.id))
    } catch (e) {
      setError(errorText(e))
    }
  }, [])

  useEffect(() => void loadProjects(), [loadProjects])

  const loadFiles = useCallback(async () => {
    if (!projectId) return setList(undefined)
    try {
      setList(await call<SqlxFileList>('listFiles', { projectId }))
    } catch (e) {
      setList({ files: [], truncated: false })
      setError(errorText(e))
    }
  }, [projectId])

  useEffect(() => void loadFiles(), [loadFiles])

  /** Run `fn` now, or after the user agrees to drop unsaved changes. */
  const guard = (fn: () => void) => (dirty ? setPending(() => fn) : fn())

  async function openFile(entry: SqlxFileEntry) {
    if (!projectId) return
    const source: Source = { kind: 'project', projectId, path: entry.path }
    if (sameSource(doc?.source, source)) return
    guard(async () => {
      setBusy('open')
      try {
        const r = await call<SqlxFileContent>('readFile', { projectId, path: entry.path })
        setDoc({ source, original: r.text, mtimeMs: r.mtimeMs, file: parseSqlx(r.text) })
        setError(undefined)
        setConflict(false)
      } catch (e) {
        setError(errorText(e))
      } finally {
        setBusy(undefined)
      }
    })
  }

  function openScratch(name: string, content: string) {
    guard(() => {
      setDoc({ source: { kind: 'scratch', name }, original: content, file: parseSqlx(content) })
      setError(undefined)
      setConflict(false)
    })
  }

  async function reload() {
    if (doc?.source.kind !== 'project') return
    const { projectId: pid, path } = doc.source
    try {
      const r = await call<SqlxFileContent>('readFile', { projectId: pid, path })
      setDoc({ source: doc.source, original: r.text, mtimeMs: r.mtimeMs, file: parseSqlx(r.text) })
      setConflict(false)
      setError(undefined)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const save = useCallback(async () => {
    if (!doc || doc.source.kind !== 'project' || !dirty || busy) return
    setBusy('save')
    try {
      const r = await call<SqlxSaved>('saveFile', { projectId: doc.source.projectId, path: doc.source.path, text, mtimeMs: doc.mtimeMs })
      setDoc((d) => d && { ...d, original: text, mtimeMs: r.mtimeMs })
      setError(undefined)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      const msg = errorText(e)
      setError(msg)
      setConflict(/changed on disk/.test(msg))
    } finally {
      setBusy(undefined)
    }
  }, [doc, dirty, busy, text])

  // Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // Leaving the window with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [dirty])

  async function addProject() {
    try {
      const p = await call<SqlxProject | null>('addProject')
      if (p) await loadProjects(p.id)
    } catch (e) {
      setError(errorText(e))
    }
  }

  async function removeProject() {
    if (!projectId) return
    try {
      await call('removeProject', { id: projectId })
      if (doc?.source.kind === 'project' && doc.source.projectId === projectId) setDoc(undefined)
      setProjectId(undefined)
      await loadProjects()
    } catch (e) {
      setError(errorText(e))
    }
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText()
      if (t.trim()) openScratch('Pasted.sqlx', t)
    } catch {
      setError('MonoRail could not read the clipboard.')
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (!/\.sqlx$/i.test(f.name) && !/\.sql$/i.test(f.name)) return setError('Drop a .sqlx file.')
    if (f.size > 2 * 1024 * 1024) return setError('That file is larger than 2 MB.')
    void f.text().then((t) => openScratch(f.name, t))
  }

  const openRef = (name: string) => {
    const entry = list?.files.find((f) => baseName(f.path) === name)
    if (entry) void openFile(entry)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-6"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title="SQLX"
        description={
          isDesktop()
            ? 'Dataform files with the query and its settings in tabs, so you never edit the config as code. Files stay where they are; saving writes them in place.'
            : 'A sample Dataform project: saves stay in the browser tab.'
        }
        actions={
          <>
            <Button variant="outline" onClick={paste}>
              <ClipboardPaste /> Paste SQLX
            </Button>
            {hasLocalScreen() && (
              <Button onClick={addProject}>
                <FolderPlus /> Add project
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive-soft px-4 py-2.5 text-sm text-destructive-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {conflict && (
            <Button size="sm" variant="outline" onClick={reload}>
              Reload from disk
            </Button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => setError(undefined)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <Card
        className={cn(
          'relative grid min-h-[600px] flex-1 grid-cols-1 gap-0 overflow-hidden py-0 lg:grid-cols-[260px_minmax(0,1fr)]',
          dragging && 'ring-2 ring-primary',
        )}
      >
        <FileList
          projects={projects}
          project={project}
          onProject={(id) => setProjectId(id)}
          onRemoveProject={removeProject}
          onAddProject={hasLocalScreen() ? addProject : undefined}
          list={list}
          query={query}
          onQuery={setQuery}
          open={doc?.source}
          dirty={dirty}
          onOpen={openFile}
        />
        {doc ? (
          <Editor
            doc={doc}
            core={project?.core ?? null}
            tab={tab}
            onTab={setTab}
            onChange={(file) => setDoc((d) => d && { ...d, file })}
            dirty={dirty}
            busy={busy}
            saved={saved}
            copied={copied}
            onSave={save}
            onRevert={() => setDoc((d) => d && { ...d, file: parseSqlx(d.original) })}
            onCopy={copy}
            onClose={() => guard(() => setDoc(undefined))}
            onOpenRef={openRef}
            knownRefs={new Set(list?.files.map((f) => baseName(f.path)))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            {busy === 'open' ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                  <FileCode2 className="size-6" />
                </div>
                <p className="text-base font-semibold">Open a .sqlx file</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {projects?.length ? 'Pick a file on the left' : 'Add a Dataform project folder'}, drop a file here, or paste one from the clipboard.
                </p>
              </>
            )}
          </div>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-medium">Drop a .sqlx file to open it</div>
        )}
      </Card>

      <ConfirmDialog
        open={!!pending}
        title="Discard your changes?"
        body="This file has changes you have not saved. They will be lost."
        action="Discard"
        onClose={() => setPending(undefined)}
        onConfirm={async () => {
          const fn = pending
          setPending(undefined)
          setDoc((d) => d && { ...d, file: parseSqlx(d.original) })
          fn?.()
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left: projects and files

function FileList(props: {
  projects?: SqlxProject[]
  project?: SqlxProject
  onProject: (id: string) => void
  onRemoveProject: () => void
  onAddProject?: () => void
  list?: SqlxFileList
  query: string
  onQuery: (q: string) => void
  open?: Source
  dirty: boolean
  onOpen: (f: SqlxFileEntry) => void
}) {
  const { projects, project, list, query, open } = props
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const files = (list?.files ?? []).filter((f) => !q || f.path.toLowerCase().includes(q))
    const map = new Map<string, SqlxFileEntry[]>()
    for (const f of files) {
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')).replace(/^definitions\/?/, '') : ''
      map.set(dir, [...(map.get(dir) ?? []), f])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [list, query])

  return (
    <aside className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
      <div className="flex flex-col gap-2 border-b p-3">
        {projects && projects.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <NativeSelect className="min-w-0 flex-1" aria-label="Project" value={project?.id ?? ''} onChange={(e) => props.onProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            {isDesktop() && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Project actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {props.onAddProject && (
                    <DropdownMenuItem onSelect={props.onAddProject}>
                      <FolderPlus /> Add another project
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={props.onRemoveProject}>
                    <Trash2 /> Remove from the list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : (
          projects && (
            <p className="text-sm text-muted-foreground">
              No projects yet.{' '}
              {props.onAddProject && (
                <button type="button" className="font-medium text-primary hover:underline" onClick={props.onAddProject}>
                  Add a folder
                </button>
              )}
            </p>
          )
        )}
        {project && !project.dataform && <p className="text-xs text-warning-soft-foreground">This folder has no workflow_settings.yaml or definitions folder.</p>}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => props.onQuery(e.target.value)} placeholder="Find a file" className="pl-9" aria-label="Find a file" />
        </div>
      </div>
      <nav aria-label="Files" className="min-h-0 flex-1 overflow-y-auto py-2">
        {open?.kind === 'scratch' && (
          <div className="px-2 pb-2">
            <div className="flex items-center gap-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-sm font-medium">
              <ClipboardPaste className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{open.name}</span>
              {props.dirty && <span className="ml-auto size-2 shrink-0 rounded-full bg-warning" aria-label="Unsaved" />}
            </div>
          </div>
        )}
        {groups.map(([dir, files]) => (
          <div key={dir} className="pb-2">
            {dir && <div className="truncate px-4 pt-2 pb-1 text-xs font-medium text-muted-foreground">{dir}</div>}
            {files.map((f) => {
              const active = open?.kind === 'project' && open.path === f.path && open.projectId === project?.id
              return (
                <button
                  key={f.path}
                  type="button"
                  title={f.path}
                  onClick={() => props.onOpen(f)}
                  className={cn(
                    'mx-2 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    active ? 'bg-primary-soft font-medium text-primary-soft-foreground' : 'hover:bg-muted',
                  )}
                >
                  <FileCode2 className="size-4 shrink-0 opacity-60" />
                  <span className="truncate">{baseName(f.path)}</span>
                  {active && props.dirty && <span className="ml-auto size-2 shrink-0 rounded-full bg-warning" aria-label="Unsaved" />}
                </button>
              )
            })}
          </div>
        ))}
        {list && groups.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{query ? 'No file matches.' : 'No .sqlx files in this folder.'}</p>}
        {list?.truncated && <p className="px-4 py-2 text-xs text-muted-foreground">Showing the first 5,000 files.</p>}
      </nav>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Right: the open file, in tabs

export type EditorTab = 'query' | 'settings' | 'columns' | 'tests' | 'blocks' | 'raw'

const SETTINGS_SECTIONS: Section[] = ['Target', 'About', 'Run', 'BigQuery', 'More']

function Editor(props: {
  doc: Doc
  core: 2 | 3 | null
  tab: EditorTab
  onTab: (t: EditorTab) => void
  onChange: (file: SqlxFile) => void
  dirty: boolean
  busy?: 'open' | 'save'
  saved: boolean
  copied: boolean
  onSave: () => void
  onRevert: () => void
  onCopy: () => void
  onClose: () => void
  onOpenRef: (name: string) => void
  knownRefs: Set<string>
}) {
  const { doc, tab, onChange } = props
  const file = doc.file
  const configBlock = findBlock(file, 'config')
  const config = useMemo(() => (configBlock ? parseConfig(configBlock.inner) : undefined), [configBlock])
  const body = getBody(file)
  const refs = useMemo(() => references(body.sql), [body.sql])
  const configObj = config?.ok ? config.value : undefined
  const type = stringOf(getEntry(configObj, 'type'))
  const description = stringOf(getEntry(configObj, 'description'))
  const pathName = doc.source.kind === 'project' ? doc.source.path : doc.source.name
  const name = stringOf(getEntry(configObj, 'name')) ?? baseName(pathName)
  const target = [stringOf(getEntry(configObj, 'database')), stringOf(getEntry(configObj, 'schema')), name].filter(Boolean).join('.')
  const tags = getEntry(configObj, 'tags')
  const canSave = doc.source.kind === 'project'
  const blocks = (['js', 'pre_operations', 'post_operations'] as const).filter((k) => findBlock(file, k))
  const missingBlocks = (['js', 'pre_operations', 'post_operations'] as const).filter((k) => !findBlock(file, k))
  const sourceText = file.pieces.map((p) => p.raw).join('')
  const setConfig = (v: ObjectValue) => onChange(setBlockInner(file, 'config', formatConfigInner(v)))

  const tabs: { value: EditorTab; label: string; count?: number }[] = [
    { value: 'query', label: 'Query' },
    { value: 'settings', label: 'Settings' },
    { value: 'columns', label: 'Columns', count: countColumns(configObj) },
    { value: 'tests', label: 'Tests', count: countTests(configObj) },
    { value: 'blocks', label: 'Pre / post ops', count: blocks.length },
  ]

  /** The config tabs need a config block the form can read. */
  const withConfig = (render: (value: ObjectValue) => ReactNode) => {
    if (!configBlock)
      return (
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
          <p>This file has no config block.</p>
          <Button variant="outline" size="sm" onClick={() => onChange(addBlock(file, 'config', '\n  type: "table"\n'))}>
            <Plus /> Add config
          </Button>
        </div>
      )
    if (config && !config.ok)
      return (
        <div className="flex max-w-lg flex-col items-start gap-3 text-sm">
          <p className="text-muted-foreground">This config uses JavaScript the form cannot show as fields, so it stays as code.</p>
          <p className="font-mono text-xs text-destructive">{config.error}</p>
          <Button variant="outline" size="sm" onClick={() => props.onTab('raw')}>
            Open the raw file <ChevronRight />
          </Button>
        </div>
      )
    if (!configObj) return null
    return (
      <>
        {config?.ok && config.hasComments && <Notice>This config has comments. Changing a value rewrites the block without them; use the Raw file tab to keep them.</Notice>}
        {render(configObj)}
      </>
    )
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-6 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{name}</h2>
            {type && <Badge variant={TYPE_TONE[type] ?? 'secondary'}>{type}</Badge>}
            {props.dirty && <Badge variant="warning">Unsaved</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={description ? `${pathName}\n${description}` : pathName}>
            <span className="font-mono">{target && target !== name ? target : pathName}</span>
            {description && <> · {description.split('\n')[0]}</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Copy file" title="Copy the whole file" onClick={props.onCopy}>
            {props.copied ? <Check /> : <Copy />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Undo all changes" title="Undo all changes" disabled={!props.dirty} onClick={props.onRevert}>
            <RotateCcw />
          </Button>
          {canSave ? (
            <Button onClick={props.onSave} disabled={!props.dirty || !!props.busy} title="Save (Ctrl+S)">
              {props.busy === 'save' ? <Loader2 className="animate-spin" /> : props.saved ? <Check /> : <Save />} {props.saved ? 'Saved' : 'Save'}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Close" onClick={props.onClose}>
              <X />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="File" className="flex items-end gap-5 overflow-x-auto border-b px-6 text-sm">
        {tabs.map((t) => (
          <TabButton key={t.value} active={tab === t.value} onClick={() => props.onTab(t.value)}>
            {t.label}
            {!!t.count && <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">{t.count}</span>}
          </TabButton>
        ))}
        <TabButton active={tab === 'raw'} onClick={() => props.onTab('raw')} className="ml-auto" muted>
          <FileCode2 className="mr-1.5 size-3.5" />
          Raw file
        </TabButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === 'query' && (
          <>
            {(refs.length > 0 || (tags && tags.t === 'array' && tags.items.length > 0)) && (
              <div className="flex flex-wrap items-center gap-1.5 border-b px-6 py-2.5 text-xs">
                {refs.some((r) => r.name) && <span className="mr-1 font-semibold tracking-wide text-muted-foreground uppercase">Reads</span>}
                {refs
                  .filter((r) => r.name)
                  .map((r) => {
                    const known = props.knownRefs.has(r.name!)
                    return (
                      <button
                        key={`${r.schema}.${r.name}`}
                        type="button"
                        disabled={!known}
                        onClick={() => props.onOpenRef(r.name!)}
                        title={known ? `Open ${r.name}` : `${r.name} is not a .sqlx file in this project`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono',
                          known ? 'hover:border-primary hover:text-primary' : 'cursor-default text-muted-foreground',
                        )}
                      >
                        {r.schema ? `${r.schema}.` : ''}
                        {r.name}
                        {known && <ArrowUpRight className="size-3" />}
                      </button>
                    )
                  })}
                {refs.some((r) => r.fn === 'incremental') && <Badge variant="info">incremental()</Badge>}
                {refs.some((r) => r.fn === 'self') && <Badge variant="secondary">self()</Badge>}
                {tags?.t === 'array' && tags.items.length > 0 && (
                  <span className="ml-auto flex flex-wrap gap-1">
                    {tags.items.map((t, i) => t.t === 'string' && (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        #{t.v}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )}
            {body.split && <p className="px-6 pt-3 text-xs text-muted-foreground">The SQL sits between blocks in this file; editing it here joins it into one piece.</p>}
            <SqlxCode
              label="Query"
              value={body.sql}
              minLines={16}
              placeholder={type === 'declaration' ? 'A declaration has no SQL.' : 'SELECT ...'}
              onChange={(sql) => onChange(setBody(file, sql))}
              roomy
              className="pb-6"
            />
          </>
        )}

        {tab === 'settings' && (
          <div className="p-6">{withConfig((v) => <ConfigForm core={props.core} value={v} onChange={setConfig} sections={SETTINGS_SECTIONS} />)}</div>
        )}

        {tab === 'columns' && <div className="p-6">{withConfig((v) => <ColumnsTable value={v} onChange={setConfig} />)}</div>}

        {tab === 'tests' && <div className="p-6">{withConfig((v) => <TestsForm value={v} onChange={setConfig} />)}</div>}

        {tab === 'blocks' && (
          <div className="pb-6">
            {blocks.length === 0 && (
              <p className="px-6 pt-6 text-sm text-muted-foreground">
                This file has no extra blocks. Add JavaScript the SQL can use, or statements that run before or after the query.
              </p>
            )}
            {blocks.map((k) => {
              const b = findBlock(file, k)!
              return <BlockPanel key={k} kind={k} inner={b.inner} onChange={(inner) => onChange(setBlockInner(file, k, inner))} onRemove={() => onChange(removeBlock(file, k))} />
            })}
            {missingBlocks.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 pt-4">
                {missingBlocks.map((k) => (
                  <Button key={k} variant="outline" size="sm" onClick={() => onChange(addBlock(file, k))}>
                    <Plus /> {BLOCK_LABEL[k].title}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'raw' && (
          <>
            <p className="px-6 pt-3 text-xs text-muted-foreground">The whole file as text, config included. Use it for anything the other tabs cannot show, such as comments.</p>
            <SqlxCode label="Whole file" value={sourceText} minLines={20} onChange={(t) => onChange({ ...parseSqlx(t), eol: file.eol })} />
          </>
        )}
      </div>
    </section>
  )
}

function TabButton({ active, onClick, children, className, muted }: { active: boolean; onClick: () => void; children: ReactNode; className?: string; muted?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        '-mb-px inline-flex shrink-0 items-center border-b-2 py-2.5 whitespace-nowrap transition-colors',
        active ? 'border-primary font-semibold text-foreground' : cn('border-transparent hover:text-foreground', muted ? 'text-muted-foreground/80' : 'text-muted-foreground'),
        className,
      )}
    >
      {children}
    </button>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mb-5 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">{children}</p>
}

function BlockPanel({ kind, inner, onChange, onRemove }: { kind: Exclude<BlockKind, 'config'>; inner: string; onChange: (inner: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(true)
  const meta = BLOCK_LABEL[kind]
  // Show the block's code without the blank line after `{` and the indentation-only line before `}`.
  const lead = /^[ \t]*\n/.exec(inner)?.[0] ?? ''
  const trail = /\n[ \t]*$/.exec(inner.slice(lead.length))?.[0] ?? ''
  const code = inner.slice(lead.length, inner.length - trail.length)
  return (
    <div className="mx-6 mt-4 rounded-lg border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
          <span className="text-sm font-medium">{meta.title}</span>
          <span className="truncate text-xs text-muted-foreground">{meta.hint}</span>
        </button>
        <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove ${meta.title}`} onClick={onRemove}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      {open && (
        <SqlxCode
          label={meta.title}
          language={meta.language}
          value={code}
          minLines={2}
          className="border-t bg-card"
          onChange={(c) => onChange((lead || '\n') + c + (trail || '\n'))}
        />
      )}
    </div>
  )
}
