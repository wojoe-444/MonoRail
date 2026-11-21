import { useEffect, useState, type ReactNode } from 'react'
import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { trackerApi, type NewIssue } from '../api'
import { cycleLabel, estimateLabel, estimateOptions, identifier, PRIORITY_LABEL, shortDate } from '../lib'
import { useTracker } from '../TrackerContext'
import { Avatar, Dot, EntityIcon, PriorityIcon, StatusIcon } from './bits'
import { DatePicker, NONE, Picker, useItems } from './Picker'

/** New issue (C anywhere in Tracker). Ctrl+Enter creates; "Create more" keeps the dialog open. */
export function CreateIssue() {
  const { creating, endCreate } = useTracker()
  return (
    <D.Root open={!!creating} onOpenChange={(o) => !o && endCreate()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content aria-describedby={undefined} className="trk fixed top-[12vh] left-1/2 z-50 flex w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 flex-col rounded-xl border bg-popover shadow-elevation-3 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          {creating && <Form defaults={creating} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

const chip = 'inline-flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-xs hover:bg-accent'

function Form({ defaults }: { defaults: Partial<NewIssue> }) {
  const { snap, idx, run, endCreate, toast, openIssue } = useTracker()
  const items = useItems()
  const firstTeam = defaults.teamId ?? snap.teams[0]?.id
  const [d, setD] = useState<Partial<NewIssue>>({ priority: 0, labelIds: [], ...defaults, teamId: firstTeam })
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const team = idx.team.get(d.teamId ?? '')
  const set = (patch: Partial<NewIssue>) => setD((x) => ({ ...x, ...patch }))
  // Changing team drops what belongs to the old one.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Reset workflow fields and team-specific labels when the issue's team changes.
    setD((x) => (x.teamId === defaults.teamId ? x : { ...x, stateId: undefined, cycleId: undefined, labelIds: (x.labelIds ?? []).filter((l) => !snap.labels.find((y) => y.id === l)?.teamId) }))
  }, [d.teamId, defaults.teamId, snap.labels])

  const triageState = team?.triageEnabled && d.triage ? snap.states.find((s) => s.teamId === team.id && s.type === 'triage')?.id : undefined
  const stateId = d.stateId ?? triageState ?? team?.defaultStateId ?? undefined
  const st = stateId ? idx.state.get(stateId) : undefined
  const assignee = snap.users.find((u) => u.id === d.assigneeId)
  const project = snap.projects.find((p) => p.id === d.projectId)
  const cycle = snap.cycles.find((c) => c.id === d.cycleId)
  const milestone = snap.milestones.find((m) => m.id === d.projectMilestoneId)
  const parent = d.parentId ? idx.issue.get(d.parentId) : undefined

  const submit = async () => {
    if (!team || !d.title?.trim() || busy) return
    setBusy(true)
    const made = await run(() => trackerApi.createIssue({ ...(d as NewIssue), title: d.title!.trim(), stateId }))
    setBusy(false)
    if (!made) return
    const ident = `${team.key}-${made.number}`
    toast({ text: `Created ${ident}.`, action: { label: 'Open', run: () => openIssue(made) } })
    if (more) setD((x) => ({ ...x, title: '', description: '' }))
    else endCreate()
  }

  if (!team)
    return (
      <div className="p-6 text-sm">
        <D.Title className="mb-2 font-medium">Make a team first</D.Title>
        Issues belong to a team. Create one in Tracker settings.
      </div>
    )

  return (
    <form
      onSubmit={(e) => (e.preventDefault(), void submit())}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
      }}
    >
      <div className="flex items-center gap-2 px-4 pt-3 text-xs">
        <Picker items={items.team()} selected={[team.id]} onPick={(v) => set({ teamId: v })}>
          <button type="button" className={chip}>
            <EntityIcon icon={team.icon} color={team.color} size={12} /> {team.key}
          </button>
        </Picker>
        <D.Title className="text-muted-foreground">› New issue{parent ? ` (sub-issue of ${identifier(idx, parent)})` : ''}</D.Title>
        <span className="flex-1" />
        <D.Close className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </div>
      <div className="px-4 pt-2">
        <input autoFocus value={d.title ?? ''} onChange={(e) => set({ title: e.target.value })} placeholder="Issue title" className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground" aria-label="Title" />
        <textarea value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Add description… (Markdown)" className="field-sizing-content mt-2 max-h-[40vh] min-h-20 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground" aria-label="Description" />
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <Picker items={items.status(team.id)} selected={stateId ? [stateId] : []} onPick={(v) => set({ stateId: v })}>
          <button type="button" className={chip}>
            {st && <StatusIcon type={st.type} color={st.color} />} {st?.name ?? 'Status'}
          </button>
        </Picker>
        <Picker items={items.priority()} selected={[String(d.priority ?? 0)]} onPick={(v) => set({ priority: Number(v) })}>
          <button type="button" className={chip}>
            <PriorityIcon priority={d.priority ?? 0} className="text-muted-foreground" /> {d.priority ? PRIORITY_LABEL[d.priority] : 'Priority'}
          </button>
        </Picker>
        <Picker items={items.member()} selected={[d.assigneeId ?? NONE]} onPick={(v) => set({ assigneeId: v === NONE ? null : v })}>
          <button type="button" className={chip}>
            <Avatar member={assignee} size={14} /> {assignee?.name ?? 'Assignee'}
          </button>
        </Picker>
        <Picker items={items.label(team.id)} multi selected={d.labelIds ?? []} onPick={(v) => set({ labelIds: (d.labelIds ?? []).includes(v) ? d.labelIds!.filter((x) => x !== v) : [...(d.labelIds ?? []).filter((x) => { const g = snap.labels.find((l) => l.id === v)?.parentId; return !g || snap.labels.find((l) => l.id === x)?.parentId !== g }), v] })}>
          <button type="button" className={chip}>
            {d.labelIds?.length ? (
              d.labelIds.map((l) => {
                const label = snap.labels.find((x) => x.id === l)
                return label ? (
                  <span key={l} className="inline-flex items-center gap-1">
                    <Dot color={label.color} />
                    {label.name}
                  </span>
                ) : null
              })
            ) : (
              'Labels'
            )}
          </button>
        </Picker>
        <Picker items={items.project()} selected={[d.projectId ?? NONE]} onPick={(v) => set({ projectId: v === NONE ? null : v, projectMilestoneId: null })}>
          <button type="button" className={chip}>
            {project && <EntityIcon icon={project.icon} color={project.color} size={12} />} {project?.name ?? 'Project'}
          </button>
        </Picker>
        {project && snap.milestones.some((m) => m.projectId === project.id) && (
          <Picker items={items.milestone(project.id)} selected={[d.projectMilestoneId ?? NONE]} onPick={(v) => set({ projectMilestoneId: v === NONE ? null : v })}>
            <button type="button" className={chip}>
              {milestone?.name ?? 'Milestone'}
            </button>
          </Picker>
        )}
        {team.cyclesEnabled && (
          <Picker items={items.cycle(team.id)} selected={[d.cycleId ?? NONE]} onPick={(v) => set({ cycleId: v === NONE ? null : v })}>
            <button type="button" className={chip}>
              {cycle ? cycleLabel(cycle) : 'Cycle'}
            </button>
          </Picker>
        )}
        {estimateOptions(team).length > 0 && (
          <Picker items={items.estimate(team.id)} selected={[d.estimate == null ? NONE : String(d.estimate)]} onPick={(v) => set({ estimate: v === NONE ? null : Number(v) })}>
            <button type="button" className={chip}>
              {d.estimate == null ? 'Estimate' : estimateLabel(team, d.estimate)}
            </button>
          </Picker>
        )}
        <DatePicker value={d.dueDate ?? null} onChange={(v) => set({ dueDate: v })}>
          <button type="button" className={chip}>
            {d.dueDate ? shortDate(d.dueDate) : 'Due date'}
          </button>
        </DatePicker>
      </div>
      <Footer>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={more} onCheckedChange={setMore} /> Create more
        </label>
        <Button type="submit" size="sm" disabled={!d.title?.trim() || busy}>
          Create issue <span className="text-xs opacity-70">Ctrl+Enter</span>
        </Button>
      </Footer>
    </form>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return <div className={cn('flex items-center justify-end gap-3 border-t px-4 py-2')}>{children}</div>
}
