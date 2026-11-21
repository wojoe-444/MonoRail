import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Plus, Settings, Star, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { trackerApi } from '../api'
import { Avatar, Dot, EntityIcon, StatusIcon } from '../components/bits'
import { PageTop } from '../components/PageTop'
import { startedFill } from '../components/Picker'
import { ESTIMATE_LABEL, STATE_TYPE_LABEL, STATE_TYPES, SWATCHES, teamStates } from '../lib'
import { useTracker } from '../TrackerContext'
import type { EstimateType, Label, Team, WorkflowState } from '../types'
import { NewTeamForm } from './Welcome'

function Card({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-start gap-4 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Swatch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <span className="flex flex-wrap gap-1">
      {SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={cn('size-5 rounded-full ring-offset-2 ring-offset-card', value === c && 'ring-2 ring-ring')} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={value === c} />
      ))}
    </span>
  )
}

/** Workspace settings: teams, members and workspace labels. */
export function SettingsPage() {
  const [tab, setTab] = useState<'teams' | 'members' | 'labels'>('teams')
  return (
    <>
      <PageTop title="Tracker settings" icon={<Settings className="size-4 text-muted-foreground" />}>
        <Segmented
          aria-label="Settings"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'teams', label: 'Teams' },
            { value: 'members', label: 'Members' },
            { value: 'labels', label: 'Labels' },
          ]}
        />
      </PageTop>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {tab === 'teams' && <Teams />}
          {tab === 'members' && <Members />}
          {tab === 'labels' && <Labels teamId={null} />}
        </div>
      </div>
    </>
  )
}

function Teams() {
  const { snap } = useTracker()
  return (
    <>
      <Card title="Teams" description="Every issue belongs to a team. Each team has its own workflow, cycles and identifier prefix (its key).">
        <div className="flex flex-col divide-y">
          {snap.teams.map((t) => (
            <Link key={t.id} to={`/team/${t.key}/settings`} className="flex items-center gap-3 py-2 text-sm hover:bg-accent/40">
              <EntityIcon icon={t.icon} color={t.color} />
              <span className="flex-1 font-medium">{t.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
              <span className="w-24 text-right text-xs text-muted-foreground">{snap.issues.filter((i) => i.teamId === t.id).length} issues</span>
            </Link>
          ))}
        </div>
      </Card>
      <Card title="New team">
        <NewTeamForm />
      </Card>
    </>
  )
}

function Members() {
  const { snap, run } = useTracker()
  const [name, setName] = useState('')
  return (
    <Card title="Members" description="The people you assign issues to and who lead projects. They are names only: nobody signs in, and nothing is sent to them.">
      <div className="flex flex-col divide-y">
        {snap.users.map((u) => (
          <MemberRow key={u.id} id={u.id} />
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => trackerApi.save('user', { name })).then((u) => u && setName(''))
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Button type="submit" disabled={!name.trim()}>
          <Plus /> Add member
        </Button>
      </form>
    </Card>
  )
}

function MemberRow({ id }: { id: string }) {
  const { snap, run } = useTracker()
  const u = snap.users.find((x) => x.id === id)!
  const [name, setName] = useState(u.name)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync the name draft when the saved user name changes.
  useEffect(() => setName(u.name), [u.name])
  const save = (patch: { name?: string; color?: string }) => void run(() => trackerApi.save('user', { id: u.id, name: u.name, color: u.color, ...patch }))
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar member={u} size={24} />
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== u.name && save({ name: name.trim() })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Name" />
      {u.me && <span className="rounded-full bg-muted px-2 text-xs">You</span>}
      <Swatch value={u.color} onChange={(color) => save({ color })} />
      {!u.me && (
        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" aria-label={`Remove ${u.name}`} onClick={() => confirm(`Remove ${u.name}? Their issues become unassigned.`) && void run(() => trackerApi.remove('user', u.id))}>
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

function Labels({ teamId }: { teamId: string | null }) {
  const { snap, run } = useTracker()
  const [name, setName] = useState('')
  const [group, setGroup] = useState(false)
  const mine = snap.labels.filter((l) => l.teamId === teamId)
  const groups = mine.filter((l) => l.isGroup)
  const loose = mine.filter((l) => !l.isGroup && !l.parentId)
  return (
    <Card title={teamId ? 'Team labels' : 'Workspace labels'} description={teamId ? 'Labels only this team uses.' : 'Labels every team can use. A label group holds labels of which an issue gets at most one, like Type: Bug, Feature.'}>
      <div className="flex flex-col gap-1">
        {loose.map((l) => (
          <LabelRow key={l.id} label={l} />
        ))}
        {groups.map((g) => (
          <div key={g.id} className="mt-2">
            <LabelRow label={g} />
            <div className="ml-6 border-l pl-3">
              {mine
                .filter((l) => l.parentId === g.id)
                .map((l) => (
                  <LabelRow key={l.id} label={l} />
                ))}
              <AddLabel teamId={teamId} parentId={g.id} />
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => trackerApi.save('issueLabel', { name, teamId, isGroup: group })).then((l) => l && setName(''))
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={group ? 'Group name' : 'Label name'} />
        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={group} onCheckedChange={setGroup} /> Group
        </label>
        <Button type="submit" disabled={!name.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </Card>
  )
}

function AddLabel({ teamId, parentId }: { teamId: string | null; parentId: string }) {
  const { run } = useTracker()
  const [name, setName] = useState('')
  return (
    <form className="flex items-center gap-2 py-1" onSubmit={(e) => (e.preventDefault(), void run(() => trackerApi.save('issueLabel', { name, teamId, parentId })).then((l) => l && setName('')))}>
      <Plus className="size-3.5 text-muted-foreground" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a label to this group" className="h-7 flex-1 bg-transparent text-sm outline-none" />
    </form>
  )
}

function LabelRow({ label }: { label: Label }) {
  const { snap, run } = useTracker()
  const [name, setName] = useState(label.name)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync the name draft when the saved label name changes.
  useEffect(() => setName(label.name), [label.name])
  const used = snap.issues.filter((i) => i.labelIds.includes(label.id)).length
  const save = (patch: Partial<Label>) => void run(() => trackerApi.save('issueLabel', { id: label.id, name: label.name, color: label.color, ...patch }))
  return (
    <div className="group flex items-center gap-2 py-1">
      <Dot color={label.color} className={label.isGroup ? 'rounded-[3px]' : ''} />
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== label.name && save({ name: name.trim() })} className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none', label.isGroup && 'font-medium')} aria-label="Label name" />
      {!label.isGroup && <span className="text-xs text-muted-foreground">{used} issues</span>}
      <span className="hidden group-hover:flex">
        <Swatch value={label.color} onChange={(color) => save({ color })} />
      </span>
      <Button size="icon" variant="ghost" className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100" aria-label={`Delete ${label.name}`} onClick={() => confirm(label.isGroup ? `Delete the group “${label.name}”? Its labels stay, outside any group.` : `Delete the label “${label.name}”? It is taken off ${used} issues.`) && void run(() => trackerApi.remove('issueLabel', label.id))}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- one team

export function TeamSettingsPage() {
  const { idx } = useTracker()
  const { key } = useParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  if (!team) return <Navigate to="/settings" replace />
  return (
    <>
      <PageTop title={`${team.name} · Settings`} icon={<EntityIcon icon={team.icon} color={team.color} />} />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <General team={team} />
          <Workflow team={team} />
          <Planning team={team} />
          <Labels teamId={team.id} />
          <DeleteTeam team={team} />
        </div>
      </div>
    </>
  )
}

function useTeamSave(team: Team) {
  const { run } = useTracker()
  const navigate = useNavigate()
  return (patch: Partial<Team>) =>
    void run(() => trackerApi.updateTeam({ id: team.id, ...patch })).then((t) => {
      if (t && patch.key && t.key !== team.key) navigate(`/team/${t.key}/settings`, { replace: true })
    })
}

function General({ team }: { team: Team }) {
  const save = useTeamSave(team)
  const [name, setName] = useState(team.name)
  const [key, setKey] = useState(team.key)
  const [desc, setDesc] = useState(team.description)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync the team settings drafts when their saved values change.
  useEffect(() => (setName(team.name), setKey(team.key), setDesc(team.description)), [team.name, team.key, team.description])
  return (
    <Card title="General">
      <div className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm">
        <span className="text-muted-foreground">Icon and name</span>
        <span className="flex gap-2">
          <Input value={team.icon} onChange={(e) => save({ icon: e.target.value })} className="w-14 text-center" placeholder="◻" aria-label="Icon (an emoji)" maxLength={8} />
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== team.name && save({ name: name.trim() })} aria-label="Team name" />
        </span>
        <span className="text-muted-foreground">Key</span>
        <span className="flex items-center gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} onBlur={() => key !== team.key && save({ key })} className="w-28 font-mono" aria-label="Team key" maxLength={7} />
          <span className="text-xs text-muted-foreground">Issue identifiers start with it, like {team.key}-1. Changing it renames every identifier.</span>
        </span>
        <span className="text-muted-foreground">Description</span>
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== team.description && save({ description: desc })} placeholder="What the team works on" />
        <span className="text-muted-foreground">Color</span>
        <Swatch value={team.color} onChange={(color) => save({ color })} />
      </div>
    </Card>
  )
}

function Workflow({ team }: { team: Team }) {
  const { snap, run } = useTracker()
  const states = teamStates(snap, team.id)
  const save = useTeamSave(team)
  return (
    <Card title="Workflow" description="The statuses an issue moves through. Each status has a type, which decides where it shows and what counts as done.">
      <div className="flex flex-col gap-4">
        {STATE_TYPES.filter((t) => t !== 'triage' || team.triageEnabled).map((type) => {
          const list = states.filter((s) => s.type === type)
          return (
            <div key={type}>
              <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{STATE_TYPE_LABEL[type]}</div>
              <div className="flex flex-col rounded-lg ring-1 ring-foreground/10">
                {list.map((s) => (
                  <StateRow key={s.id} state={s} states={states} isDefault={team.defaultStateId === s.id} onDefault={['backlog', 'unstarted'].includes(type) ? () => save({ defaultStateId: s.id }) : undefined} />
                ))}
                {type !== 'triage' && (
                  <form
                    className="flex items-center gap-2 px-3 py-1.5"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const input = (e.target as HTMLFormElement).elements.namedItem('name') as HTMLInputElement
                      if (!input.value.trim()) return
                      void run(() => trackerApi.save('workflowState', { teamId: team.id, type, name: input.value, position: list.length })).then((x) => x && (input.value = ''))
                    }}
                  >
                    <Plus className="size-3.5 text-muted-foreground" />
                    <input name="name" placeholder={`Add a ${STATE_TYPE_LABEL[type].toLowerCase()} status`} className="h-7 flex-1 bg-transparent text-sm outline-none" />
                  </form>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function StateRow({ state, states, isDefault, onDefault }: { state: WorkflowState; states: WorkflowState[]; isDefault: boolean; onDefault?: () => void }) {
  const { snap, run, toast } = useTracker()
  const [name, setName] = useState(state.name)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync the name draft when the saved workflow state changes.
  useEffect(() => setName(state.name), [state.name])
  const used = snap.issues.filter((i) => i.stateId === state.id).length
  const save = (patch: Partial<WorkflowState>) => void run(() => trackerApi.save('workflowState', { id: state.id, name: state.name, color: state.color, ...patch }))
  const remove = () => {
    let moveTo: string | undefined
    if (used) {
      const others = states.filter((s) => s.id !== state.id && s.type !== 'triage')
      const pick = others.find((s) => s.type === state.type) ?? others[0]
      if (!pick) return toast({ text: 'There is no other status to move its issues to.', tone: 'error' })
      if (!confirm(`Delete “${state.name}”? Its ${used} issues move to “${pick.name}”.`)) return
      moveTo = pick.id
    } else if (!confirm(`Delete the status “${state.name}”?`)) return
    void run(() => trackerApi.remove('workflowState', state.id, moveTo))
  }
  return (
    <div className="group flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
      <StatusIcon type={state.type} color={state.color} fill={startedFill(states, state.id)} />
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== state.name && save({ name: name.trim() })} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Status name" />
      <span className="text-xs text-muted-foreground">{used} issues</span>
      {isDefault ? (
        <span className="flex items-center gap-1 rounded-full bg-primary-soft px-2 text-xs text-primary-soft-foreground">
          <Star className="size-3" /> Default
        </span>
      ) : (
        onDefault && (
          <button type="button" onClick={onDefault} className="hidden text-xs text-muted-foreground group-hover:inline hover:text-foreground">
            Make default
          </button>
        )
      )}
      <span className="hidden group-hover:flex">
        <Swatch value={state.color} onChange={(color) => save({ color })} />
      </span>
      {state.type !== 'triage' && (
        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100" onClick={remove} aria-label={`Delete ${state.name}`}>
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function Planning({ team }: { team: Team }) {
  const save = useTeamSave(team)
  const row = 'flex items-center justify-between gap-4 py-2 text-sm'
  return (
    <Card title="Triage, cycles and estimates">
      <label className={row}>
        <span>
          <span className="block font-medium">Triage</span>
          <span className="text-muted-foreground">New issues can land in a Triage inbox until someone accepts, declines or merges them.</span>
        </span>
        <Switch checked={team.triageEnabled} onCheckedChange={(v) => save({ triageEnabled: v })} />
      </label>
      <div className="my-2 border-t" />
      <label className={row}>
        <span>
          <span className="block font-medium">Cycles</span>
          <span className="text-muted-foreground">Back-to-back periods of work. Tracker makes upcoming cycles for you.</span>
        </span>
        <Switch checked={team.cyclesEnabled} onCheckedChange={(v) => save({ cyclesEnabled: v })} />
      </label>
      {team.cyclesEnabled && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-2 text-sm md:grid-cols-4">
          <NumberField label="Length (weeks)" value={team.cycleDuration} min={1} max={8} onChange={(v) => save({ cycleDuration: v })} />
          <NumberField label="Cooldown (weeks)" value={team.cycleCooldown} min={0} max={4} onChange={(v) => save({ cycleCooldown: v })} />
          <NumberField label="Upcoming cycles" value={team.upcomingCycleCount} min={1} max={6} onChange={(v) => save({ upcomingCycleCount: v })} />
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">First cycle starts</span>
            <input type="date" defaultValue={team.cycleStartDate ?? ''} onChange={(e) => save({ cycleStartDate: e.target.value || null })} className="h-9 rounded-md border bg-card px-2 text-sm" />
          </label>
          <label className="col-span-2 flex items-center gap-2 md:col-span-4">
            <Switch checked={team.cycleAutoRollover} onCheckedChange={(v) => save({ cycleAutoRollover: v })} />
            <span>Move unfinished issues to the next cycle when one ends</span>
          </label>
        </div>
      )}
      <div className="my-2 border-t" />
      <div className={row}>
        <span>
          <span className="block font-medium">Estimates</span>
          <span className="text-muted-foreground">How much work an issue is, in points. Progress is weighted by them.</span>
        </span>
        <select value={team.estimateType} onChange={(e) => save({ estimateType: e.target.value as EstimateType })} className="h-9 rounded-md border bg-card px-2 text-sm">
          {(Object.keys(ESTIMATE_LABEL) as EstimateType[]).map((t) => (
            <option key={t} value={t}>
              {ESTIMATE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      {team.estimateType !== 'notUsed' && (
        <label className={row}>
          <span className="text-muted-foreground">Allow zero estimates</span>
          <Switch checked={team.allowZeroEstimates} onCheckedChange={(v) => save({ allowZeroEstimates: v })} />
        </label>
      )}
    </Card>
  )
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type="number" min={min} max={max} defaultValue={value} onBlur={(e) => Number(e.target.value) !== value && onChange(Number(e.target.value))} className="h-9 rounded-md border bg-card px-2 text-sm" />
    </label>
  )
}

function DeleteTeam({ team }: { team: Team }) {
  const { run } = useTracker()
  const navigate = useNavigate()
  return (
    <Card title="Delete team" description="Only a team without issues can be deleted (move or delete them first). Its statuses, labels, cycles and views go with it.">
      <Button variant="outline" className="text-destructive" onClick={() => confirm(`Delete the team ${team.name}?`) && void run(() => trackerApi.remove('team', team.id), 'Team deleted.').then(() => navigate('/settings'))}>
        <Trash2 /> Delete {team.name}
      </Button>
    </Card>
  )
}
