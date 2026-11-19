import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck, Database, Eye, FolderKanban, Loader2, Pin, PinOff, Plus, RotateCw, Search, Table2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'

import { bq, errorText } from './api'
import { formatBytes, formatTime, tableRef } from './format'
import type { BqDataset, BqJob, BqProject, BqTableItem } from './types'

interface ExplorerProps {
  projects: BqProject[]
  projectsError?: string
  billingProject?: string
  onBillingProject: (id: string) => void
  pinned: string[]
  onPinned: (ids: string[]) => void
  onOpenTable: (projectId: string, datasetId: string, tableId: string) => void
  onOpenDataset: (projectId: string, datasetId: string) => void
  onQuery: (sql: string) => void
  onRefreshProjects: () => void
  historyKey: number
}

type Side = 'explorer' | 'history'

export function Explorer(props: ExplorerProps) {
  const [side, setSide] = useState<Side>('explorer')
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r bg-card">
      <div className="flex shrink-0 flex-col gap-2 border-b p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Run queries in (billing project)
          <NativeSelect className="h-8 text-sm text-foreground" value={props.billingProject ?? ''} onChange={(e) => props.onBillingProject(e.target.value)} aria-label="Billing project">
            {!props.billingProject && <option value="">Pick a project…</option>}
            {props.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name && p.name !== p.id ? `${p.name} (${p.id})` : p.id}
              </option>
            ))}
            {props.billingProject && !props.projects.some((p) => p.id === props.billingProject) && <option value={props.billingProject}>{props.billingProject}</option>}
          </NativeSelect>
        </label>
        <Segmented<Side>
          aria-label="Side panel"
          value={side}
          onChange={setSide}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'explorer', label: 'Explorer' },
            { value: 'history', label: 'History' },
          ]}
        />
      </div>
      {side === 'explorer' ? <Tree {...props} /> : <History projectId={props.billingProject} onQuery={props.onQuery} refreshKey={props.historyKey} />}
    </aside>
  )
}

// ---------- the resource tree ----------

type Loaded<T> = { state: 'loading' } | { state: 'ok'; items: T[]; truncated?: boolean } | { state: 'error'; message: string }

function Tree({ projects, projectsError, billingProject, pinned, onPinned, onOpenTable, onOpenDataset, onQuery, onRefreshProjects }: ExplorerProps) {
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [addId, setAddId] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Starred projects first, then the billing project if it is not starred.
  const shown = [...pinned, ...(billingProject && !pinned.includes(billingProject) ? [billingProject] : [])]
  const others = projects.filter((p) => !shown.includes(p.id))

  function add(id: string) {
    const v = id.trim()
    if (v && !pinned.includes(v)) onPinned([...pinned, v])
    setAddId('')
    setAdding(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 p-3 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search loaded datasets and tables" className="h-8 pl-8 text-sm" aria-label="Filter the explorer" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Refresh the explorer"
          onClick={() => {
            setRefreshKey((k) => k + 1)
            onRefreshProjects()
          }}
        >
          <RotateCw />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3 text-sm">
        {projectsError && (
          <p role="alert" className="mx-1 mb-2 rounded-md bg-destructive-soft p-2 text-xs text-destructive-soft-foreground">
            {projectsError}
          </p>
        )}
        {shown.map((id) => (
          <ProjectNode
            key={`${id}-${refreshKey}`}
            projectId={id}
            filter={filter.trim().toLowerCase()}
            starred={pinned.includes(id)}
            onStar={() => onPinned(pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id])}
            onOpenTable={onOpenTable}
            onOpenDataset={onOpenDataset}
            onQuery={onQuery}
            defaultOpen={id === billingProject}
          />
        ))}
        <div className="mt-3 px-1">
          {adding ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                add(addId)
              }}
            >
              <Input autoFocus value={addId} onChange={(e) => setAddId(e.target.value)} placeholder="Project id, e.g. bigquery-public-data" className="h-8 text-xs" list="bq-project-ids" />
              <datalist id="bq-project-ids">
                {others.map((p) => (
                  <option key={p.id} value={p.id} />
                ))}
              </datalist>
              <Button type="submit" size="sm" className="h-8">
                Star
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Cancel" onClick={() => setAdding(false)}>
                <X />
              </Button>
            </form>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAdding(true)}>
              <Plus /> Star a project by name
            </Button>
          )}
          <p className="mt-1 px-2 text-[11px] text-muted-foreground">Public datasets live in bigquery-public-data.</p>
        </div>
      </div>
    </div>
  )
}

function Row({ depth, open, onToggle, icon, label, onClick, actions, title, busy }: { depth: number; open?: boolean; onToggle?: () => void; icon: ReactNode; label: string; onClick?: () => void; actions?: ReactNode; title?: string; busy?: boolean }) {
  return (
    <div className="group flex h-8 items-center rounded-md hover:bg-accent/60" style={{ paddingLeft: depth * 16 }} title={title}>
      <button type="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={onToggle} className={cn('flex size-6 shrink-0 items-center justify-center text-muted-foreground', !onToggle && 'invisible')}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      <button type="button" onClick={onClick ?? onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
      {actions && <span className="flex shrink-0 items-center pr-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">{actions}</span>}
    </div>
  )
}

function ProjectNode({
  projectId,
  filter,
  starred,
  onStar,
  onOpenTable,
  onOpenDataset,
  onQuery,
  defaultOpen,
}: {
  projectId: string
  filter: string
  starred: boolean
  onStar: () => void
  onOpenTable: ExplorerProps['onOpenTable']
  onOpenDataset: ExplorerProps['onOpenDataset']
  onQuery: (sql: string) => void
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [datasets, setDatasets] = useState<Loaded<BqDataset>>()

  useEffect(() => {
    if (!open || datasets) return
    setDatasets({ state: 'loading' })
    bq.listDatasets(projectId)
      .then((r) => setDatasets({ state: 'ok', items: r.datasets, truncated: r.truncated }))
      .catch((e) => setDatasets({ state: 'error', message: errorText(e) }))
  }, [open, datasets, projectId])

  return (
    <div>
      <Row
        depth={0}
        open={open}
        onToggle={() => setOpen(!open)}
        icon={<FolderKanban className="size-4" />}
        label={projectId}
        busy={datasets?.state === 'loading'}
        actions={
          <Button variant="ghost" size="icon" className="size-6" aria-label={starred ? 'Unstar project' : 'Star project'} onClick={onStar}>
            {starred ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
        }
      />
      {open && datasets?.state === 'error' && <p className="ml-8 py-1 text-xs text-destructive">{datasets.message}</p>}
      {open && datasets?.state === 'ok' && !datasets.items.length && <p className="ml-12 py-1 text-xs text-muted-foreground">No datasets you can see.</p>}
      {open &&
        datasets?.state === 'ok' &&
        datasets.items.map((d) => <DatasetNode key={d.id} projectId={projectId} dataset={d} filter={filter} onOpenTable={onOpenTable} onOpenDataset={onOpenDataset} onQuery={onQuery} />)}
    </div>
  )
}

function DatasetNode({
  projectId,
  dataset,
  filter,
  onOpenTable,
  onOpenDataset,
  onQuery,
}: {
  projectId: string
  dataset: BqDataset
  filter: string
  onOpenTable: ExplorerProps['onOpenTable']
  onOpenDataset: ExplorerProps['onOpenDataset']
  onQuery: (sql: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [tables, setTables] = useState<Loaded<BqTableItem>>()

  useEffect(() => {
    if (!open || tables) return
    setTables({ state: 'loading' })
    bq.listTables(projectId, dataset.id)
      .then((r) => setTables({ state: 'ok', items: r.tables, truncated: r.truncated }))
      .catch((e) => setTables({ state: 'error', message: errorText(e) }))
  }, [open, tables, projectId, dataset.id])

  const tableMatches = tables?.state === 'ok' ? tables.items.filter((t) => !filter || t.id.toLowerCase().includes(filter)) : []
  const selfMatch = !filter || dataset.id.toLowerCase().includes(filter)
  if (filter && !selfMatch && !tableMatches.length) return null
  const expanded = open || (!!filter && tableMatches.length > 0)

  return (
    <div>
      <Row
        depth={1}
        open={expanded}
        onToggle={() => setOpen(!open)}
        onClick={() => {
          setOpen(true)
          onOpenDataset(projectId, dataset.id)
        }}
        icon={<Database className="size-4" />}
        label={dataset.id}
        title={dataset.location ? `${dataset.id} (${dataset.location})` : dataset.id}
        busy={tables?.state === 'loading'}
      />
      {expanded && tables?.state === 'error' && <p className="ml-14 py-1 text-xs text-destructive">{tables.message}</p>}
      {expanded && tables?.state === 'ok' && !tables.items.length && <p className="ml-16 py-1 text-xs text-muted-foreground">No tables.</p>}
      {expanded &&
        (filter && selfMatch ? (tables?.state === 'ok' ? tables.items : []) : tableMatches).map((t) => (
          <Row
            key={t.id}
            depth={2}
            icon={t.type === 'VIEW' || t.type === 'MATERIALIZED_VIEW' ? <Eye className="size-4" /> : <Table2 className="size-4" />}
            label={t.id}
            onClick={() => onOpenTable(projectId, dataset.id, t.id)}
            actions={
              <Button variant="ghost" size="icon" className="size-6" aria-label={`Query ${t.id}`} title="Query" onClick={() => onQuery(`SELECT *\nFROM ${tableRef(projectId, dataset.id, t.id)}\nLIMIT 1000\n`)}>
                <Search className="size-3.5" />
              </Button>
            }
          />
        ))}
      {expanded && tables?.state === 'ok' && tables.truncated && <p className="ml-16 py-1 text-xs text-muted-foreground">Showing the first {tables.items.length.toLocaleString()} tables.</p>}
    </div>
  )
}

// ---------- query history ----------

function History({ projectId, onQuery, refreshKey }: { projectId?: string; onQuery: (sql: string) => void; refreshKey: number }) {
  const [scope, setScope] = useState<'personal' | 'project'>('personal')
  const [jobs, setJobs] = useState<Loaded<BqJob>>()
  const [openId, setOpenId] = useState<string>()

  const load = useCallback(() => {
    if (!projectId) return
    setJobs((j) => (j?.state === 'ok' ? j : { state: 'loading' }))
    bq.listJobs(projectId, scope === 'project')
      .then((r) => setJobs({ state: 'ok', items: r.jobs }))
      .catch((e) => setJobs({ state: 'error', message: errorText(e) }))
  }, [projectId, scope])

  useEffect(() => {
    setJobs(undefined)
  }, [projectId, scope])
  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (!projectId) return <p className="p-4 text-sm text-muted-foreground">Pick a project to see its query history.</p>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-3 pb-2">
        <Segmented
          aria-label="Whose history"
          value={scope}
          onChange={setScope}
          className="flex-1 [&>button]:flex-1"
          options={[
            { value: 'personal', label: 'Personal' },
            { value: 'project', label: 'Project' },
          ]}
        />
        <Button variant="ghost" size="icon" className="size-8" aria-label="Refresh history" onClick={load}>
          <RotateCw className={jobs?.state === 'loading' ? 'animate-spin' : ''} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-3">
        {jobs?.state === 'error' && <p className="m-1 rounded-md bg-destructive-soft p-2 text-xs text-destructive-soft-foreground">{jobs.message}</p>}
        {jobs?.state === 'loading' && (
          <div className="flex justify-center p-4 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {jobs?.state === 'ok' && !jobs.items.length && <p className="p-2 text-sm text-muted-foreground">No queries in the last runs.</p>}
        {jobs?.state === 'ok' && (
          <ul className="flex flex-col">
            {jobs.items.map((j) => {
              const open = openId === j.jobId
              const failed = !!j.error
              return (
                <li key={j.jobId} className="rounded-md hover:bg-accent/40">
                  <button type="button" onClick={() => setOpenId(open ? undefined : j.jobId)} className="flex w-full items-start gap-2 px-2 py-2 text-left">
                    {j.state !== 'DONE' ? (
                      <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-info" />
                    ) : failed ? (
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    ) : (
                      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs">{(j.query ?? '').replace(/\s+/g, ' ').trim() || j.jobId}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {formatTime(j.creationTime)}
                        {j.totalBytesProcessed !== undefined && ` · ${formatBytes(j.totalBytesProcessed)}`}
                        {scope === 'project' && j.user && ` · ${j.user}`}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="flex flex-col gap-2 px-2 pb-2">
                      {failed && <p className="text-xs text-destructive">{j.error}</p>}
                      <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-[11px] whitespace-pre-wrap">{j.query}</pre>
                      {j.query && (
                        <Button size="sm" variant="outline" className="self-start" onClick={() => onQuery(j.query!)}>
                          Open query in a new tab
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
