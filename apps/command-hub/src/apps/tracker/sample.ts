import { addDays, todayIso } from './lib'
import type { Comment, Issue, ProjectUpdate, Snapshot, Team, WorkflowState } from './types'

/**
 * Fictional data for the browser dev server (no backend there), and a tiny
 * in-memory stand-in for the backend so the page can be clicked through.
 * The real rules live in electron/apps/tracker/model.cjs.
 */

let seq = 0
const id = (p: string) => `${p}-${(++seq).toString(36)}-sample`
const now = Date.now()
const stamp = { version: 0.1, updatedAt: now }

function team(name: string, key: string, extra: Partial<Team> = {}): Team {
  return { id: id('team'), key, name, description: '', color: '#5e6ad2', icon: '', triageEnabled: true, cyclesEnabled: true, cycleDuration: 2, cycleCooldown: 0, cycleStartDate: null, upcomingCycleCount: 2, cycleAutoRollover: true, estimateType: 'fibonacci', allowZeroEstimates: false, defaultStateId: null, issueCount: 0, ...extra }
}
export function defaultStates(teamId: string): WorkflowState[] {
  const list: [string, WorkflowState['type'], string][] = [
    ['Triage', 'triage', '#fc7840'],
    ['Backlog', 'backlog', '#bec2c8'],
    ['Todo', 'unstarted', '#e2e2e2'],
    ['In Progress', 'started', '#f2c94c'],
    ['In Review', 'started', '#4cb782'],
    ['Done', 'completed', '#5e6ad2'],
    ['Canceled', 'canceled', '#95a2b3'],
    ['Duplicate', 'canceled', '#95a2b3'],
  ]
  return list.map(([name, type, color], position) => ({ id: id('state'), name, type, color, position, teamId, description: '', ...stamp }))
}

export function sampleSnapshot(): Snapshot {
  const t = todayIso()
  const prd = team('Product', 'PRD')
  const ops = team('Operations', 'OPS', { color: '#4cb782', triageEnabled: false, cyclesEnabled: false, estimateType: 'notUsed' })
  const states = [...defaultStates(prd.id), ...defaultStates(ops.id)]
  const st = (teamId: string, name: string) => states.find((s) => s.teamId === teamId && s.name === name)!.id
  prd.defaultStateId = st(prd.id, 'Todo')
  ops.defaultStateId = st(ops.id, 'Todo')
  const me = { id: id('user'), name: 'Me', email: '', color: '#5e6ad2', me: true }
  const ada = { id: id('user'), name: 'Ada Example', email: '', color: '#4cb782', me: false }
  const lin = { id: id('user'), name: 'Lin Sample', email: '', color: '#f2994a', me: false }
  const typeGroup = { id: id('label'), name: 'Type', teamId: null, parentId: null, isGroup: true, color: '#95a2b3', description: '', ...stamp }
  const bug = { id: id('label'), name: 'Bug', teamId: null, parentId: typeGroup.id, isGroup: false, color: '#eb5757', description: '', ...stamp }
  const feature = { id: id('label'), name: 'Feature', teamId: null, parentId: typeGroup.id, isGroup: false, color: '#bb87fc', description: '', ...stamp }
  const polish = { id: id('label'), name: 'Polish', teamId: null, parentId: null, isGroup: false, color: '#26b5ce', description: '', ...stamp }
  const onboarding = { id: id('project'), name: 'Onboarding refresh', summary: 'A shorter first run for new people.', description: 'Make the first ten minutes count.\n\n- One welcome screen\n- A short guided tour', icon: '🚀', color: '#5e6ad2', status: 'started' as const, priority: 2, leadId: me.id, memberIds: [me.id, lin.id], teamIds: [prd.id], startDate: addDays(t, -10), targetDate: addDays(t, 30), sortOrder: 1, createdAt: now, ...stamp }
  const search = { id: id('project'), name: 'Faster search', summary: 'Results while you type.', description: '', icon: '🔎', color: '#26b5ce', status: 'planned' as const, priority: 3, leadId: ada.id, memberIds: [ada.id], teamIds: [prd.id], startDate: null, targetDate: addDays(t, 60), sortOrder: 2, createdAt: now, ...stamp }
  const m1 = { id: id('milestone'), name: 'Welcome screen', projectId: onboarding.id, description: '', targetDate: addDays(t, 10), sortOrder: 0, ...stamp }
  const m2 = { id: id('milestone'), name: 'Guided tour', projectId: onboarding.id, description: '', targetDate: addDays(t, 25), sortOrder: 1, ...stamp }
  const c1 = { id: id('cycle'), name: '1', teamId: prd.id, number: 1, title: '', description: '', startsAt: addDays(t, -16), endsAt: addDays(t, -2), completedAt: now, ...stamp }
  const c2 = { id: id('cycle'), name: '2', teamId: prd.id, number: 2, title: '', description: '', startsAt: addDays(t, -2), endsAt: addDays(t, 12), ...stamp }
  const c3 = { id: id('cycle'), name: '3', teamId: prd.id, number: 3, title: '', description: '', startsAt: addDays(t, 12), endsAt: addDays(t, 26), ...stamp }
  const issues: Issue[] = []
  const mk = (teamRef: Team, title: string, extra: Partial<Issue>) => {
    teamRef.issueCount++
    const i: Issue = { id: id('issue'), name: String(teamRef.issueCount), number: teamRef.issueCount, title, description: '', teamId: teamRef.id, stateId: teamRef.defaultStateId!, priority: 0, estimate: null, assigneeId: null, creatorId: me.id, labelIds: [], projectId: null, projectMilestoneId: null, cycleId: null, parentId: null, dueDate: null, relations: [], sortOrder: -issues.length, createdAt: now - issues.length * 3_600_000, ...stamp, ...extra }
    issues.push(i)
    return i
  }
  const welcome = mk(prd, 'Design the new welcome screen', { stateId: st(prd.id, 'In Review'), priority: 2, assigneeId: me.id, projectId: onboarding.id, projectMilestoneId: m1.id, cycleId: c2.id, estimate: 3, labelIds: [feature.id], description: 'One screen, three choices, no wall of text.' })
  mk(prd, 'Write the copy for each welcome choice', { stateId: st(prd.id, 'In Progress'), priority: 3, assigneeId: lin.id, projectId: onboarding.id, projectMilestoneId: m1.id, cycleId: c2.id, estimate: 2, parentId: welcome.id })
  const cut = mk(prd, 'Sign-in button is cut off on narrow windows', { stateId: st(prd.id, 'Todo'), priority: 1, assigneeId: ada.id, cycleId: c2.id, estimate: 1, labelIds: [bug.id], dueDate: addDays(t, 2) })
  mk(prd, 'Search results flicker while typing', { stateId: st(prd.id, 'Backlog'), priority: 3, projectId: search.id, estimate: 5, labelIds: [bug.id], relations: [{ type: 'related', issueId: cut.id }] })
  mk(prd, 'Remember the last search', { stateId: st(prd.id, 'Backlog'), priority: 4, projectId: search.id, estimate: 2, labelIds: [feature.id] })
  mk(prd, 'Round the corners of the tour cards', { stateId: st(prd.id, 'Done'), priority: 4, assigneeId: me.id, projectId: onboarding.id, projectMilestoneId: m2.id, cycleId: c2.id, estimate: 1, labelIds: [polish.id], completedAt: now - 86_400_000 })
  mk(prd, 'Someone asked for a dark welcome screen', { stateId: st(prd.id, 'Triage') })
  mk(ops, 'Renew the example certificate', { assigneeId: me.id, priority: 2, dueDate: addDays(t, -1) })
  mk(ops, 'Tidy the shared drive folders', { stateId: st(ops.id, 'In Progress'), assigneeId: lin.id })
  return {
    teams: [prd, ops],
    users: [me, ada, lin],
    states,
    labels: [typeGroup, bug, feature, polish],
    issues,
    projects: [onboarding, search],
    milestones: [m1, m2],
    projectUpdates: [{ id: id('update'), name: 'u', projectId: onboarding.id, health: 'onTrack', body: 'The welcome screen is in review. The guided tour starts next cycle.', userId: me.id, createdAt: now - 2 * 86_400_000, ...stamp }],
    cycles: [c1, c2, c3],
    initiatives: [{ id: id('initiative'), name: 'Make the first week great', summary: 'Everything a new person meets in their first week.', description: '', icon: '🎯', color: '#f2994a', status: 'active', ownerId: me.id, targetDate: addDays(t, 90), projectIds: [onboarding.id, search.id], parentId: null, sortOrder: 0, createdAt: now, ...stamp }],
    views: [{ id: id('view'), name: 'Bugs', teamId: null, description: 'Every open bug.', icon: '🐞', color: '#eb5757', filters: { labelIds: [bug.id] }, display: { layout: 'list', groupBy: 'priority', orderBy: 'manual', showSubIssues: true, showCompleted: 'none', showEmptyGroups: false }, createdAt: now, ...stamp }],
    commentCounts: {},
    meId: me.id,
  }
}

type AnyEntity = { id: string } & Record<string, unknown>
const LISTS: Record<string, keyof Snapshot> = { user: 'users', workflowState: 'states', issueLabel: 'labels', project: 'projects', projectMilestone: 'milestones', cycle: 'cycles', initiative: 'initiatives', customView: 'views', team: 'teams' }

/** The browser stand-in for the backend: same methods, few rules. */
export function createSampleBackend() {
  let snap = sampleSnapshot()
  const comments: Comment[] = []
  const deleted: Issue[] = []
  const list = (type: string) => snap[LISTS[type]] as unknown as AnyEntity[]
  const touch = <T,>(e: T) => ({ ...e, updatedAt: Date.now(), version: Math.round(((e as { version?: number }).version ?? 0) * 10 + 1) / 10 })
  const methods: Record<string, (a: never) => unknown> = {
    snapshot: () => structuredClone({ ...snap, commentCounts: Object.fromEntries(snap.issues.map((i) => [i.id, comments.filter((c) => c.issueId === i.id).length])) }),
    createTeam: (a: Partial<Team>) => {
      const t = team(a.name ?? 'Team', (a.key ?? 'T').toUpperCase(), a)
      const states = defaultStates(t.id)
      t.defaultStateId = states[2].id
      snap = { ...snap, teams: [...snap.teams, t], states: [...snap.states, ...states] }
      return t
    },
    updateTeam: (a: Partial<Team> & { id: string }) => {
      snap = { ...snap, teams: snap.teams.map((t) => (t.id === a.id ? { ...t, ...a } : t)) }
    },
    createIssue: (a: Partial<Issue> & { triage?: boolean }) => {
      const t = snap.teams.find((x) => x.id === a.teamId)!
      t.issueCount++
      const triage = a.triage && t.triageEnabled ? snap.states.find((s) => s.teamId === t.id && s.type === 'triage')?.id : undefined
      const i: Issue = { id: id('issue'), name: String(t.issueCount), number: t.issueCount, title: a.title ?? '', description: a.description ?? '', teamId: t.id, stateId: a.stateId ?? triage ?? t.defaultStateId!, priority: a.priority ?? 0, estimate: a.estimate ?? null, assigneeId: a.assigneeId ?? null, creatorId: snap.meId, labelIds: a.labelIds ?? [], projectId: a.projectId ?? null, projectMilestoneId: a.projectMilestoneId ?? null, cycleId: a.cycleId ?? null, parentId: a.parentId ?? null, dueDate: a.dueDate ?? null, relations: a.relations ?? [], sortOrder: a.sortOrder ?? -Date.now(), createdAt: Date.now(), ...stamp }
      snap = { ...snap, issues: [...snap.issues, i] }
      return i
    },
    updateIssues: (a: { ids: string[]; patch?: Partial<Issue>; addLabelIds?: string[]; removeLabelIds?: string[] }) => {
      snap = {
        ...snap,
        issues: snap.issues.map((i) => {
          if (!a.ids.includes(i.id)) return i
          const labelIds = [...i.labelIds.filter((l) => !a.removeLabelIds?.includes(l)), ...(a.addLabelIds ?? []).filter((l) => !i.labelIds.includes(l))]
          const next = { ...i, labelIds, ...a.patch }
          const type = snap.states.find((s) => s.id === next.stateId)?.type
          if (a.patch?.stateId) next.completedAt = type === 'completed' ? Date.now() : null
          return touch(next)
        }),
      }
      return snap.issues.filter((i) => a.ids.includes(i.id))
    },
    deleteIssues: (a: { ids: string[] }) => {
      deleted.push(...snap.issues.filter((i) => a.ids.includes(i.id)))
      snap = { ...snap, issues: snap.issues.filter((i) => !a.ids.includes(i.id)) }
    },
    restoreIssues: (a: { ids: string[] }) => {
      snap = { ...snap, issues: [...snap.issues, ...deleted.filter((i) => a.ids.includes(i.id))] }
    },
    issueDetail: (a: { id: string }) => ({ comments: comments.filter((c) => c.issueId === a.id), history: [] }),
    addProjectUpdate: (a: Pick<ProjectUpdate, 'projectId' | 'health' | 'body'>) => {
      const update = { id: id('update'), name: 'u', ...a, userId: snap.meId!, createdAt: Date.now(), ...stamp }
      snap = { ...snap, projectUpdates: [update, ...snap.projectUpdates] }
      return update
    },
    scheduleCycles: () => ({ created: 0, rolledOver: 0 }),
    addExample: () => {
      snap = sampleSnapshot()
      return snap
    },
    save: (a: { type: string; entity: AnyEntity }) => {
      if (a.type === 'comment') {
        const existing = comments.find((c) => c.id === a.entity.id)
        if (existing) Object.assign(existing, { body: a.entity.body, editedAt: Date.now() })
        else comments.push({ id: id('comment'), name: 'c', issueId: a.entity.issueId as string, parentId: (a.entity.parentId as string) ?? null, body: a.entity.body as string, userId: snap.meId!, createdAt: Date.now(), editedAt: null, ...stamp })
        return
      }
      const key = LISTS[a.type]
      const items = list(a.type)
      const prev = items.find((x) => x.id === a.entity.id)
      const base = a.type === 'customView' ? { filters: {}, display: { layout: 'list', groupBy: 'status', orderBy: 'manual', showSubIssues: true, showCompleted: 'all', showEmptyGroups: false } } : {}
      const next = prev ? touch({ ...prev, ...a.entity }) : { ...base, memberIds: [], teamIds: [], projectIds: [], description: '', summary: '', icon: '', color: '#5e6ad2', status: a.type === 'initiative' ? 'planned' : 'planned', priority: 0, sortOrder: Date.now(), createdAt: Date.now(), ...stamp, ...a.entity, id: id(a.type) }
      snap = { ...snap, [key]: prev ? items.map((x) => (x.id === prev.id ? next : x)) : [...items, next] }
      return next
    },
    remove: (a: { type: string; id: string }) => {
      if (a.type === 'comment') {
        comments.splice(comments.findIndex((c) => c.id === a.id), 1)
        return
      }
      const key = LISTS[a.type]
      snap = { ...snap, [key]: list(a.type).filter((x) => x.id !== a.id) }
    },
  }
  return async function call<T>(method: string, args?: unknown): Promise<T> {
    const fn = methods[method]
    if (!fn) throw new Error(`The browser sample has no ${method}.`)
    return structuredClone(fn(args as never)) as T
  }
}
