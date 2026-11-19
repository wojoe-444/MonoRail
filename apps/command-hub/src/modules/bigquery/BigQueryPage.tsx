import { useCallback, useEffect, useState } from 'react'
import { Cloud, Database, FileCode2, Loader2, Plus, RotateCw, Table2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { prefs } from '@/lib/prefs'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/modules/client'

import { bq, errorText } from './api'
import { Explorer } from './Explorer'
import { QueryTab } from './QueryTab'
import { SAMPLE_SQL } from './sample'
import { DatasetTab, TableTab } from './TableTab'
import { DEFAULT_SETTINGS, type BqProject, type BqStatus, type QuerySettings, type WorkTab } from './types'

const TABS_KEY = 'monorail.bigquery.tabs'
const PROJECT_KEY = 'monorail.bigquery.project'
const PINNED_KEY = 'monorail.bigquery.pinned'
const MAX_TABS = 30

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = prefs.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function newQuery(tabs: WorkTab[], sql = ''): WorkTab {
  const used = new Set(tabs.filter((t) => t.kind === 'query').map((t) => (t as { title: string }).title))
  let n = 1
  while (used.has(n === 1 ? 'Untitled query' : `Untitled query ${n}`)) n++
  return { kind: 'query', id: uid(), title: n === 1 ? 'Untitled query' : `Untitled query ${n}`, sql }
}

interface TabsState {
  tabs: WorkTab[]
  active: string
}

function initialTabs(): TabsState {
  const saved = readJson<TabsState | null>(TABS_KEY, null)
  if (saved?.tabs?.length) return { tabs: saved.tabs.slice(0, MAX_TABS), active: saved.tabs.some((t) => t.id === saved.active) ? saved.active : saved.tabs[0].id }
  const first = newQuery([], isDesktop() ? '' : SAMPLE_SQL)
  return { tabs: [first], active: first.id }
}

function tabLabel(t: WorkTab): string {
  return t.kind === 'query' ? t.title : t.kind === 'table' ? t.tableId : t.datasetId
}

/**
 * Tools > BigQuery: the BigQuery console's workflow in MonoRail. Explorer and
 * history on the left, a strip of editor and table tabs on the right.
 * Backend: electron/modules/bigquery.cjs (opt-in through the Google Cloud
 * connection). Guide: docs/guide/workspace/bigquery.md.
 */
export default function BigQueryPage() {
  const [status, setStatus] = useState<BqStatus>()
  const [projects, setProjects] = useState<BqProject[]>([])
  const [projectsError, setProjectsError] = useState<string>()
  const [billing, setBilling] = useState<string | undefined>(() => prefs.getItem(PROJECT_KEY) ?? undefined)
  const [pinned, setPinned] = useState<string[]>(() => readJson<string[]>(PINNED_KEY, []))
  const [state, setState] = useState<TabsState>(initialTabs)
  const [historyKey, setHistoryKey] = useState(0)
  const [renaming, setRenaming] = useState<string>()

  const loadStatus = useCallback(async () => {
    setStatus(undefined)
    try {
      setStatus(await bq.status())
    } catch (e) {
      setStatus({ state: 'error', message: errorText(e) })
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const r = await bq.listProjects()
      setProjects(r.projects)
      setProjectsError(undefined)
    } catch (e) {
      setProjectsError(errorText(e))
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (status?.state !== 'ok') return
    void loadProjects()
    if (!billing && status.defaultProject) setBilling(status.defaultProject)
  }, [status, loadProjects, billing])

  useEffect(() => {
    if (!billing && projects.length) setBilling(projects[0].id)
  }, [billing, projects])

  useEffect(() => {
    if (billing) prefs.setItem(PROJECT_KEY, billing)
  }, [billing])
  useEffect(() => prefs.setItem(PINNED_KEY, JSON.stringify(pinned)), [pinned])
  useEffect(() => prefs.setItem(TABS_KEY, JSON.stringify(state)), [state])

  const updateTab = useCallback((id: string, patch: Partial<Extract<WorkTab, { kind: 'query' }>>) => {
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id && t.kind === 'query' ? { ...t, ...patch } : t)) }))
  }, [])

  function open(tab: WorkTab, dedupe?: (t: WorkTab) => boolean) {
    setState((s) => {
      const existing = dedupe ? s.tabs.find(dedupe) : undefined
      if (existing) return { ...s, active: existing.id }
      const tabs = [...s.tabs, tab].slice(-MAX_TABS)
      return { tabs, active: tab.id }
    })
  }

  const openQuery = (sql = '') => setState((s) => {
    const t = newQuery(s.tabs, sql)
    return { tabs: [...s.tabs, t].slice(-MAX_TABS), active: t.id }
  })

  const openTable = (projectId: string, datasetId: string, tableId: string) =>
    open({ kind: 'table', id: uid(), projectId, datasetId, tableId }, (t) => t.kind === 'table' && t.projectId === projectId && t.datasetId === datasetId && t.tableId === tableId)

  const openDataset = (projectId: string, datasetId: string) =>
    open({ kind: 'dataset', id: uid(), projectId, datasetId }, (t) => t.kind === 'dataset' && t.projectId === projectId && t.datasetId === datasetId)

  function close(id: string) {
    setState((s) => {
      const i = s.tabs.findIndex((t) => t.id === id)
      const tabs = s.tabs.filter((t) => t.id !== id)
      if (!tabs.length) {
        const t = newQuery([])
        return { tabs: [t], active: t.id }
      }
      return { tabs, active: s.active === id ? tabs[Math.max(0, i - 1)].id : s.active }
    })
  }

  const onRan = useCallback(() => setHistoryKey((k) => k + 1), [])

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (status.state !== 'ok') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-lg gap-4 p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <Cloud className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">BigQuery</h1>
            {status.state === 'not-set-up' ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Browse your BigQuery datasets and run SQL here, signed in with your own Google Cloud account. Set up the Google Cloud connection first; MonoRail
                contacts nothing until you do.
              </p>
            ) : (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {status.message}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/connections')}>{status.state === 'not-set-up' ? 'Set up Google Cloud' : 'Open Connections'}</Button>
            <Button variant="ghost" onClick={() => void loadStatus()}>
              <RotateCw /> Check again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(240px,300px)_1fr]">
      <Explorer
        projects={projects}
        projectsError={projectsError}
        billingProject={billing}
        onBillingProject={setBilling}
        pinned={pinned}
        onPinned={setPinned}
        onOpenTable={openTable}
        onOpenDataset={openDataset}
        onQuery={openQuery}
        onRefreshProjects={() => void loadProjects()}
        historyKey={historyKey}
      />
      <section className="flex min-h-0 min-w-0 flex-col bg-background">
        <div role="tablist" aria-label="Open tabs" className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b bg-muted/40 px-2 pt-2">
          {state.tabs.map((t) => {
            const active = t.id === state.active
            const Icon = t.kind === 'query' ? FileCode2 : t.kind === 'dataset' ? Database : Table2
            return (
              <div
                key={t.id}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                onClick={() => setState((s) => ({ ...s, active: t.id }))}
                onKeyDown={(e) => e.key === 'Enter' && setState((s) => ({ ...s, active: t.id }))}
                onAuxClick={(e) => e.button === 1 && close(t.id)}
                onDoubleClick={() => t.kind === 'query' && setRenaming(t.id)}
                className={cn(
                  'group flex h-9 max-w-56 shrink-0 cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm',
                  active ? 'bg-card text-foreground' : 'border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )}
              >
                <Icon className={cn('size-4 shrink-0', t.kind === 'query' ? 'text-primary' : '')} />
                {renaming === t.id && t.kind === 'query' ? (
                  <input
                    autoFocus
                    defaultValue={t.title}
                    aria-label="Tab name"
                    className="w-32 rounded border bg-background px-1 text-sm outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      updateTab(t.id, { title: e.target.value.trim() || t.title })
                      setRenaming(undefined)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setRenaming(undefined)
                    }}
                  />
                ) : (
                  <span className="truncate" title={t.kind === 'table' ? `${t.projectId}.${t.datasetId}.${t.tableId}` : t.kind === 'dataset' ? `${t.projectId}.${t.datasetId}` : 'Double-click to rename'}>
                    {tabLabel(t)}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Close ${tabLabel(t)}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    close(t.id)
                  }}
                  className="-mr-1 rounded p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
          <Button variant="ghost" size="icon" className="mb-0.5 size-8 shrink-0" aria-label="New query" title="New query" onClick={() => openQuery()}>
            <Plus />
          </Button>
        </div>
        <div className="relative min-h-0 flex-1 bg-card">
          {state.tabs.map((t) => (
            <div key={t.id} role="tabpanel" className={cn('absolute inset-0', t.id !== state.active && 'hidden')}>
              {t.kind === 'query' ? (
                <QueryTab
                  sql={t.sql}
                  onSql={(sql) => updateTab(t.id, { sql })}
                  settings={{ ...DEFAULT_SETTINGS, ...t.settings }}
                  onSettings={(settings: QuerySettings) => updateTab(t.id, { settings })}
                  projectId={billing}
                  active={t.id === state.active}
                  onRan={onRan}
                />
              ) : t.kind === 'table' ? (
                <TableTab projectId={t.projectId} datasetId={t.datasetId} tableId={t.tableId} onQuery={openQuery} />
              ) : (
                <DatasetTab projectId={t.projectId} datasetId={t.datasetId} onOpenTable={(tableId) => openTable(t.projectId, t.datasetId, tableId)} />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
