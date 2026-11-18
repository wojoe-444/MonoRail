import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { activeCycle, addDays, cycleLabel, estimateLabel, estimateOptions, identifier, PRIORITY_LABEL, PRIORITY_ORDER, shortDate, teamStates, todayIso } from '../lib'
import { useTracker } from '../TrackerContext'
import { Avatar, Dot, EntityIcon, PriorityIcon, StatusIcon } from './bits'

export const NONE = '__none'

export interface PickItem {
  value: string
  label: string
  icon?: ReactNode
  hint?: string
  group?: string
}

/**
 * A searchable list in a popover. Single choice closes on pick; `multi`
 * toggles and stays open. Arrow keys move, Enter picks, typing filters.
 */
export function Picker({ items, selected, onPick, multi, children, placeholder = 'Search…', align, footer, open: openProp, onOpenChange }: { items: PickItem[]; selected: string[]; onPick: (value: string) => void; multi?: boolean; children: ReactNode; placeholder?: string; align?: 'start' | 'end' | 'center'; footer?: ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const setOpen = (o: boolean) => {
    setOwnOpen(o)
    onOpenChange?.(o)
    if (!o) setQ('')
  }
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? items.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(s)) : items
  }, [items, q])
  const pick = (v: string) => {
    onPick(v)
    if (!multi) setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="trk flex w-64 flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(shown.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter' && shown[active]) {
              e.preventDefault()
              pick(shown[active].value)
            }
          }}
          placeholder={placeholder}
          className="h-9 border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1" role="listbox" aria-multiselectable={multi}>
          {shown.length === 0 && <div className="px-2 py-3 text-center text-sm text-muted-foreground">Nothing matches</div>}
          {shown.map((it, n) => {
            const on = selected.includes(it.value)
            const header = it.group && it.group !== shown[n - 1]?.group
            return (
              <div key={it.value}>
                {header && <div className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{it.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onMouseEnter={() => setActive(n)}
                  onClick={() => pick(it.value)}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none', n === active && 'bg-accent text-accent-foreground')}
                >
                  {multi && <span className={cn('flex size-3.5 items-center justify-center rounded-[4px] border', on && 'border-primary bg-primary text-primary-foreground')}>{on && <Check className="size-3" />}</span>}
                  {it.icon && <span className="flex w-4 justify-center">{it.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>}
                  {!multi && on && <Check className="size-3.5 shrink-0 text-muted-foreground" />}
                </button>
              </div>
            )
          })}
        </div>
        {footer && <div className="border-t p-1">{footer}</div>}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------- item lists

export function useItems() {
  const { snap, idx } = useTracker()
  return {
    status: (teamId: string): PickItem[] => {
      const states = teamStates(snap, teamId)
      const team = idx.team.get(teamId)
      return states.filter((s) => s.type !== 'triage' || team?.triageEnabled).map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon type={s.type} color={s.color} fill={startedFill(states, s.id)} /> }))
    },
    priority: (): PickItem[] => [0, ...PRIORITY_ORDER.filter((p) => p !== 0)].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p], icon: <PriorityIcon priority={p} /> })),
    member: (none = 'No assignee'): PickItem[] => [{ value: NONE, label: none, icon: <Avatar member={undefined} size={16} /> }, ...[...snap.users].sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name)).map((u) => ({ value: u.id, label: u.name, hint: u.me ? 'You' : undefined, icon: <Avatar member={u} size={16} /> }))],
    label: (teamId?: string): PickItem[] =>
      snap.labels
        .filter((l) => !l.isGroup && (!l.teamId || l.teamId === teamId))
        .map((l) => ({ value: l.id, label: l.name, icon: <Dot color={l.color} />, group: l.parentId ? snap.labels.find((g) => g.id === l.parentId)?.name : undefined }))
        .sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.label.localeCompare(b.label)),
    project: (): PickItem[] => [{ value: NONE, label: 'No project' }, ...snap.projects.filter((p) => p.status !== 'canceled').map((p) => ({ value: p.id, label: p.name, icon: <EntityIcon icon={p.icon} color={p.color} size={14} /> }))],
    milestone: (projectId: string | null): PickItem[] => [{ value: NONE, label: 'No milestone' }, ...snap.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder).map((m) => ({ value: m.id, label: m.name, hint: shortDate(m.targetDate) }))],
    cycle: (teamId: string): PickItem[] => {
      const current = activeCycle(snap, teamId)
      const t = todayIso()
      return [{ value: NONE, label: 'No cycle' }, ...snap.cycles.filter((c) => c.teamId === teamId && (c.endsAt > t || c.id === current?.id)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((c) => ({ value: c.id, label: cycleLabel(c), hint: c.id === current?.id ? 'Current' : `${shortDate(c.startsAt)} – ${shortDate(addDays(c.endsAt, -1))}` }))]
    },
    estimate: (teamId: string): PickItem[] => {
      const team = idx.team.get(teamId)
      return [{ value: NONE, label: 'No estimate' }, ...estimateOptions(team).map((n) => ({ value: String(n), label: estimateLabel(team, n) }))]
    },
    team: (): PickItem[] => snap.teams.map((t) => ({ value: t.id, label: t.name, hint: t.key, icon: <EntityIcon icon={t.icon} color={t.color} size={14} /> })),
    issue: (exclude: string[] = []): PickItem[] =>
      snap.issues
        .filter((i) => !exclude.includes(i.id))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((i) => {
          const st = idx.state.get(i.stateId)
          return { value: i.id, label: i.title, hint: identifier(idx, i), icon: st ? <StatusIcon type={st.type} color={st.color} /> : undefined }
        }),
  }
}

/** How full a started status looks: later started statuses look fuller. */
export function startedFill(states: { id: string; type: string }[], id: string): number {
  const started = states.filter((s) => s.type === 'started')
  const n = started.findIndex((s) => s.id === id)
  return n < 0 ? 0.5 : (n + 1) / (started.length + 1)
}

/** A date picker in a popover with quick choices. */
export function DatePicker({ value, onChange, children, align }: { value: string | null; onChange: (v: string | null) => void; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const t = todayIso()
  const dow = new Date().getDay()
  const quick: [string, string][] = [
    ['Today', t],
    ['Tomorrow', addDays(t, 1)],
    ['End of this week', addDays(t, (5 - dow + 7) % 7)],
    ['In one week', addDays(t, 7)],
    ['In two weeks', addDays(t, 14)],
  ]
  const set = (v: string | null) => {
    onChange(v)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="trk w-60 p-2" onClick={(e) => e.stopPropagation()}>
        <input type="date" defaultValue={value ?? ''} onChange={(e) => e.target.value && set(e.target.value)} className="mb-2 h-8 w-full rounded-md border bg-card px-2 text-sm" aria-label="Date" />
        {quick.map(([label, d]) => (
          <button key={label} type="button" onClick={() => set(d)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent">
            <span>{label}</span>
            <span className="text-xs text-muted-foreground">{shortDate(d)}</span>
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => set(null)} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent">
            Clear date
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
