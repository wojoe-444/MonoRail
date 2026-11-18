import { useEffect, useMemo, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Columns3, Filter, List, Plus, Save, SlidersHorizontal, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { prefs } from '@/lib/prefs'
import { cn } from '@/lib/utils'

import type { NewIssue } from '../api'
import { trackerApi } from '../api'
import { applyCompleted, applyFilters, between, DEFAULT_DISPLAY, filterCount, GROUP_LABEL, groupIssues, ORDER_LABEL, PRIORITY_LABEL, sortIssues, STATE_TYPE_LABEL, STATE_TYPES, type Group } from '../lib'
import { useTracker } from '../TrackerContext'
import type { CustomView, Display, Filters, GroupBy, Issue, OrderBy } from '../types'
import { Avatar, Dot, Empty, EntityIcon, PriorityIcon, StatusIcon } from './bits'
import { IssueCard, IssueRow } from './IssueRow'
import { NONE, Picker, useItems, type PickItem } from './Picker'

interface Props {
  /** The issues this page is about (before the user's filters). */
  issues: Issue[]
  /** Remembers filters and display per page (`prefs`); empty: not remembered. */
  storageKey: string
  teamId?: string
  initialDisplay?: Partial<Display>
  initialFilters?: Filters
  /** Defaults for issues created from this page (team, project, cycle, ...). */
  createDefaults?: Partial<NewIssue>
  /** On a saved view's page: changes can be saved back to it. */
  view?: CustomView
  empty?: ReactNode
  toolbarExtra?: ReactNode
}

const KEY = (k: string) => `commandHub.tracker.browse.${k}`

export function IssueBrowser({ issues, storageKey, teamId, initialDisplay, initialFilters, createDefaults, view, empty, toolbarExtra }: Props) {
  const { snap, idx, run, startCreate, updateIssues, deleteIssues, toast } = useTracker()
  const saved = useMemo(() => {
    if (view || !storageKey) return undefined
    try {
      return JSON.parse(prefs.getItem(KEY(storageKey)) ?? 'null') as { filters: Filters; display: Display } | null
    } catch {
      return null
    }
  }, [storageKey, view])
  const [filters, setFilters] = useState<Filters>(view?.filters ?? saved?.filters ?? initialFilters ?? {})
  const [display, setDisplay] = useState<Display>({ ...DEFAULT_DISPLAY, ...initialDisplay, ...(view?.display ?? saved?.display ?? {}) })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // A saved view's page starts from the view each time it opens or is saved
  // (a new version), not on every refresh, so unsaved changes survive edits to issues.
  const viewVersion = view ? `${view.id}@${view.version}` : ''
  useEffect(() => {
    if (!view) return
    setFilters(view.filters)
    setDisplay({ ...DEFAULT_DISPLAY, ...view.display })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewVersion])
  useEffect(() => {
    if (!view && storageKey) prefs.setItem(KEY(storageKey), JSON.stringify({ filters, display }))
  }, [filters, display, storageKey, view])

  const shown = useMemo(() => {
    let list = applyFilters(idx, issues, filters)
    list = applyCompleted(idx, list, display.showCompleted)
    if (!display.showSubIssues) list = list.filter((i) => !i.parentId || !idx.issue.has(i.parentId))
    return sortIssues(idx, list, display.orderBy)
  }, [idx, issues, filters, display])
  const groups = useMemo(() => groupIssues(snap, idx, shown, display.groupBy, { teamId, showEmpty: display.showEmptyGroups || (display.layout === 'board' && display.groupBy === 'status') }), [snap, idx, shown, display, teamId])

  const viewDirty = !!view && (JSON.stringify(view.filters) !== JSON.stringify(filters) || JSON.stringify({ ...DEFAULT_DISPLAY, ...view.display }) !== JSON.stringify(display))

  const toggle = (id: string, e?: MouseEvent) => {
    setSelected((s) => {
      const n = new Set(s)
      if (e?.shiftKey && s.size) {
        const order = groups.flatMap((g) => g.issues.map((i) => i.id))
        const last = [...s].at(-1)!
        const [a, b] = [order.indexOf(last), order.indexOf(id)].sort((x, y) => x - y)
        for (const x of order.slice(a, b + 1)) n.add(x)
      } else if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  // ------------------------------------------------------------ drag and drop
  const [drag, setDrag] = useState<{ id: string; over?: string; group?: string }>()
  const dropOn = (g: Group, beforeId?: string) => {
    if (!drag) return
    const issue = idx.issue.get(drag.id)
    setDrag(undefined)
    if (!issue) return
    const patch: Partial<Issue> = {}
    if (g.patch === 'state-type') {
      if (g.stateType !== idx.state.get(issue.stateId)?.type) {
        const target = snap.states.filter((s) => s.teamId === issue.teamId && s.type === g.stateType).sort((a, b) => a.position - b.position)[0]
        if (!target) return toast({ text: 'That team has no status of this kind.', tone: 'error' })
        patch.stateId = target.id
      }
    } else if (g.patch) {
      const [k, v] = Object.entries(g.patch)[0] as [keyof Issue, unknown]
      if (issue[k] !== v) Object.assign(patch, g.patch)
    } else if (g.key !== groups.find((x) => x.issues.some((i) => i.id === issue.id))?.key) {
      return toast({ text: `Issues cannot be moved between ${GROUP_LABEL[display.groupBy].toLowerCase()} groups by dragging.`, tone: 'error' })
    }
    if (display.orderBy === 'manual') {
      const list = g.issues.filter((i) => i.id !== issue.id)
      const at = beforeId ? list.findIndex((i) => i.id === beforeId) : list.length
      patch.sortOrder = between(list[at - 1]?.sortOrder, list[at]?.sortOrder)
    }
    if (Object.keys(patch).length) void updateIssues({ ids: [issue.id], patch })
  }
  const dragProps = (g: Group, i?: Issue) => ({
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', i!.id)
      setDrag({ id: i!.id })
    },
    onDragOver: (e: DragEvent) => {
      if (!drag) return
      e.preventDefault()
      e.stopPropagation()
      if (drag.over !== i?.id || drag.group !== g.key) setDrag({ ...drag, over: i?.id, group: g.key })
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dropOn(g, i?.id)
    },
  })
  const groupCreate = (g: Group): Partial<NewIssue> => {
    const d: Partial<NewIssue> = { ...createDefaults, teamId: createDefaults?.teamId ?? teamId }
    if (g.patch && g.patch !== 'state-type') Object.assign(d, g.patch)
    if (g.kind === 'label' && g.value) d.labelIds = [String(g.value)]
    return d
  }

  // ------------------------------------------------------------ render
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <FilterMenu filters={filters} onChange={setFilters} teamId={teamId} />
      <FilterChips filters={filters} onChange={setFilters} teamId={teamId} />
      <span className="flex-1" />
      {toolbarExtra}
      <input value={filters.query ?? ''} onChange={(e) => setFilters({ ...filters, query: e.target.value || undefined })} placeholder="Filter by text…" className="h-8 w-44 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filter by text" />
      <DisplayMenu display={display} onChange={setDisplay} />
      {view ? (
        viewDirty && (
          <>
            <Button size="sm" variant="ghost" onClick={() => { setFilters(view.filters); setDisplay({ ...DEFAULT_DISPLAY, ...view.display }) }}>
              Reset
            </Button>
            <Button size="sm" onClick={() => void run(() => trackerApi.save('customView', { id: view.id, name: view.name, filters, display }), 'View saved.')}>
              <Save /> Save view
            </Button>
          </>
        )
      ) : (
        <SaveAsView filters={filters} display={display} teamId={teamId} />
      )}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toolbar}
      {shown.length === 0 ? (
        (empty ?? <Empty title={issues.length ? 'No issues match these filters' : 'No issues here yet'}>{issues.length ? 'Change or clear the filters to see more.' : 'Press C or use New issue to make one.'}</Empty>)
      ) : display.layout === 'list' ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-24" role="table">
          {groups.map((g) => (
            <section key={g.key} onDragOver={dragProps(g).onDragOver} onDrop={dragProps(g).onDrop}>
              {display.groupBy !== 'none' && (
                <div className={cn('sticky top-0 z-10 flex h-9 items-center gap-2 border-b bg-muted/80 px-4 text-sm backdrop-blur-none', drag?.group === g.key && !drag.over && 'ring-2 ring-primary ring-inset')}>
                  <button type="button" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })} className="rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label={collapsed.has(g.key) ? 'Expand' : 'Collapse'}>
                    {collapsed.has(g.key) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                  <GroupIcon g={g} />
                  <span className="font-medium">{g.label}</span>
                  <span className="text-muted-foreground tabular-nums">{g.issues.length}</span>
                  <span className="flex-1" />
                  {g.kind !== 'none' && (
                    <button type="button" onClick={() => startCreate(groupCreate(g))} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label={`New issue in ${g.label}`}>
                      <Plus className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              {!collapsed.has(g.key) && g.issues.map((i) => <IssueRow key={`${g.key}:${i.id}`} issue={i} selected={selected.has(i.id)} onSelect={(e) => toggle(i.id, e)} draggable {...dragProps(g, i)} dropAbove={drag?.over === i.id && drag.group === g.key && drag.id !== i.id} />)}
            </section>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
          {groups.map((g) => (
            <div key={g.key} onDragOver={dragProps(g).onDragOver} onDrop={dragProps(g).onDrop} className={cn('flex w-72 shrink-0 flex-col rounded-xl bg-muted/60', drag?.group === g.key && 'ring-2 ring-primary/50')}>
              <div className="flex h-10 items-center gap-2 px-3 text-sm">
                <GroupIcon g={g} />
                <span className="truncate font-medium">{g.label}</span>
                <span className="text-muted-foreground tabular-nums">{g.issues.length}</span>
                <span className="flex-1" />
                <button type="button" onClick={() => startCreate(groupCreate(g))} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label={`New issue in ${g.label}`}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {g.issues.map((i) => (
                  <IssueCard key={`${g.key}:${i.id}`} issue={i} {...(dragProps(g, i) as Required<ReturnType<typeof dragProps>>)} dropAbove={drag?.over === i.id && drag.group === g.key && drag.id !== i.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {selected.size > 0 && <BulkBar ids={[...selected].filter((id) => idx.issue.has(id))} clear={() => setSelected(new Set())} onDelete={(ids) => { void deleteIssues(ids); setSelected(new Set()) }} />}
    </div>
  )
}

function GroupIcon({ g }: { g: Group }) {
  const { snap } = useTracker()
  if (g.kind === 'status' && g.stateType) return <StatusIcon type={g.stateType} color={g.color ?? 'var(--muted-foreground)'} />
  if (g.kind === 'priority') return <PriorityIcon priority={Number(g.value)} className="text-muted-foreground" />
  if (g.kind === 'assignee') return <Avatar member={snap.users.find((u) => u.id === g.value)} size={16} />
  if (g.kind === 'project' && g.value) {
    const p = snap.projects.find((x) => x.id === g.value)
    return p ? <EntityIcon icon={p.icon} color={p.color} size={14} /> : null
  }
  if (g.color) return <Dot color={g.color} />
  return null
}

// ---------------------------------------------------------------- bulk actions

function BulkBar({ ids, clear, onDelete }: { ids: string[]; clear: () => void; onDelete: (ids: string[]) => void }) {
  const { idx, updateIssues } = useTracker()
  const items = useItems()
  const teams = new Set(ids.map((id) => idx.issue.get(id)?.teamId))
  const oneTeam = teams.size === 1 ? [...teams][0] : undefined
  const set = (patch: Partial<Issue>) => void updateIssues({ ids, patch })
  const btn = 'h-8 rounded-md px-2.5 text-sm hover:bg-accent'
  if (!ids.length) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1.5 shadow-elevation-3">
      <span className="px-2 text-sm font-medium tabular-nums">{ids.length} selected</span>
      {oneTeam && (
        <Picker items={items.status(oneTeam)} selected={[]} onPick={(v) => set({ stateId: v })}>
          <button type="button" className={btn}>Status</button>
        </Picker>
      )}
      <Picker items={items.priority()} selected={[]} onPick={(v) => set({ priority: Number(v) })}>
        <button type="button" className={btn}>Priority</button>
      </Picker>
      <Picker items={items.member()} selected={[]} onPick={(v) => set({ assigneeId: v === NONE ? null : v })}>
        <button type="button" className={btn}>Assignee</button>
      </Picker>
      <Picker items={items.label(oneTeam)} selected={[]} onPick={(v) => void updateIssues({ ids, addLabelIds: [v] })}>
        <button type="button" className={btn}>Add label</button>
      </Picker>
      <Picker items={items.project()} selected={[]} onPick={(v) => set({ projectId: v === NONE ? null : v })}>
        <button type="button" className={btn}>Project</button>
      </Picker>
      {oneTeam && (
        <Picker items={items.cycle(oneTeam)} selected={[]} onPick={(v) => set({ cycleId: v === NONE ? null : v })}>
          <button type="button" className={btn}>Cycle</button>
        </Picker>
      )}
      <button type="button" className={cn(btn, 'text-destructive')} onClick={() => onDelete(ids)} aria-label="Delete selected">
        <Trash2 className="size-4" />
      </button>
      <button type="button" className={btn} onClick={clear} aria-label="Clear selection">
        <X className="size-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- filters

type FilterKey = 'stateTypes' | 'stateIds' | 'priorities' | 'assigneeIds' | 'labelIds' | 'projectIds' | 'cycleIds' | 'teamIds' | 'due'
const FILTER_LABEL: Record<FilterKey, string> = { stateTypes: 'Status type', stateIds: 'Status', priorities: 'Priority', assigneeIds: 'Assignee', labelIds: 'Label', projectIds: 'Project', cycleIds: 'Cycle', teamIds: 'Team', due: 'Due date' }

function useFilterItems(teamId?: string): Record<FilterKey, PickItem[]> {
  const { snap } = useTracker()
  const items = useItems()
  return {
    stateTypes: STATE_TYPES.map((t) => ({ value: t, label: STATE_TYPE_LABEL[t], icon: <StatusIcon type={t} color="var(--muted-foreground)" /> })),
    stateIds: teamId ? items.status(teamId) : snap.teams.flatMap((t) => items.status(t.id).map((i) => ({ ...i, group: t.name }))),
    priorities: items.priority(),
    assigneeIds: items.member(),
    labelIds: items.label(teamId),
    projectIds: items.project(),
    cycleIds: teamId ? items.cycle(teamId) : [{ value: NONE, label: 'No cycle' }, ...snap.teams.flatMap((t) => items.cycle(t.id).slice(1).map((i) => ({ ...i, group: t.name })))],
    teamIds: items.team(),
    due: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'week', label: 'Due within a week' },
      { value: 'none', label: 'No due date' },
    ],
  }
}

const toValues = (k: FilterKey, f: Filters): string[] => {
  if (k === 'due') return f.due ? [f.due] : []
  const v = f[k] as (string | number | null)[] | undefined
  return (v ?? []).map((x) => (x === null ? NONE : String(x)))
}
function setValues(k: FilterKey, f: Filters, values: string[]): Filters {
  const next: Filters = { ...f }
  if (k === 'due') next.due = (values[0] as Filters['due']) || undefined
  else if (k === 'priorities') next.priorities = values.map(Number)
  else (next as Record<string, unknown>)[k] = values.map((v) => (v === NONE ? null : v))
  if (k !== 'due' && !values.length) delete (next as Record<string, unknown>)[k]
  return next
}

function FilterMenu({ filters, onChange, teamId }: { filters: Filters; onChange: (f: Filters) => void; teamId?: string }) {
  const [field, setField] = useState<FilterKey>()
  const [open, setOpen] = useState(false)
  const all = useFilterItems(teamId)
  const keys = (Object.keys(FILTER_LABEL) as FilterKey[]).filter((k) => !(teamId && (k === 'teamIds' || k === 'stateTypes')))
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setField(undefined) }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost">
          <Filter /> Filter{filterCount(filters) ? ` (${filterCount(filters)})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="trk w-64 p-1">
        {!field ? (
          keys.map((k) => (
            <button key={k} type="button" onClick={() => setField(k)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              {FILTER_LABEL[k]}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          ))
        ) : (
          <div>
            <button type="button" onClick={() => setField(undefined)} className="mb-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              ‹ {FILTER_LABEL[field]}
            </button>
            <div className="max-h-72 overflow-y-auto">
              {all[field].map((it) => {
                const vals = toValues(field, filters)
                const on = vals.includes(it.value)
                return (
                  <button key={it.value} type="button" onClick={() => onChange(setValues(field, filters, field === 'due' ? (on ? [] : [it.value]) : on ? vals.filter((v) => v !== it.value) : [...vals, it.value]))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <input type="checkbox" readOnly checked={on} className="size-3.5 accent-(--primary)" tabIndex={-1} />
                    {it.icon}
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.group && <span className="text-xs text-muted-foreground">{it.group}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function FilterChips({ filters, onChange, teamId }: { filters: Filters; onChange: (f: Filters) => void; teamId?: string }) {
  const all = useFilterItems(teamId)
  const active = (Object.keys(FILTER_LABEL) as FilterKey[]).filter((k) => toValues(k, filters).length)
  if (!active.length) return null
  return (
    <>
      {active.map((k) => {
        const vals = toValues(k, filters)
        const names = vals.map((v) => all[k].find((i) => i.value === v)?.label ?? (k === 'priorities' ? PRIORITY_LABEL[Number(v)] : '?'))
        return (
          <span key={k} className="inline-flex h-7 items-center gap-1 rounded-md border bg-card pl-2 text-xs">
            <span className="text-muted-foreground">{FILTER_LABEL[k]}</span>
            <span className="text-muted-foreground">{vals.length > 1 ? 'is any of' : 'is'}</span>
            <span className="max-w-48 truncate font-medium">{names.join(', ')}</span>
            <button type="button" onClick={() => onChange(setValues(k, filters, []))} className="flex h-full items-center rounded-r-md px-1.5 text-muted-foreground hover:bg-accent" aria-label={`Remove ${FILTER_LABEL[k]} filter`}>
              <X className="size-3" />
            </button>
          </span>
        )
      })}
      <button type="button" onClick={() => onChange({ query: filters.query })} className="text-xs text-muted-foreground hover:text-foreground">
        Clear
      </button>
    </>
  )
}

// ---------------------------------------------------------------- display options

function DisplayMenu({ display, onChange }: { display: Display; onChange: (d: Display) => void }) {
  const set = <K extends keyof Display>(k: K, v: Display[K]) => onChange({ ...display, [k]: v })
  const row = 'flex items-center justify-between gap-4 py-1.5 text-sm'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal /> Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="trk w-80 p-3">
        <Segmented
          aria-label="Layout"
          className="mb-3 w-full"
          value={display.layout}
          onChange={(v) => set('layout', v)}
          options={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
          ]}
        />
        <div className={row}>
          <span className="flex items-center gap-2 text-muted-foreground">{display.layout === 'board' ? <Columns3 className="size-4" /> : <List className="size-4" />} Grouping</span>
          <select value={display.groupBy} onChange={(e) => set('groupBy', e.target.value as GroupBy)} className="h-8 rounded-md border bg-card px-2 text-sm">
            {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
              <option key={g} value={g}>
                {GROUP_LABEL[g]}
              </option>
            ))}
          </select>
        </div>
        <div className={row}>
          <span className="text-muted-foreground">Ordering</span>
          <select value={display.orderBy} onChange={(e) => set('orderBy', e.target.value as OrderBy)} className="h-8 rounded-md border bg-card px-2 text-sm">
            {(Object.keys(ORDER_LABEL) as OrderBy[]).map((o) => (
              <option key={o} value={o}>
                {ORDER_LABEL[o]}
              </option>
            ))}
          </select>
        </div>
        <div className={row}>
          <span className="text-muted-foreground">Completed issues</span>
          <select value={display.showCompleted} onChange={(e) => set('showCompleted', e.target.value as Display['showCompleted'])} className="h-8 rounded-md border bg-card px-2 text-sm">
            <option value="all">All</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
            <option value="none">None</option>
          </select>
        </div>
        <label className={row}>
          <span className="text-muted-foreground">Show sub-issues</span>
          <Switch checked={display.showSubIssues} onCheckedChange={(v) => set('showSubIssues', v)} />
        </label>
        <label className={row}>
          <span className="text-muted-foreground">Show empty groups</span>
          <Switch checked={display.showEmptyGroups} onCheckedChange={(v) => set('showEmptyGroups', v)} />
        </label>
      </PopoverContent>
    </Popover>
  )
}

function SaveAsView({ filters, display, teamId }: { filters: Filters; display: Display; teamId?: string }) {
  const { run } = useTracker()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [team, setTeam] = useState(!!teamId)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" title="Save these filters and display options as a view">
          <Save />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="trk w-72 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => trackerApi.save('customView', { name, filters, display, teamId: team ? teamId : null }), 'View saved. Find it under Views.').then((v) => v && setOpen(false))
          }}
          className="flex flex-col gap-2"
        >
          <div className="text-sm font-medium">Save as a view</div>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="View name" className="h-8 rounded-md border bg-card px-2 text-sm" required />
          {teamId && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} className="accent-(--primary)" /> Only for this team
            </label>
          )}
          <Button size="sm" type="submit" disabled={!name.trim()}>
            Save view
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
