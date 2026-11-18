import type { Cycle, Display, EstimateType, Filters, GroupBy, Health, InitiativeStatus, Issue, OrderBy, Project, ProjectStatus, Snapshot, StateType, Team, WorkflowState } from './types'

// ---------------------------------------------------------------- vocabulary

export const STATE_TYPES: StateType[] = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled']
export const STATE_TYPE_LABEL: Record<StateType, string> = { triage: 'Triage', backlog: 'Backlog', unstarted: 'Unstarted', started: 'Started', completed: 'Completed', canceled: 'Canceled' }

/** Priority values in display order: Urgent first, No priority last. */
export const PRIORITY_ORDER = [1, 2, 3, 4, 0]
export const PRIORITY_LABEL: Record<number, string> = { 0: 'No priority', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' }
const prioRank = (p: number) => (p === 0 ? 5 : p)

export const PROJECT_STATUSES: ProjectStatus[] = ['backlog', 'planned', 'started', 'paused', 'completed', 'canceled']
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { backlog: 'Backlog', planned: 'Planned', started: 'In progress', paused: 'Paused', completed: 'Completed', canceled: 'Canceled' }
export const INITIATIVE_STATUSES: InitiativeStatus[] = ['planned', 'active', 'completed']
export const INITIATIVE_STATUS_LABEL: Record<InitiativeStatus, string> = { planned: 'Planned', active: 'Active', completed: 'Completed' }
export const HEALTH_LABEL: Record<Health, string> = { onTrack: 'On track', atRisk: 'At risk', offTrack: 'Off track' }
export const HEALTH_CLASS: Record<Health, string> = { onTrack: 'bg-success-soft text-success-soft-foreground', atRisk: 'bg-warning-soft text-warning-soft-foreground', offTrack: 'bg-destructive/10 text-destructive' }

export const ESTIMATE_LABEL: Record<EstimateType, string> = { notUsed: 'Not used', exponential: 'Exponential (1, 2, 4, 8, 16)', fibonacci: 'Fibonacci (1, 2, 3, 5, 8)', linear: 'Linear (1, 2, 3, 4, 5)', tShirt: 'T-shirt (XS, S, M, L, XL)' }
const SCALES: Record<Exclude<EstimateType, 'notUsed'>, number[]> = { exponential: [1, 2, 4, 8, 16], fibonacci: [1, 2, 3, 5, 8], linear: [1, 2, 3, 4, 5], tShirt: [1, 2, 3, 5, 8] }
const TSHIRT: Record<number, string> = { 0: 'None', 1: 'XS', 2: 'S', 3: 'M', 5: 'L', 8: 'XL' }

/** The estimate choices of a team ([] when estimates are off). */
export function estimateOptions(team: Team | undefined): number[] {
  if (!team || team.estimateType === 'notUsed') return []
  return [...(team.allowZeroEstimates ? [0] : []), ...SCALES[team.estimateType]]
}
export function estimateLabel(team: Team | undefined, n: number | null): string {
  if (n == null) return 'No estimate'
  if (team?.estimateType === 'tShirt') return TSHIRT[n] ?? `${n}`
  return `${n} ${n === 1 ? 'point' : 'points'}`
}

export const GROUP_LABEL: Record<GroupBy, string> = { status: 'Status', assignee: 'Assignee', priority: 'Priority', project: 'Project', cycle: 'Cycle', label: 'Label', team: 'Team', none: 'No grouping' }
export const ORDER_LABEL: Record<OrderBy, string> = { manual: 'Manual', priority: 'Priority', updated: 'Last updated', created: 'Created', dueDate: 'Due date', title: 'Title' }

export const DEFAULT_DISPLAY: Display = { layout: 'list', groupBy: 'status', orderBy: 'manual', showSubIssues: true, showCompleted: 'all', showEmptyGroups: false }

export const SWATCHES = ['#5e6ad2', '#26b5ce', '#4cb782', '#f2c94c', '#f2994a', '#eb5757', '#bb87fc', '#95a2b3', '#bec2c8', '#e2e2e2']

// ---------------------------------------------------------------- dates

const DAY = 86_400_000
export const todayIso = () => isoDate(Date.now())
export const isoDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const addDays = (iso: string, n: number) => isoDate(Date.parse(`${iso}T12:00:00`) + n * DAY)
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}
export function when(ms: number | null | undefined): string {
  if (!ms) return ''
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diff > 300 * DAY ? 'numeric' : undefined })
}
export function dueTone(iso: string | null, done: boolean): 'overdue' | 'soon' | 'normal' {
  if (!iso || done) return 'normal'
  const t = todayIso()
  if (iso < t) return 'overdue'
  if (iso <= addDays(t, 2)) return 'soon'
  return 'normal'
}
/** Days left in a cycle (end date is exclusive). */
export const daysLeft = (c: Cycle) => Math.max(0, Math.round((Date.parse(`${c.endsAt}T00:00:00`) - Date.parse(`${todayIso()}T00:00:00`)) / DAY))

// ---------------------------------------------------------------- lookups

export interface Index {
  team: Map<string, Team>
  teamByKey: Map<string, Team>
  state: Map<string, WorkflowState>
  issue: Map<string, Issue>
  byIdentifier: Map<string, Issue>
  children: Map<string, Issue[]>
  /** Incoming relations: issue id -> [{ type, issueId (the other side) }]. */
  incoming: Map<string, { type: string; issueId: string }[]>
}

export function buildIndex(s: Snapshot): Index {
  const team = new Map(s.teams.map((t) => [t.id, t]))
  const idx: Index = {
    team,
    teamByKey: new Map(s.teams.map((t) => [t.key, t])),
    state: new Map(s.states.map((x) => [x.id, x])),
    issue: new Map(s.issues.map((i) => [i.id, i])),
    byIdentifier: new Map(),
    children: new Map(),
    incoming: new Map(),
  }
  for (const i of s.issues) {
    const t = team.get(i.teamId)
    if (t) idx.byIdentifier.set(`${t.key}-${i.number}`, i)
    if (i.parentId) (idx.children.get(i.parentId) ?? idx.children.set(i.parentId, []).get(i.parentId)!).push(i)
    for (const r of i.relations ?? []) (idx.incoming.get(r.issueId) ?? idx.incoming.set(r.issueId, []).get(r.issueId)!).push({ type: r.type, issueId: i.id })
  }
  return idx
}

export const identifier = (idx: Index, i: Issue) => `${idx.team.get(i.teamId)?.key ?? '?'}-${i.number}`
export const stateType = (idx: Index, i: Issue): StateType => idx.state.get(i.stateId)?.type ?? 'backlog'
export const isDone = (idx: Index, i: Issue) => ['completed', 'canceled'].includes(stateType(idx, i))

export function teamStates(s: Snapshot, teamId: string): WorkflowState[] {
  return s.states.filter((x) => x.teamId === teamId).sort((a, b) => STATE_TYPES.indexOf(a.type) - STATE_TYPES.indexOf(b.type) || a.position - b.position)
}

/** The team's current cycle, else the next one. */
export function activeCycle(s: Snapshot, teamId: string): Cycle | undefined {
  const t = todayIso()
  const mine = s.cycles.filter((c) => c.teamId === teamId).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return mine.find((c) => c.startsAt <= t && t < c.endsAt)
}
export const cycleLabel = (c: Cycle) => c.title || `Cycle ${c.number}`

export interface Progress {
  total: number
  done: number
  started: number
  percent: number
  points: number
  donePoints: number
}
export function progressOf(idx: Index, issues: Issue[]): Progress {
  let done = 0
  let started = 0
  let points = 0
  let donePoints = 0
  let counted = 0
  for (const i of issues) {
    const t = stateType(idx, i)
    if (t === 'canceled') continue
    counted++
    const p = i.estimate ?? 1
    points += p
    if (t === 'completed') {
      done++
      donePoints += p
    } else if (t === 'started') started++
  }
  return { total: counted, done, started, percent: points ? Math.round((donePoints / points) * 100) : 0, points, donePoints }
}

export const projectHealth = (s: Snapshot, p: Project): Health | undefined => s.projectUpdates.find((u) => u.projectId === p.id)?.health

// ---------------------------------------------------------------- filtering

const has = <T,>(list: T[] | undefined, v: T) => !list || list.length === 0 || list.includes(v)

export function filterCount(f: Filters): number {
  return Object.entries(f).filter(([k, v]) => k !== 'query' && (Array.isArray(v) ? v.length > 0 : v != null && v !== 'any')).length
}

export function applyFilters(idx: Index, issues: Issue[], f: Filters): Issue[] {
  const q = f.query?.trim().toLowerCase()
  const t = todayIso()
  const week = addDays(t, 7)
  return issues.filter((i) => {
    if (!has(f.stateTypes, stateType(idx, i))) return false
    if (!has(f.stateIds, i.stateId)) return false
    if (!has(f.priorities, i.priority)) return false
    if (!has(f.assigneeIds, i.assigneeId ?? null)) return false
    if (!has(f.projectIds, i.projectId ?? null)) return false
    if (!has(f.cycleIds, i.cycleId ?? null)) return false
    if (!has(f.milestoneIds, i.projectMilestoneId ?? null)) return false
    if (!has(f.teamIds, i.teamId)) return false
    if (!has(f.creatorIds, i.creatorId ?? '')) return false
    if (f.labelIds?.length && !f.labelIds.some((l) => i.labelIds.includes(l))) return false
    if (f.due === 'none' && i.dueDate) return false
    if (f.due === 'overdue' && !(i.dueDate && i.dueDate < t && !isDone(idx, i))) return false
    if (f.due === 'week' && !(i.dueDate && i.dueDate <= week)) return false
    if (q && !(`${identifier(idx, i)} ${i.title}`.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))) return false
    return true
  })
}

/** Completed/canceled issues hidden by the display's "completed issues" option. */
export function applyCompleted(idx: Index, issues: Issue[], show: Display['showCompleted']): Issue[] {
  if (show === 'all') return issues
  const since = show === 'week' ? Date.now() - 7 * DAY : show === 'month' ? Date.now() - 30 * DAY : Infinity
  return issues.filter((i) => {
    if (!isDone(idx, i)) return true
    const at = i.completedAt ?? i.canceledAt ?? i.updatedAt
    return at >= since
  })
}

export function sortIssues(idx: Index, issues: Issue[], order: OrderBy): Issue[] {
  const out = [...issues]
  const cmp: Record<OrderBy, (a: Issue, b: Issue) => number> = {
    manual: (a, b) => a.sortOrder - b.sortOrder,
    priority: (a, b) => prioRank(a.priority) - prioRank(b.priority) || a.sortOrder - b.sortOrder,
    updated: (a, b) => b.updatedAt - a.updatedAt,
    created: (a, b) => b.createdAt - a.createdAt,
    dueDate: (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || prioRank(a.priority) - prioRank(b.priority),
    title: (a, b) => a.title.localeCompare(b.title),
  }
  return out.sort((a, b) => cmp[order](a, b) || identifier(idx, a).localeCompare(identifier(idx, b)))
}

// ---------------------------------------------------------------- grouping

export interface Group {
  key: string
  label: string
  /** What dropping a card on this group sets (board), or undefined when it cannot be dropped on. */
  patch?: Partial<Issue> | 'state-type'
  stateType?: StateType
  color?: string
  kind: GroupBy
  value: string | number | null
  issues: Issue[]
}

/**
 * Split issues into groups in display order. Status groups are a team's
 * statuses when every issue is in one team, else the six status types.
 */
export function groupIssues(s: Snapshot, idx: Index, issues: Issue[], by: GroupBy, opts: { teamId?: string; showEmpty?: boolean } = {}): Group[] {
  const groups: Group[] = []
  const add = (g: Omit<Group, 'issues' | 'kind'>, match: (i: Issue) => boolean) => groups.push({ ...g, kind: by, issues: issues.filter(match) })
  const teamIds = new Set(issues.map((i) => i.teamId))
  const oneTeam = opts.teamId ?? (teamIds.size === 1 ? [...teamIds][0] : undefined)
  switch (by) {
    case 'none':
      return [{ key: 'all', label: 'All issues', kind: by, value: null, issues }]
    case 'status':
      if (oneTeam) for (const st of teamStates(s, oneTeam)) add({ key: st.id, label: st.name, color: st.color, stateType: st.type, value: st.id, patch: { stateId: st.id } }, (i) => i.stateId === st.id)
      else for (const t of STATE_TYPES) add({ key: t, label: STATE_TYPE_LABEL[t], stateType: t, value: t, patch: 'state-type' }, (i) => stateType(idx, i) === t)
      break
    case 'priority':
      for (const p of PRIORITY_ORDER) add({ key: `p${p}`, label: PRIORITY_LABEL[p], value: p, patch: { priority: p } }, (i) => i.priority === p)
      break
    case 'assignee':
      for (const u of [...s.users].sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name))) add({ key: u.id, label: u.name, color: u.color, value: u.id, patch: { assigneeId: u.id } }, (i) => i.assigneeId === u.id)
      add({ key: 'none', label: 'No assignee', value: null, patch: { assigneeId: null } }, (i) => !i.assigneeId)
      break
    case 'project':
      for (const p of [...s.projects].sort((a, b) => a.sortOrder - b.sortOrder)) add({ key: p.id, label: p.name, color: p.color, value: p.id, patch: { projectId: p.id } }, (i) => i.projectId === p.id)
      add({ key: 'none', label: 'No project', value: null, patch: { projectId: null } }, (i) => !i.projectId)
      break
    case 'cycle':
      for (const c of [...s.cycles].filter((c) => !oneTeam || c.teamId === oneTeam).sort((a, b) => b.startsAt.localeCompare(a.startsAt))) add({ key: c.id, label: `${idx.team.get(c.teamId)?.key ?? ''} · ${cycleLabel(c)}`, value: c.id, patch: oneTeam ? { cycleId: c.id } : undefined }, (i) => i.cycleId === c.id)
      add({ key: 'none', label: 'No cycle', value: null, patch: { cycleId: null } }, (i) => !i.cycleId)
      break
    case 'team':
      for (const t of s.teams) add({ key: t.id, label: t.name, color: t.color, value: t.id, patch: { teamId: t.id } }, (i) => i.teamId === t.id)
      break
    case 'label':
      for (const l of s.labels.filter((l) => !l.isGroup && (!l.teamId || !oneTeam || l.teamId === oneTeam))) add({ key: l.id, label: l.name, color: l.color, value: l.id }, (i) => i.labelIds.includes(l.id))
      add({ key: 'none', label: 'No label', value: null }, (i) => i.labelIds.length === 0)
      break
  }
  return opts.showEmpty ? groups.filter((g) => g.stateType !== 'triage' || g.issues.length > 0) : groups.filter((g) => g.issues.length > 0)
}

/** A sort order between two neighbours (manual ordering). */
export function between(before: number | undefined, after: number | undefined): number {
  if (before == null && after == null) return 0
  if (before == null) return after! - 1000
  if (after == null) return before + 1000
  return (before + after) / 2
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '').replace(/^TrackerError:\s*/, '')
}
