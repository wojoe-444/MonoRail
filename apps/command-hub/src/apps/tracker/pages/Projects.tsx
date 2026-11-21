import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Layers, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { ChatMarkdown } from '@/modules/agent-chat/ChatMarkdown'
import { cn } from '@/lib/utils'

import { trackerApi } from '../api'
import { Avatar, Bar, Empty, EntityIcon, HealthBadge, PriorityIcon, ProgressRing } from '../components/bits'
import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { DatePicker, NONE, Picker, useItems, type PickItem } from '../components/Picker'
import { HEALTH_LABEL, PRIORITY_LABEL, progressOf, PROJECT_STATUS_LABEL, PROJECT_STATUSES, projectHealth, shortDate, when } from '../lib'
import { useTracker } from '../TrackerContext'
import type { Health, Project, ProjectStatus } from '../types'

type Tab = 'all' | 'active' | 'planned' | 'done'
const TAB_STATUSES: Record<Tab, ProjectStatus[] | undefined> = { all: undefined, active: ['started', 'paused'], planned: ['backlog', 'planned'], done: ['completed', 'canceled'] }

export function ProjectStatusIcon({ status, className }: { status: ProjectStatus; className?: string }) {
  const color = { backlog: 'var(--muted-foreground)', planned: 'var(--muted-foreground)', started: 'var(--warning)', paused: 'var(--muted-foreground)', completed: 'var(--primary)', canceled: 'var(--muted-foreground)' }[status]
  const fill = { backlog: 0, planned: 0, started: 0.5, paused: 0.5, completed: 1, canceled: 1 }[status]
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className={cn('shrink-0', className)} role="img" aria-label={PROJECT_STATUS_LABEL[status]}>
      <rect x="1.5" y="1.5" width="11" height="11" rx="3" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={status === 'backlog' ? '2 1.6' : undefined} />
      {fill > 0 && <rect x="4" y={4 + 6 * (1 - fill)} width="6" height={6 * fill} rx="1" fill={color} />}
    </svg>
  )
}

export function statusItems(): PickItem[] {
  return PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s], icon: <ProjectStatusIcon status={s} /> }))
}

/** Every project (or a team's), with health from its latest update and progress from its issues. */
export function ProjectsPage() {
  const { snap, idx } = useTracker()
  const { key } = useParams()
  const team = key ? idx.teamByKey.get(key) : undefined
  const [tab, setTab] = useState<Tab>('all')
  const [creating, setCreating] = useState(false)
  const statuses = TAB_STATUSES[tab]
  const projects = snap.projects.filter((p) => (!team || p.teamIds.includes(team.id)) && (!statuses || statuses.includes(p.status))).sort((a, b) => PROJECT_STATUSES.indexOf(a.status) - PROJECT_STATUSES.indexOf(b.status) || a.sortOrder - b.sortOrder)
  return (
    <>
      <PageTop
        title={team ? `${team.name} · Projects` : 'Projects'}
        icon={<Layers className="size-4 text-muted-foreground" />}
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New project
          </Button>
        }
      >
        <Segmented
          aria-label="Which projects"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'planned', label: 'Planned' },
            { value: 'done', label: 'Done' },
          ]}
        />
      </PageTop>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <Empty title="No projects here" action={<Button size="sm" onClick={() => setCreating(true)}>New project</Button>}>
            A project is a piece of work with a goal and a target date, such as a new feature. Its issues can come from several teams.
          </Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-normal">Name</th>
                <th className="px-2 py-2 text-left font-normal">Health</th>
                <th className="hidden px-2 py-2 text-left font-normal md:table-cell">Priority</th>
                <th className="hidden px-2 py-2 text-left font-normal md:table-cell">Lead</th>
                <th className="hidden px-2 py-2 text-left font-normal lg:table-cell">Target date</th>
                <th className="px-2 py-2 text-left font-normal">Status</th>
                <th className="px-4 py-2 text-right font-normal">Progress</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const prog = progressOf(idx, snap.issues.filter((i) => i.projectId === p.id))
                const lead = snap.users.find((u) => u.id === p.leadId)
                return (
                  <tr key={p.id} className="border-b hover:bg-accent/50">
                    <td className="px-4 py-2">
                      <Link to={`/projects/${p.id}`} className="flex items-center gap-2 font-medium">
                        <EntityIcon icon={p.icon} color={p.color} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                      {p.summary && <div className="truncate pl-6 text-xs text-muted-foreground">{p.summary}</div>}
                    </td>
                    <td className="px-2 py-2">
                      <HealthBadge health={projectHealth(snap, p)} />
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <PriorityIcon priority={p.priority} />
                        {PRIORITY_LABEL[p.priority]}
                      </span>
                    </td>
                    <td className="hidden px-2 py-2 md:table-cell">{lead ? <Avatar member={lead} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="hidden px-2 py-2 text-muted-foreground lg:table-cell">{shortDate(p.targetDate) || '—'}</td>
                    <td className="px-2 py-2">
                      <span className="flex items-center gap-1.5">
                        <ProjectStatusIcon status={p.status} />
                        {PROJECT_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex items-center justify-end gap-2 tabular-nums">
                        <ProgressRing percent={prog.percent} />
                        {prog.percent}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <NewProject open={creating} onOpenChange={setCreating} teamId={team?.id} />
    </>
  )
}

function NewProject({ open, onOpenChange, teamId }: { open: boolean; onOpenChange: (o: boolean) => void; teamId?: string }) {
  const { run, snap } = useTracker()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [icon, setIcon] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="trk">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form
          id="new-project"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => trackerApi.save('project', { name, summary, icon, teamIds: teamId ? [teamId] : snap.teams.length === 1 ? [snap.teams[0].id] : [], leadId: snap.meId })).then((p) => {
              if (!p) return
              onOpenChange(false)
              setName('')
              setSummary('')
              setIcon('')
              navigate(`/projects/${p.id}`)
            })
          }}
        >
          <div className="flex gap-2">
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-14 text-center" placeholder="🚀" aria-label="Icon (an emoji)" maxLength={8} />
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
          </div>
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Short summary (optional)" maxLength={255} />
        </form>
        <DialogFooter>
          <Button type="submit" form="new-project" disabled={!name.trim()}>
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- one project

export function ProjectDetail() {
  const { snap } = useTracker()
  const { id } = useParams()
  const [tab, setTab] = useState<'overview' | 'issues'>('overview')
  const project = snap.projects.find((p) => p.id === id)
  if (!project) return <Navigate to="/projects" replace />
  return (
    <>
      <PageTop title={project.name} icon={<EntityIcon icon={project.icon} color={project.color} />}>
        <Segmented
          aria-label="Project page"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'issues', label: `Issues ${snap.issues.filter((i) => i.projectId === project.id).length}` },
          ]}
        />
      </PageTop>
      {tab === 'overview' ? <ProjectOverview project={project} /> : <IssueBrowser issues={snap.issues.filter((i) => i.projectId === project.id)} storageKey={`project-${project.id}`} createDefaults={{ projectId: project.id, teamId: project.teamIds[0] }} initialDisplay={{ groupBy: 'status' }} />}
    </>
  )
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
const propBtn = 'flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent'

function ProjectOverview({ project }: { project: Project }) {
  const { snap, idx, run } = useTracker()
  const navigate = useNavigate()
  const items = useItems()
  const save = (patch: Partial<Project>) => void run(() => trackerApi.save('project', { id: project.id, name: project.name, ...patch }))
  const issues = snap.issues.filter((i) => i.projectId === project.id)
  const prog = progressOf(idx, issues)
  const updates = snap.projectUpdates.filter((u) => u.projectId === project.id)
  const lead = snap.users.find((u) => u.id === project.leadId)
  const [name, setName] = useState(project.name)
  const [summary, setSummary] = useState(project.summary)
  // oxlint-disable-next-line react/set-state-in-effect -- Resync project drafts when their saved values change.
  useEffect(() => (setName(project.name), setSummary(project.summary)), [project.name, project.summary])
  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="flex items-center gap-2">
          <input value={project.icon} onChange={(e) => save({ icon: e.target.value })} className="w-10 bg-transparent text-center text-2xl outline-none" aria-label="Icon (an emoji)" placeholder="◻" maxLength={8} />
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== project.name && save({ name: name.trim() })} className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none" aria-label="Project name" />
        </div>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => summary !== project.summary && save({ summary })} placeholder="Add a short summary…" className="mt-1 w-full bg-transparent text-sm text-muted-foreground outline-none" aria-label="Summary" />
        <div className="mt-6 grid grid-cols-3 gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
          <Stat label="Progress" value={`${prog.percent}%`} />
          <Stat label="Issues done" value={`${prog.done} / ${prog.total}`} />
          <Stat label="In progress" value={String(prog.started)} />
          <div className="col-span-3">
            <Bar percent={prog.percent} />
          </div>
        </div>
        <Brief text={project.description} onSave={(description) => save({ description })} />
        <Milestones projectId={project.id} />
        <Updates projectId={project.id} />
        <div className="mt-10 border-t pt-4">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (!confirm(`Delete the project “${project.name}”? Its issues stay, without a project. Milestones and updates are removed.`)) return
              void run(() => trackerApi.remove('project', project.id), 'Project deleted.').then(() => navigate('/projects'))
            }}
          >
            <Trash2 /> Delete project
          </Button>
        </div>
      </div>
      <aside className="w-72 shrink-0 overflow-y-auto border-l bg-muted/30 p-4">
        <Prop label="Status">
          <Picker items={statusItems()} selected={[project.status]} onPick={(v) => save({ status: v as ProjectStatus })}>
            <button type="button" className={propBtn}>
              <ProjectStatusIcon status={project.status} /> {PROJECT_STATUS_LABEL[project.status]}
            </button>
          </Picker>
        </Prop>
        <Prop label="Health">
          <span className="px-2">
            <HealthBadge health={updates[0]?.health} />
          </span>
        </Prop>
        <Prop label="Priority">
          <Picker items={items.priority()} selected={[String(project.priority)]} onPick={(v) => save({ priority: Number(v) })}>
            <button type="button" className={propBtn}>
              <PriorityIcon priority={project.priority} className="text-muted-foreground" /> {PRIORITY_LABEL[project.priority]}
            </button>
          </Picker>
        </Prop>
        <Prop label="Lead">
          <Picker items={items.member('No lead')} selected={[project.leadId ?? NONE]} onPick={(v) => save({ leadId: v === NONE ? null : v })}>
            <button type="button" className={propBtn}>
              <Avatar member={lead} size={16} /> <span className={cn(!lead && 'text-muted-foreground')}>{lead?.name ?? 'No lead'}</span>
            </button>
          </Picker>
        </Prop>
        <Prop label="Members">
          <Picker items={items.member().slice(1)} multi selected={project.memberIds} onPick={(v) => save({ memberIds: project.memberIds.includes(v) ? project.memberIds.filter((m) => m !== v) : [...project.memberIds, v] })}>
            <button type="button" className={propBtn}>
              {project.memberIds.length ? (
                <span className="flex -space-x-1">
                  {project.memberIds.map((m) => (
                    <Avatar key={m} member={snap.users.find((u) => u.id === m)} size={18} className="ring-2 ring-background" />
                  ))}
                </span>
              ) : (
                <span className="text-muted-foreground">Add members</span>
              )}
            </button>
          </Picker>
        </Prop>
        <Prop label="Teams">
          <Picker items={items.team()} multi selected={project.teamIds} onPick={(v) => save({ teamIds: project.teamIds.includes(v) ? project.teamIds.filter((m) => m !== v) : [...project.teamIds, v] })}>
            <button type="button" className={cn(propBtn, 'truncate')}>
              {project.teamIds.length ? project.teamIds.map((t) => idx.team.get(t)?.key).join(', ') : <span className="text-muted-foreground">Add teams</span>}
            </button>
          </Picker>
        </Prop>
        <Prop label="Start date">
          <DatePicker value={project.startDate} onChange={(v) => save({ startDate: v })}>
            <button type="button" className={cn(propBtn, !project.startDate && 'text-muted-foreground')}>
              {shortDate(project.startDate) || 'Set start date'}
            </button>
          </DatePicker>
        </Prop>
        <Prop label="Target date">
          <DatePicker value={project.targetDate} onChange={(v) => save({ targetDate: v })}>
            <button type="button" className={cn(propBtn, !project.targetDate && 'text-muted-foreground')}>
              {shortDate(project.targetDate) || 'Set target date'}
            </button>
          </DatePicker>
        </Prop>
        <div className="mt-4 text-xs text-muted-foreground">
          Created {when(project.createdAt)}
          {project.completedAt ? ` · completed ${when(project.completedAt)}` : ''}
        </div>
        {snap.initiatives.some((i) => i.projectIds.includes(project.id)) && (
          <div className="mt-4">
            <div className="mb-1 text-xs text-muted-foreground">Initiatives</div>
            {snap.initiatives
              .filter((i) => i.projectIds.includes(project.id))
              .map((i) => (
                <Link key={i.id} to={`/initiatives/${i.id}`} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
                  <EntityIcon icon={i.icon} color={i.color} size={14} /> {i.name}
                </Link>
              ))}
          </div>
        )}
      </aside>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function Brief({ text, onSave, placeholder = 'Write a brief: the goal, why it matters, what done looks like… (Markdown)' }: { text: string; onSave: (t: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Refresh the draft from saved text only while the editor is closed.
    if (!editing) setValue(text)
  }, [text, editing])
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-medium">Description</h3>
      {editing ? (
        <>
          <Textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="field-sizing-content min-h-32 font-mono text-[13px]" />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => (onSave(value), setEditing(false))}>
              Save
            </Button>
          </div>
        </>
      ) : (
        <div role="button" tabIndex={0} onClick={() => setEditing(true)} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} className="min-h-12 cursor-text rounded-md py-1 text-sm hover:bg-accent/40">
          {text.trim() ? <ChatMarkdown text={text} /> : <span className="text-muted-foreground">{placeholder}</span>}
        </div>
      )}
    </section>
  )
}

function Milestones({ projectId }: { projectId: string }) {
  const { snap, idx, run } = useTracker()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const list = snap.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder)
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-medium">Milestones</h3>
      <div className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
        {list.map((m) => {
          const prog = progressOf(idx, snap.issues.filter((i) => i.projectMilestoneId === m.id))
          return (
            <div key={m.id} className="group flex items-center gap-3 px-3 py-2 text-sm">
              <ProgressRing percent={prog.percent} />
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {prog.done}/{prog.total} · {prog.percent}%
              </span>
              <DatePicker value={m.targetDate} onChange={(v) => void run(() => trackerApi.save('projectMilestone', { id: m.id, name: m.name, targetDate: v }))} align="end">
                <button type="button" className="w-20 rounded px-1 text-right text-xs text-muted-foreground hover:bg-accent">
                  {shortDate(m.targetDate) || 'No date'}
                </button>
              </DatePicker>
              <button type="button" onClick={() => void run(() => trackerApi.remove('projectMilestone', m.id))} className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label={`Delete milestone ${m.name}`}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )
        })}
        <form
          className="flex items-center gap-2 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            void run(() => trackerApi.save('projectMilestone', { projectId, name, targetDate: date || null })).then((m) => m && (setName(''), setDate('')))
          }}
        >
          <Plus className="size-4 text-muted-foreground" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a milestone" className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 rounded border bg-card px-1 text-xs" aria-label="Target date" />
          <Button size="sm" variant="ghost" type="submit" disabled={!name.trim()}>
            Add
          </Button>
        </form>
      </div>
    </section>
  )
}

function Updates({ projectId }: { projectId: string }) {
  const { snap, run } = useTracker()
  const [health, setHealth] = useState<Health>('onTrack')
  const [body, setBody] = useState('')
  const list = snap.projectUpdates.filter((u) => u.projectId === projectId)
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-sm font-medium">Updates</h3>
      <div className="rounded-xl p-3 ring-1 ring-foreground/10">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How is the project going? (Markdown)" className="field-sizing-content min-h-16 w-full resize-none bg-transparent text-sm outline-none" />
        <div className="flex items-center gap-2">
          <Segmented aria-label="Health" value={health} onChange={setHealth} options={(Object.keys(HEALTH_LABEL) as Health[]).map((h) => ({ value: h, label: HEALTH_LABEL[h] }))} />
          <span className="flex-1" />
          <Button size="sm" disabled={!body.trim()} onClick={() => void run(() => trackerApi.addProjectUpdate({ projectId, health, body }), 'Update posted.').then(() => setBody(''))}>
            Post update
          </Button>
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-3">
        {list.map((u) => {
          const author = snap.users.find((x) => x.id === u.userId)
          return (
            <li key={u.id} className="group rounded-xl p-3 ring-1 ring-foreground/10">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <HealthBadge health={u.health} />
                <Avatar member={author} size={16} />
                {author?.name} · {when(u.createdAt)}
                <span className="flex-1" />
                <button type="button" onClick={() => void run(() => trackerApi.remove('projectUpdate', u.id))} className="opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label="Delete update">
                  <Trash2 className="size-3" />
                </button>
              </div>
              <div className="text-sm">
                <ChatMarkdown text={u.body} />
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
