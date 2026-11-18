import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Plus, Target, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { trackerApi } from '../api'
import { Avatar, Bar, Empty, EntityIcon, HealthBadge, ProgressRing } from '../components/bits'
import { PageTop } from '../components/PageTop'
import { DatePicker, NONE, Picker, useItems } from '../components/Picker'
import { INITIATIVE_STATUS_LABEL, INITIATIVE_STATUSES, progressOf, PROJECT_STATUS_LABEL, projectHealth, shortDate } from '../lib'
import { useTracker } from '../TrackerContext'
import type { Initiative, InitiativeStatus } from '../types'
import { Brief, ProjectStatusIcon } from './Projects'

const STATUS_ORDER: Record<InitiativeStatus, number> = { active: 0, planned: 1, completed: 2 }

/** Progress over every project of an initiative and its sub-initiatives. */
function useInitiativeProgress() {
  const { snap, idx } = useTracker()
  return (i: Initiative) => {
    const ids = new Set<string>()
    const walk = (x: Initiative, depth = 0) => {
      x.projectIds.forEach((p) => ids.add(p))
      if (depth < 10) snap.initiatives.filter((c) => c.parentId === x.id).forEach((c) => walk(c, depth + 1))
    }
    walk(i)
    return { projects: ids.size, ...progressOf(idx, snap.issues.filter((x) => x.projectId && ids.has(x.projectId))) }
  }
}

export function InitiativesPage() {
  const { snap } = useTracker()
  const [creating, setCreating] = useState(false)
  const progress = useInitiativeProgress()
  const top = snap.initiatives.filter((i) => !i.parentId || !snap.initiatives.some((p) => p.id === i.parentId)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.sortOrder - b.sortOrder)
  const row = (i: Initiative, depth: number): ReactNode => {
    const prog = progress(i)
    const owner = snap.users.find((u) => u.id === i.ownerId)
    return (
      <div key={i.id}>
        <Link to={`/initiatives/${i.id}`} className="flex items-center gap-3 border-b px-4 py-3 text-sm hover:bg-accent/50" style={{ paddingLeft: 16 + depth * 24 }}>
          <EntityIcon icon={i.icon} color={i.color} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{i.name}</span>
            {i.summary && <span className="block truncate text-xs text-muted-foreground">{i.summary}</span>}
          </span>
          <span className="rounded-full bg-muted px-2 text-xs">{INITIATIVE_STATUS_LABEL[i.status]}</span>
          <span className="hidden w-24 text-xs text-muted-foreground md:block">{prog.projects} projects</span>
          <span className="hidden w-24 text-xs text-muted-foreground md:block">{shortDate(i.targetDate) || '—'}</span>
          {owner ? <Avatar member={owner} /> : <span className="w-[18px]" />}
          <span className="flex w-16 items-center justify-end gap-2 tabular-nums">
            <ProgressRing percent={prog.percent} /> {prog.percent}%
          </span>
        </Link>
        {snap.initiatives.filter((c) => c.parentId === i.id).map((c) => row(c, depth + 1))}
      </div>
    )
  }
  return (
    <>
      <PageTop
        title="Initiatives"
        icon={<Target className="size-4 text-muted-foreground" />}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New initiative
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {top.length === 0 ? (
          <Empty title="No initiatives yet" action={<Button size="sm" onClick={() => setCreating(true)}>New initiative</Button>}>
            An initiative is a larger goal, such as a company objective, that groups the projects working toward it.
          </Empty>
        ) : (
          top.map((i) => row(i, 0))
        )}
      </div>
      <NewInitiative open={creating} onOpenChange={setCreating} />
    </>
  )
}

function NewInitiative({ open, onOpenChange, parentId }: { open: boolean; onOpenChange: (o: boolean) => void; parentId?: string }) {
  const { run, snap } = useTracker()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trk">
        <DialogHeader>
          <DialogTitle>{parentId ? 'New sub-initiative' : 'New initiative'}</DialogTitle>
        </DialogHeader>
        <form
          id="new-initiative"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => trackerApi.save('initiative', { name, icon, ownerId: snap.meId, parentId: parentId ?? null })).then((i) => {
              if (!i) return
              onOpenChange(false)
              setName('')
              setIcon('')
              navigate(`/initiatives/${i.id}`)
            })
          }}
        >
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 text-center" placeholder="🎯" aria-label="Icon (an emoji)" maxLength={8} />
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Initiative name" required />
        </form>
        <DialogFooter>
          <Button type="submit" form="new-initiative" disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const propBtn = 'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent'
function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function InitiativeDetail() {
  const { snap, idx, run } = useTracker()
  const { id } = useParams()
  const navigate = useNavigate()
  const items = useItems()
  const progress = useInitiativeProgress()
  const [sub, setSub] = useState(false)
  const ini = snap.initiatives.find((i) => i.id === id)
  const [name, setName] = useState(ini?.name ?? '')
  const [summary, setSummary] = useState(ini?.summary ?? '')
  useEffect(() => (setName(ini?.name ?? ''), setSummary(ini?.summary ?? '')), [ini?.name, ini?.summary])
  if (!ini) return <Navigate to="/initiatives" replace />
  const save = (patch: Partial<Initiative>) => void run(() => trackerApi.save('initiative', { id: ini.id, name: ini.name, ...patch }))
  const prog = progress(ini)
  const owner = snap.users.find((u) => u.id === ini.ownerId)
  const projects = snap.projects.filter((p) => ini.projectIds.includes(p.id))
  const children = snap.initiatives.filter((c) => c.parentId === ini.id)
  const parent = snap.initiatives.find((p) => p.id === ini.parentId)
  return (
    <>
      <PageTop title={ini.name} icon={<EntityIcon icon={ini.icon} color={ini.color} />}>
        {parent && (
          <Link to={`/initiatives/${parent.id}`} className="text-xs text-muted-foreground hover:text-foreground">
            in {parent.name}
          </Link>
        )}
      </PageTop>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-center gap-2">
            <input value={ini.icon} onChange={(e) => save({ icon: e.target.value })} className="w-10 bg-transparent text-center text-2xl outline-none" aria-label="Icon (an emoji)" placeholder="◻" maxLength={8} />
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== ini.name && save({ name: name.trim() })} className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Initiative name" />
          </div>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary !== ini.summary && save({ summary })} placeholder="Add a short summary…" className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none" aria-label="Summary" />
          <div className="mt-6 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-xs tracking-wide text-muted-foreground uppercase">Progress</span>
              <span className="text-2xl font-semibold tabular-nums">{prog.percent}%</span>
            </div>
            <Bar percent={prog.percent} />
            <div className="mt-2 text-xs text-muted-foreground">
              {prog.done} of {prog.total} issues done across {prog.projects} projects
            </div>
          </div>
          <section className="mt-8">
            <div className="mb-2 flex items-center">
              <h3 className="text-sm font-medium">Projects</h3>
              <span className="flex-1" />
              <Picker items={items.project().slice(1)} multi selected={ini.projectIds} onPick={(v) => save({ projectIds: ini.projectIds.includes(v) ? ini.projectIds.filter((x) => x !== v) : [...ini.projectIds, v] })} align="end">
                <Button size="sm" variant="ghost">
                  <Plus /> Add project
                </Button>
              </Picker>
            </div>
            <div className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
              {projects.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">No projects yet.</div>}
              {projects.map((p) => {
                const pp = progressOf(idx, snap.issues.filter((i) => i.projectId === p.id))
                return (
                  <div key={p.id} className="group flex items-center gap-3 px-3 py-2 text-sm">
                    <Link to={`/projects/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                      <EntityIcon icon={p.icon} color={p.color} /> <span className="truncate">{p.name}</span>
                    </Link>
                    <HealthBadge health={projectHealth(snap, p)} />
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                      <ProjectStatusIcon status={p.status} /> {PROJECT_STATUS_LABEL[p.status]}
                    </span>
                    <span className="flex w-16 items-center justify-end gap-2 text-xs tabular-nums">
                      <ProgressRing percent={pp.percent} /> {pp.percent}%
                    </span>
                    <button type="button" onClick={() => save({ projectIds: ini.projectIds.filter((x) => x !== p.id) })} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent" aria-label={`Remove ${p.name}`}>
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="mt-8">
            <div className="mb-2 flex items-center">
              <h3 className="text-sm font-medium">Sub-initiatives</h3>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setSub(true)}>
                <Plus /> Add
              </Button>
            </div>
            {children.length === 0 ? (
              <p className="text-sm text-muted-foreground">Split a big goal into smaller ones.</p>
            ) : (
              <div className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
                {children.map((c) => (
                  <Link key={c.id} to={`/initiatives/${c.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                    <EntityIcon icon={c.icon} color={c.color} /> <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{INITIATIVE_STATUS_LABEL[c.status]}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <Brief text={ini.description} onSave={(description) => save({ description })} placeholder="Describe the goal and how you will know it is reached… (Markdown)" />
          <div className="mt-10 border-t pt-4">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                if (!confirm(`Delete the initiative “${ini.name}”? Its projects stay.`)) return
                void run(() => trackerApi.remove('initiative', ini.id), 'Initiative deleted.').then(() => navigate('/initiatives'))
              }}
            >
              <Trash2 /> Delete initiative
            </Button>
          </div>
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-muted/30 p-4">
          <Prop label="Status">
            <Picker items={INITIATIVE_STATUSES.map((s) => ({ value: s, label: INITIATIVE_STATUS_LABEL[s] }))} selected={[ini.status]} onPick={(v) => save({ status: v as InitiativeStatus })}>
              <button type="button" className={propBtn}>
                {INITIATIVE_STATUS_LABEL[ini.status]}
              </button>
            </Picker>
          </Prop>
          <Prop label="Owner">
            <Picker items={items.member('No owner')} selected={[ini.ownerId ?? NONE]} onPick={(v) => save({ ownerId: v === NONE ? null : v })}>
              <button type="button" className={propBtn}>
                <Avatar member={owner} size={16} /> <span className={cn(!owner && 'text-muted-foreground')}>{owner?.name ?? 'No owner'}</span>
              </button>
            </Picker>
          </Prop>
          <Prop label="Target date">
            <DatePicker value={ini.targetDate} onChange={(v) => save({ targetDate: v })}>
              <button type="button" className={cn(propBtn, !ini.targetDate && 'text-muted-foreground')}>
                {shortDate(ini.targetDate) || 'Set target date'}
              </button>
            </DatePicker>
          </Prop>
          <Prop label="Parent">
            <Picker items={[{ value: NONE, label: 'None' }, ...snap.initiatives.filter((x) => x.id !== ini.id).map((x) => ({ value: x.id, label: x.name }))]} selected={[ini.parentId ?? NONE]} onPick={(v) => save({ parentId: v === NONE ? null : v })}>
              <button type="button" className={cn(propBtn, !parent && 'text-muted-foreground')}>
                {parent?.name ?? 'None'}
              </button>
            </Picker>
          </Prop>
        </aside>
      </div>
      <NewInitiative open={sub} onOpenChange={setSub} parentId={ini.id} />
    </>
  )
}
