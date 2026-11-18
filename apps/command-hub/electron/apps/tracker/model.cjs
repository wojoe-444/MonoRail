// Tracker: issues, projects, cycles and initiatives, kept in MonoRail's local
// database (electron/localdb) as entities of the MonoRail standard.
// docs/tracker.md (reference), docs/guide/workspace/tracker.md (guide).
//
// Entity types (standard.json, category "tracker"):
//   team, user          OpenMetadata's own types, adopted whole. Tracker's
//                       fields go in `extension.tracker`; only teams and users
//                       carrying that key belong to Tracker.
//   issue, workflowState, issueLabel, project, projectMilestone,
//   projectUpdate, cycle, initiative, customView, comment
//                       MonoRail's own types, shaped after the planning model
//                       of tools like Linear (field names kept where they fit).
//
// Every write goes through the local database's `put`, so each entity keeps
// every version: an issue's history is worked out from them (`history`).
// Names are unique in their scope; a child's full name starts with its
// parent's id (`<teamId>.<number>` for an issue), so renaming a team or a
// project never touches its children. Issues are deleted softly
// (`deleted: true`, restorable); everything else is removed for good, with its
// references cleared in the same transaction. No Electron here: the tests and
// the MCP server can use it.

const { randomUUID } = require('node:crypto')

const STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled']
const PROJECT_STATUSES = ['backlog', 'planned', 'started', 'paused', 'completed', 'canceled']
const INITIATIVE_STATUSES = ['planned', 'active', 'completed']
const HEALTH = ['onTrack', 'atRisk', 'offTrack']
const ESTIMATE_TYPES = ['notUsed', 'exponential', 'fibonacci', 'linear', 'tShirt']
const RELATION_TYPES = ['blocks', 'related', 'duplicate']
const OWN_TYPES = ['issue', 'workflowState', 'issueLabel', 'project', 'projectMilestone', 'projectUpdate', 'cycle', 'initiative', 'customView', 'comment']
const ALL_TYPES = ['team', 'user', ...OWN_TYPES]
const COLORS = ['#5e6ad2', '#26b5ce', '#4cb782', '#f2c94c', '#f2994a', '#eb5757', '#bb87fc', '#95a2b3']

/** The workflow a new team starts with (Linear's default set). */
const DEFAULT_STATES = [
  { name: 'Triage', type: 'triage', color: '#fc7840' },
  { name: 'Backlog', type: 'backlog', color: '#bec2c8' },
  { name: 'Todo', type: 'unstarted', color: '#e2e2e2', default: true },
  { name: 'In Progress', type: 'started', color: '#f2c94c' },
  { name: 'In Review', type: 'started', color: '#4cb782' },
  { name: 'Done', type: 'completed', color: '#5e6ad2' },
  { name: 'Canceled', type: 'canceled', color: '#95a2b3' },
  { name: 'Duplicate', type: 'canceled', color: '#95a2b3' },
]

class TrackerError extends Error {}
const fail = (msg) => {
  throw new TrackerError(msg)
}

// ---------------------------------------------------------------- field checks

const str = (v, max, what, { required = false } = {}) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : fail(`${what} must be text.`)
  if (required && !s) fail(`${what} is required.`)
  if (s.length > max) fail(`${what} can be at most ${max} characters.`)
  return s
}
const text = (v, max = 100_000) => (v == null ? '' : typeof v === 'string' ? (v.length > max ? fail(`The text can be at most ${max} characters.`) : v) : fail('The text must be text.'))
const oneOf = (v, list, what, fallback) => (v == null || v === '' ? fallback : list.includes(v) ? v : fail(`${what} must be one of ${list.join(', ')}.`))
const color = (v, fallback) => (v == null || v === '' ? fallback : /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fail('A color must look like #rrggbb.'))
const date = (v, what) => (v == null || v === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : fail(`${what} must be a date (YYYY-MM-DD).`))
const num = (v, what, { min = -Infinity, max = Infinity, int = false } = {}) => {
  if (v == null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) fail(`${what} must be a number from ${min} to ${max}.`)
  return n
}
const bool = (v, fallback = false) => (v == null ? fallback : !!v)
const ids = (v, what) => {
  if (v == null) return []
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) fail(`${what} must be a list of ids.`)
  return [...new Set(v)]
}
const teamKey = (v) => {
  const k = str(v, 7, 'The team key', { required: true }).toUpperCase()
  if (!/^[A-Z][A-Z0-9]{0,6}$/.test(k)) fail('A team key is 1 to 7 letters or digits and starts with a letter, like ENG.')
  return k
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'member'

// ---------------------------------------------------------------- the tracker

/**
 * The tracker over an entity store from `openDatabase()` (electron/localdb).
 * `now` is injectable for tests.
 */
function createTracker(db, { now = () => Date.now() } = {}) {
  const tracked = (e) => e && !e.deleted && e.extension?.tracker
  const live = (type) => db.all(type).filter((e) => !e.deleted)
  const teams = () => db.all('team').filter(tracked)
  const users = () => db.all('user').filter(tracked)
  const byId = (id, type) => {
    if (typeof id !== 'string' || !id) return undefined
    const e = db.byId(id)
    if (!e) return undefined
    if (type === 'team' || type === 'user') return tracked(e) ? e : undefined
    return e.entityType === type && !e.deleted ? e : undefined
  }
  const need = (id, type, what) => byId(id, type) ?? fail(`That ${what} no longer exists.`)
  const opt = (id, type, what) => (id == null || id === '' ? null : need(id, type, what).id)

  /** Write an entity; refuses a full name another entity of the type already has. */
  function put(type, entity) {
    const fqn = entity.fullyQualifiedName
    const other = db.get(type, fqn)
    if (other && other.id !== entity.id) fail(nameTaken(type))
    const stored = { ...entity }
    if (OWN_TYPES.includes(type)) stored.entityType = type
    try {
      return db.put(type, stored, { by: 'tracker', now: now() })
    } catch (e) {
      if (/UNIQUE/i.test(String(e?.message))) fail(nameTaken(type))
      throw e
    }
  }
  const nameTaken = (type) =>
    ({ team: 'Another team already uses that key.', workflowState: 'This team already has a status with that name.', issueLabel: 'There is already a label with that name here.', project: 'There is already a project with that name.', projectMilestone: 'This project already has a milestone with that name.', initiative: 'There is already an initiative with that name.', customView: 'There is already a view with that name.' })[type] ?? 'That name is taken.'

  const ext = (e) => e.extension?.tracker ?? {}
  const withExt = (e, patch) => ({ ...e, extension: { ...e.extension, tracker: { ...ext(e), ...patch } } })

  // ------------------------------------------------------------ shapes sent to the page

  const teamOut = (t) => ({ id: t.id, key: t.name, name: t.displayName || t.name, description: t.description ?? '', ...ext(t) })
  const userOut = (u) => ({ id: u.id, name: u.displayName || u.name, email: u.email ?? '', ...ext(u) })
  const strip = (e) => {
    const { fullyQualifiedName: _f, href: _h, changeDescription: _c, ...rest } = e
    return rest
  }

  /** Everything the page shows, in one read (a local tracker is small). Issues include their text. */
  function snapshot() {
    const comments = live('comment')
    const commentCounts = {}
    for (const c of comments) commentCounts[c.issueId] = (commentCounts[c.issueId] ?? 0) + 1
    return {
      teams: teams().map(teamOut),
      users: users().map(userOut),
      states: live('workflowState').map(strip),
      labels: live('issueLabel').map(strip),
      issues: live('issue').map(strip),
      projects: live('project').map(strip),
      milestones: live('projectMilestone').map(strip),
      projectUpdates: live('projectUpdate').map(strip).sort((a, b) => b.createdAt - a.createdAt),
      cycles: live('cycle').map(strip),
      initiatives: live('initiative').map(strip),
      views: live('customView').map(strip),
      commentCounts,
      meId: users().find((u) => ext(u).me)?.id ?? null,
    }
  }

  // ------------------------------------------------------------ people

  function ensureMe() {
    const me = users().find((u) => ext(u).me)
    if (me) return me
    return put('user', { name: uniqueUserName('me'), fullyQualifiedName: uniqueUserName('me'), displayName: 'Me', extension: { tracker: { me: true, color: COLORS[0] } } })
  }
  function uniqueUserName(base) {
    let name = slug(base)
    for (let i = 2; db.get('user', name); i++) name = `${slug(base)}-${i}`
    return name
  }
  function saveUser(input) {
    const name = str(input.name, 80, 'A name', { required: true })
    const email = str(input.email, 200, 'The email')
    if (input.id) {
      const u = need(input.id, 'user', 'member')
      return userOut(put('user', withExt({ ...u, displayName: name, email: email || undefined }, { color: color(input.color, ext(u).color) })))
    }
    const handle = uniqueUserName(name)
    const n = users().length
    return userOut(put('user', { name: handle, fullyQualifiedName: handle, displayName: name, email: email || undefined, extension: { tracker: { me: false, color: color(input.color, COLORS[n % COLORS.length]) } } }))
  }
  function removeUser(id) {
    const u = need(id, 'user', 'member')
    if (ext(u).me) fail('You cannot remove yourself.')
    db.transaction(() => {
      for (const i of live('issue')) if (i.assigneeId === id) put('issue', { ...i, assigneeId: null })
      for (const p of live('project')) if (p.leadId === id || p.memberIds?.includes(id)) put('project', { ...p, leadId: p.leadId === id ? null : p.leadId, memberIds: (p.memberIds ?? []).filter((m) => m !== id) })
      for (const i of live('initiative')) if (i.ownerId === id) put('initiative', { ...i, ownerId: null })
      db.remove(id)
    })
  }

  // ------------------------------------------------------------ teams and workflow

  const teamSettings = (input, prev = {}) => ({
    color: color(input.color, prev.color ?? COLORS[0]),
    icon: str(input.icon ?? prev.icon, 8, 'The icon'),
    triageEnabled: bool(input.triageEnabled, prev.triageEnabled ?? false),
    cyclesEnabled: bool(input.cyclesEnabled, prev.cyclesEnabled ?? false),
    cycleDuration: num(input.cycleDuration ?? prev.cycleDuration ?? 2, 'The cycle length (weeks)', { min: 1, max: 8, int: true }),
    cycleCooldown: num(input.cycleCooldown ?? prev.cycleCooldown ?? 0, 'The cooldown (weeks)', { min: 0, max: 4, int: true }),
    cycleStartDate: date(input.cycleStartDate ?? prev.cycleStartDate, 'The first cycle start'),
    upcomingCycleCount: num(input.upcomingCycleCount ?? prev.upcomingCycleCount ?? 2, 'Upcoming cycles', { min: 1, max: 6, int: true }),
    cycleAutoRollover: bool(input.cycleAutoRollover, prev.cycleAutoRollover ?? true),
    estimateType: oneOf(input.estimateType, ESTIMATE_TYPES, 'The estimate scale', prev.estimateType ?? 'notUsed'),
    allowZeroEstimates: bool(input.allowZeroEstimates, prev.allowZeroEstimates ?? false),
    defaultStateId: prev.defaultStateId ?? null,
    issueCount: prev.issueCount ?? 0,
  })

  function createTeam(input) {
    const key = teamKey(input.key)
    const name = str(input.name, 80, 'The team name', { required: true })
    return db.transaction(() => {
      ensureMe()
      const team = put('team', { name: key, fullyQualifiedName: key, displayName: name, description: str(input.description, 2000, 'The description'), teamType: 'Group', extension: { tracker: teamSettings(input) } })
      let defaultId = null
      DEFAULT_STATES.forEach((s, position) => {
        const st = put('workflowState', { name: s.name, fullyQualifiedName: `${team.id}.${s.name}`, teamId: team.id, type: s.type, color: s.color, position, description: '' })
        if (s.default) defaultId = st.id
      })
      return teamOut(put('team', withExt(team, { defaultStateId: defaultId })))
    })
  }

  function updateTeam(input) {
    const t = need(input.id, 'team', 'team')
    const key = input.key == null ? t.name : teamKey(input.key)
    const settings = teamSettings(input, ext(t))
    if (input.defaultStateId) {
      const s = need(input.defaultStateId, 'workflowState', 'status')
      if (s.teamId !== t.id || !['backlog', 'unstarted'].includes(s.type)) fail('The default status must be a Backlog or Unstarted status of this team.')
      settings.defaultStateId = s.id
    }
    const next = { ...t, name: key, fullyQualifiedName: key, displayName: input.name == null ? t.displayName : str(input.name, 80, 'The team name', { required: true }), description: input.description == null ? t.description : str(input.description, 2000, 'The description') }
    return teamOut(put('team', withExt(next, settings)))
  }

  function removeTeam(id) {
    const t = need(id, 'team', 'team')
    if (db.all('issue').some((i) => i.teamId === id)) fail('Move or delete this team’s issues first (deleted issues count too, since they can be restored).')
    db.transaction(() => {
      for (const type of ['workflowState', 'issueLabel', 'cycle', 'customView']) for (const e of live(type)) if (e.teamId === id) removeOwn(type, e.id)
      for (const p of live('project')) if (p.teamIds?.includes(id)) put('project', { ...p, teamIds: p.teamIds.filter((x) => x !== id) })
      db.remove(t.id)
    })
  }

  function saveState(input) {
    const name = str(input.name, 60, 'The status name', { required: true })
    const prev = input.id ? need(input.id, 'workflowState', 'status') : null
    const teamId = prev?.teamId ?? need(input.teamId, 'team', 'team').id
    const type = prev ? prev.type : oneOf(input.type, STATE_TYPES, 'The status type', 'unstarted')
    const siblings = live('workflowState').filter((s) => s.teamId === teamId)
    if (!prev && type === 'triage' && siblings.some((s) => s.type === 'triage')) fail('A team has one Triage status.')
    const position = num(input.position, 'The position') ?? prev?.position ?? siblings.length
    return strip(put('workflowState', { ...(prev ?? {}), name, fullyQualifiedName: `${teamId}.${name}`, teamId, type, color: color(input.color, prev?.color ?? '#95a2b3'), position, description: str(input.description, 500, 'The description') }))
  }

  function removeState(id, moveTo) {
    const s = need(id, 'workflowState', 'status')
    const team = need(s.teamId, 'team', 'team')
    if (ext(team).defaultStateId === id) fail('This is the team’s default status. Pick another default first.')
    const rest = live('workflowState').filter((x) => x.teamId === s.teamId && x.id !== id).map((x) => x.type)
    const kinds = { started: ['started'], completed: ['completed'], canceled: ['canceled'], backlog: ['backlog', 'unstarted'], unstarted: ['backlog', 'unstarted'] }[s.type]
    if (kinds && !rest.some((k) => kinds.includes(k))) fail(`A team needs at least one ${kinds.map((k) => k[0].toUpperCase() + k.slice(1)).join(' or ')} status.`)
    const used = db.all('issue').filter((i) => i.stateId === id)
    let target = null
    if (used.length) {
      if (!moveTo) fail('Pick another status of the same team for its issues.')
      target = need(moveTo, 'workflowState', 'status')
      if (target.teamId !== s.teamId || target.id === id) fail('Pick another status of the same team for its issues.')
    }
    db.transaction(() => {
      for (const i of used) put('issue', stateStamps({ ...i, stateId: target.id }, target, i))
      db.remove(id)
    })
  }

  // ------------------------------------------------------------ labels

  function saveLabel(input) {
    const prev = input.id ? need(input.id, 'issueLabel', 'label') : null
    const name = str(input.name, 60, 'The label name', { required: true })
    const teamId = prev ? prev.teamId : opt(input.teamId, 'team', 'team')
    const isGroup = prev ? prev.isGroup : bool(input.isGroup)
    let parentId = input.parentId === undefined ? (prev?.parentId ?? null) : opt(input.parentId, 'issueLabel', 'label group')
    if (parentId) {
      const g = byId(parentId, 'issueLabel')
      if (!g.isGroup) fail('Labels can only go into a label group.')
      if (isGroup) fail('A label group cannot go inside another group.')
      if (g.teamId && g.teamId !== teamId) fail('The group belongs to another team.')
    } else parentId = null
    return strip(put('issueLabel', { ...(prev ?? {}), name, fullyQualifiedName: `${teamId ?? 'workspace'}.${parentId ?? 'top'}.${name}`, teamId, parentId, isGroup, color: color(input.color, prev?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]), description: str(input.description, 500, 'The description') }))
  }

  // ------------------------------------------------------------ issues

  /** startedAt / completedAt / canceledAt follow the status type, as in Linear. */
  function stateStamps(issue, state, prev) {
    const t = now()
    const out = { ...issue }
    const was = prev ? byId(prev.stateId, 'workflowState')?.type : undefined
    if (state.type === 'started' && !out.startedAt) out.startedAt = t
    if (state.type === 'completed') out.completedAt = was === 'completed' ? (prev.completedAt ?? t) : t
    else out.completedAt = null
    if (state.type === 'canceled') out.canceledAt = was === 'canceled' ? (prev.canceledAt ?? t) : t
    else out.canceledAt = null
    if (was === 'triage' && state.type !== 'triage') out.triagedAt = t
    return out
  }

  function checkIssueFields(issue, prev) {
    const team = need(issue.teamId, 'team', 'team')
    const state = need(issue.stateId, 'workflowState', 'status')
    if (state.teamId !== team.id) fail('That status belongs to another team.')
    if (state.type === 'triage' && !ext(team).triageEnabled && prev?.stateId !== state.id) fail('Triage is off for this team.')
    issue.priority = num(issue.priority, 'The priority', { min: 0, max: 4, int: true }) ?? 0
    issue.estimate = num(issue.estimate, 'The estimate', { min: 0, max: 1000 })
    if (issue.estimate != null && ext(team).estimateType === 'notUsed') issue.estimate = null
    issue.assigneeId = opt(issue.assigneeId, 'user', 'member')
    issue.labelIds = ids(issue.labelIds, 'Labels').filter((l) => {
      const label = need(l, 'issueLabel', 'label')
      if (label.isGroup) fail('Pick a label, not a label group.')
      return !label.teamId || label.teamId === team.id
    })
    // One label per group, as in Linear.
    const groups = new Set()
    for (const l of issue.labelIds) {
      const p = byId(l, 'issueLabel').parentId
      if (p && groups.has(p)) fail('Only one label from each group can be on an issue.')
      if (p) groups.add(p)
    }
    issue.projectId = opt(issue.projectId, 'project', 'project')
    issue.projectMilestoneId = issue.projectId ? opt(issue.projectMilestoneId, 'projectMilestone', 'milestone') : null
    if (issue.projectMilestoneId && byId(issue.projectMilestoneId, 'projectMilestone').projectId !== issue.projectId) fail('That milestone belongs to another project.')
    issue.cycleId = opt(issue.cycleId, 'cycle', 'cycle')
    if (issue.cycleId && byId(issue.cycleId, 'cycle').teamId !== team.id) fail('That cycle belongs to another team.')
    issue.dueDate = date(issue.dueDate, 'The due date')
    issue.parentId = opt(issue.parentId, 'issue', 'parent issue')
    if (issue.parentId) {
      for (let p = byId(issue.parentId, 'issue'), n = 0; p; p = p.parentId ? byId(p.parentId, 'issue') : undefined, n++) {
        if (p.id === issue.id || n > 50) fail('An issue cannot be its own parent or sub-issue.')
      }
    }
    issue.relations = (Array.isArray(issue.relations) ? issue.relations : []).map((r) => ({ type: oneOf(r?.type, RELATION_TYPES, 'A relation', 'related'), issueId: need(r?.issueId, 'issue', 'related issue').id }))
    if (issue.relations.some((r) => r.issueId === issue.id)) fail('An issue cannot relate to itself.')
    issue.relations = issue.relations.filter((r, i, all) => all.findIndex((x) => x.issueId === r.issueId) === i)
    issue.sortOrder = num(issue.sortOrder, 'The sort order') ?? prev?.sortOrder ?? -now()
    return { team, state }
  }

  function createIssue(input) {
    return db.transaction(() => {
      const team = need(input.teamId, 'team', 'team')
      const me = ensureMe()
      const stateId = input.stateId ?? (ext(team).triageEnabled && input.triage ? live('workflowState').find((s) => s.teamId === team.id && s.type === 'triage')?.id : null) ?? ext(team).defaultStateId
      const issue = {
        id: randomUUID(),
        title: str(input.title, 500, 'A title', { required: true }),
        description: text(input.description),
        teamId: team.id,
        stateId,
        priority: input.priority,
        estimate: input.estimate,
        assigneeId: input.assigneeId,
        creatorId: me.id,
        labelIds: input.labelIds,
        projectId: input.projectId,
        projectMilestoneId: input.projectMilestoneId,
        cycleId: input.cycleId,
        parentId: input.parentId,
        dueDate: input.dueDate,
        relations: input.relations,
        sortOrder: input.sortOrder,
        createdAt: now(),
      }
      const { state } = checkIssueFields(issue)
      const number = (ext(team).issueCount ?? 0) + 1
      put('team', withExt(team, { issueCount: number }))
      return strip(put('issue', stateStamps({ ...issue, number, name: String(number), fullyQualifiedName: `${team.id}.${number}` }, state)))
    })
  }

  const ISSUE_PATCH = ['title', 'description', 'teamId', 'stateId', 'priority', 'estimate', 'assigneeId', 'labelIds', 'projectId', 'projectMilestoneId', 'cycleId', 'parentId', 'dueDate', 'relations', 'sortOrder']

  /** Apply one patch to several issues (one transaction). Label changes may be `addLabelIds` / `removeLabelIds`. */
  function updateIssues({ ids: list, patch = {}, addLabelIds, removeLabelIds }) {
    const targets = ids(list, 'Issues')
    if (!targets.length) return []
    return db.transaction(() =>
      targets.map((id) => {
        const prev = need(id, 'issue', 'issue')
        const next = { ...prev }
        for (const k of ISSUE_PATCH) if (Object.hasOwn(patch, k)) next[k] = patch[k]
        if (Object.hasOwn(patch, 'title')) next.title = str(patch.title, 500, 'A title', { required: true })
        if (Object.hasOwn(patch, 'description')) next.description = text(patch.description)
        if (addLabelIds || removeLabelIds) {
          const add = ids(addLabelIds, 'Labels')
          const addGroups = new Set(add.map((l) => byId(l, 'issueLabel')?.parentId).filter(Boolean))
          next.labelIds = [...(next.labelIds ?? []).filter((l) => !ids(removeLabelIds, 'Labels').includes(l) && !addGroups.has(byId(l, 'issueLabel')?.parentId)), ...add]
        }
        if (Object.hasOwn(patch, 'projectId') && patch.projectId !== prev.projectId && !Object.hasOwn(patch, 'projectMilestoneId')) next.projectMilestoneId = null
        // Moving to another team: a new number, the same kind of status there, team-only fields cleared.
        if (next.teamId !== prev.teamId) {
          const team = need(next.teamId, 'team', 'team')
          const oldType = byId(prev.stateId, 'workflowState')?.type
          if (!Object.hasOwn(patch, 'stateId')) {
            const same = live('workflowState').filter((s) => s.teamId === team.id && s.type === oldType).sort((a, b) => a.position - b.position)[0]
            next.stateId = same?.id ?? ext(team).defaultStateId
          }
          if (!Object.hasOwn(patch, 'cycleId')) next.cycleId = null
          next.labelIds = (next.labelIds ?? []).filter((l) => !byId(l, 'issueLabel')?.teamId)
          const number = (ext(team).issueCount ?? 0) + 1
          put('team', withExt(team, { issueCount: number }))
          next.number = number
          next.name = String(number)
          next.fullyQualifiedName = `${team.id}.${number}`
          next.previousIdentifiers = [...(prev.previousIdentifiers ?? []), identifierOf(prev)]
        }
        const { state } = checkIssueFields(next, prev)
        return strip(put('issue', next.stateId !== prev.stateId ? stateStamps(next, state, prev) : next))
      }),
    )
  }

  const identifierOf = (issue) => `${byId(issue.teamId, 'team')?.name ?? '?'}-${issue.number}`

  function deleteIssues(list, restore = false) {
    const targets = ids(list, 'Issues')
    db.transaction(() => {
      for (const id of targets) {
        const e = db.byId(id)
        if (!e || e.entityType !== 'issue') continue
        if (restore && e.deleted) {
          if (!byId(e.teamId, 'team')) fail('Its team no longer exists.')
          put('issue', { ...e, deleted: false, archivedAt: null })
        } else if (!restore && !e.deleted) put('issue', { ...e, deleted: true, archivedAt: now() })
      }
    })
  }

  /** Comments (oldest first) and the issue's history worked out from its stored versions. */
  function issueDetail(id) {
    const issue = need(id, 'issue', 'issue')
    const comments = live('comment').filter((c) => c.issueId === id).sort((a, b) => a.createdAt - b.createdAt).map(strip)
    return { comments, history: history(issue) }
  }

  const HISTORY_FIELDS = ['title', 'description', 'teamId', 'stateId', 'priority', 'estimate', 'assigneeId', 'labelIds', 'projectId', 'projectMilestoneId', 'cycleId', 'parentId', 'dueDate', 'relations', 'deleted']
  function history(issue) {
    const versions = db.versions(issue.id).reverse()
    const out = []
    for (let i = 1; i < versions.length; i++) {
      const a = versions[i - 1]
      const b = versions[i]
      for (const f of HISTORY_FIELDS) {
        const from = a[f] ?? null
        const to = b[f] ?? null
        if (JSON.stringify(from) === JSON.stringify(to)) continue
        out.push({ at: b.updatedAt, field: f, from: f === 'description' ? undefined : from, to: f === 'description' ? undefined : to })
      }
    }
    return out.reverse().slice(0, 200)
  }

  // ------------------------------------------------------------ comments

  function saveComment(input) {
    const body = text(input.body, 50_000)
    if (!body.trim()) fail('Write something first.')
    if (input.id) {
      const c = need(input.id, 'comment', 'comment')
      return strip(put('comment', { ...c, body, editedAt: now() }))
    }
    const issue = need(input.issueId, 'issue', 'issue')
    const parentId = opt(input.parentId, 'comment', 'comment')
    const id = randomUUID()
    return strip(put('comment', { id, name: id, fullyQualifiedName: `${issue.id}.${id}`, issueId: issue.id, parentId, body, userId: ensureMe().id, createdAt: now(), editedAt: null }))
  }

  // ------------------------------------------------------------ projects

  function saveProject(input) {
    const prev = input.id ? need(input.id, 'project', 'project') : null
    const name = str(input.name, 80, 'The project name', { required: true })
    const status = oneOf(input.status, PROJECT_STATUSES, 'The status', prev?.status ?? 'planned')
    const t = now()
    const p = {
      ...(prev ?? { id: randomUUID(), createdAt: t, sortOrder: -t }),
      name,
      fullyQualifiedName: name,
      summary: str(input.summary ?? prev?.summary, 255, 'The summary'),
      description: text(input.description ?? prev?.description),
      icon: str(input.icon ?? prev?.icon, 8, 'The icon'),
      color: color(input.color, prev?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]),
      status,
      priority: num(input.priority ?? prev?.priority ?? 0, 'The priority', { min: 0, max: 4, int: true }),
      leadId: input.leadId === undefined ? (prev?.leadId ?? null) : opt(input.leadId, 'user', 'member'),
      memberIds: input.memberIds === undefined ? (prev?.memberIds ?? []) : ids(input.memberIds, 'Members').map((m) => need(m, 'user', 'member').id),
      teamIds: input.teamIds === undefined ? (prev?.teamIds ?? []) : ids(input.teamIds, 'Teams').map((x) => need(x, 'team', 'team').id),
      startDate: input.startDate === undefined ? (prev?.startDate ?? null) : date(input.startDate, 'The start date'),
      targetDate: input.targetDate === undefined ? (prev?.targetDate ?? null) : date(input.targetDate, 'The target date'),
    }
    if (p.startDate && p.targetDate && p.startDate > p.targetDate) fail('The target date is before the start date.')
    if (status === 'started' && !p.startedAt) p.startedAt = t
    p.completedAt = status === 'completed' ? (prev?.completedAt ?? t) : null
    p.canceledAt = status === 'canceled' ? (prev?.canceledAt ?? t) : null
    return strip(put('project', p))
  }

  function saveMilestone(input) {
    const prev = input.id ? need(input.id, 'projectMilestone', 'milestone') : null
    const projectId = prev?.projectId ?? need(input.projectId, 'project', 'project').id
    const name = str(input.name, 80, 'The milestone name', { required: true })
    const siblings = live('projectMilestone').filter((m) => m.projectId === projectId)
    return strip(put('projectMilestone', { ...(prev ?? { id: randomUUID() }), name, fullyQualifiedName: `${projectId}.${name}`, projectId, description: str(input.description ?? prev?.description, 2000, 'The description'), targetDate: input.targetDate === undefined ? (prev?.targetDate ?? null) : date(input.targetDate, 'The target date'), sortOrder: num(input.sortOrder, 'The order') ?? prev?.sortOrder ?? siblings.length }))
  }

  function addProjectUpdate(input) {
    const project = need(input.projectId, 'project', 'project')
    const body = text(input.body, 50_000)
    if (!body.trim()) fail('Write the update first.')
    const id = randomUUID()
    return strip(put('projectUpdate', { id, name: id, fullyQualifiedName: `${project.id}.${id}`, projectId: project.id, health: oneOf(input.health, HEALTH, 'The health', 'onTrack'), body, userId: ensureMe().id, createdAt: now() }))
  }

  // ------------------------------------------------------------ cycles

  const DAY = 86_400_000
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10)
  const isoDay = (s) => Date.parse(`${s}T00:00:00Z`)

  function saveCycle(input) {
    const prev = input.id ? need(input.id, 'cycle', 'cycle') : null
    const teamId = prev?.teamId ?? need(input.teamId, 'team', 'team').id
    const startsAt = date(input.startsAt ?? prev?.startsAt, 'The start date') ?? fail('A cycle needs a start date.')
    const endsAt = date(input.endsAt ?? prev?.endsAt, 'The end date') ?? fail('A cycle needs an end date.')
    if (endsAt <= startsAt) fail('A cycle ends after it starts.')
    const others = live('cycle').filter((c) => c.teamId === teamId && c.id !== prev?.id)
    if (others.some((c) => startsAt < c.endsAt && c.startsAt < endsAt)) fail('Cycles of a team cannot overlap.')
    const number = prev?.number ?? Math.max(0, ...others.map((c) => c.number)) + 1
    return strip(put('cycle', { ...(prev ?? { id: randomUUID() }), name: String(number), fullyQualifiedName: `${teamId}.${number}`, teamId, number, title: str(input.title ?? prev?.title, 80, 'The cycle name'), description: str(input.description ?? prev?.description, 2000, 'The description'), startsAt, endsAt }))
  }

  /**
   * Linear-style automatic cycles: from the team's first start date (or this
   * week's Monday), back-to-back cycles of `cycleDuration` weeks with
   * `cycleCooldown` weeks between them, until `upcomingCycleCount` cycles lie
   * ahead of today. Unfinished issues of ended cycles move on when
   * `cycleAutoRollover` is on. Runs when the page opens a team; idempotent.
   */
  function scheduleCycles(teamId) {
    const team = need(teamId, 'team', 'team')
    const s = ext(team)
    if (!s.cyclesEnabled) return { created: 0, rolledOver: 0 }
    return db.transaction(() => {
      const today = iso(now())
      const mine = () => live('cycle').filter((c) => c.teamId === teamId).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      let created = 0
      const len = s.cycleDuration * 7 * DAY
      const gap = s.cycleCooldown * 7 * DAY
      let cursor
      const last = mine().at(-1)
      if (last) cursor = isoDay(last.endsAt) + gap
      else {
        const base = s.cycleStartDate ? isoDay(s.cycleStartDate) : isoDay(today) - ((new Date(isoDay(today)).getUTCDay() + 6) % 7) * DAY
        cursor = base
      }
      while (mine().filter((c) => c.endsAt > today && c.startsAt > today).length < s.upcomingCycleCount || !mine().some((c) => c.endsAt > today)) {
        // Skip ahead when the schedule fell far behind (the app was closed for weeks).
        while (cursor + len <= isoDay(today)) cursor += len + gap
        saveCycle({ teamId, startsAt: iso(cursor), endsAt: iso(cursor + len) })
        cursor += len + gap
        if (++created > 20) break
      }
      let rolledOver = 0
      if (s.cycleAutoRollover) {
        const current = mine().find((c) => c.startsAt <= today && today < c.endsAt) ?? mine().find((c) => c.startsAt > today)
        const states = new Map(live('workflowState').map((x) => [x.id, x.type]))
        for (const c of mine().filter((x) => x.endsAt <= today && !x.completedAt)) {
          for (const i of live('issue').filter((x) => x.cycleId === c.id && !['completed', 'canceled'].includes(states.get(x.stateId)))) {
            if (!current) break
            put('issue', { ...i, cycleId: current.id })
            rolledOver++
          }
          put('cycle', { ...c, completedAt: now() })
        }
      }
      return { created, rolledOver }
    })
  }

  // ------------------------------------------------------------ initiatives and views

  function saveInitiative(input) {
    const prev = input.id ? need(input.id, 'initiative', 'initiative') : null
    const name = str(input.name, 80, 'The initiative name', { required: true })
    const parentId = input.parentId === undefined ? (prev?.parentId ?? null) : opt(input.parentId, 'initiative', 'parent initiative')
    for (let p = parentId ? byId(parentId, 'initiative') : undefined, n = 0; p; p = p.parentId ? byId(p.parentId, 'initiative') : undefined, n++) if (p.id === prev?.id || n > 20) fail('An initiative cannot be inside itself.')
    const t = now()
    return strip(put('initiative', { ...(prev ?? { id: randomUUID(), createdAt: t, sortOrder: -t }), name, fullyQualifiedName: name, summary: str(input.summary ?? prev?.summary, 255, 'The summary'), description: text(input.description ?? prev?.description), icon: str(input.icon ?? prev?.icon, 8, 'The icon'), color: color(input.color, prev?.color ?? COLORS[4]), status: oneOf(input.status, INITIATIVE_STATUSES, 'The status', prev?.status ?? 'planned'), ownerId: input.ownerId === undefined ? (prev?.ownerId ?? null) : opt(input.ownerId, 'user', 'member'), targetDate: input.targetDate === undefined ? (prev?.targetDate ?? null) : date(input.targetDate, 'The target date'), projectIds: input.projectIds === undefined ? (prev?.projectIds ?? []) : ids(input.projectIds, 'Projects').map((x) => need(x, 'project', 'project').id), parentId }))
  }

  const VIEW_FILTER_KEYS = ['stateTypes', 'stateIds', 'priorities', 'assigneeIds', 'labelIds', 'projectIds', 'cycleIds', 'teamIds', 'creatorIds', 'milestoneIds', 'due', 'query']
  function cleanFilters(f) {
    const out = {}
    if (f == null) return out
    if (typeof f !== 'object' || Array.isArray(f)) fail('Filters must be an object.')
    for (const k of VIEW_FILTER_KEYS) {
      if (f[k] == null) continue
      if (k === 'query') out.query = str(f.query, 200, 'The search')
      else if (k === 'due') out.due = oneOf(f.due, ['overdue', 'week', 'none', 'any'], 'Due', undefined)
      else if (!Array.isArray(f[k]) || f[k].some((x) => typeof x !== 'string' && typeof x !== 'number' && x !== null)) fail(`Filter ${k} must be a list.`)
      else out[k] = f[k].slice(0, 200)
    }
    return out
  }
  function saveView(input) {
    const prev = input.id ? need(input.id, 'customView', 'view') : null
    const name = str(input.name, 80, 'The view name', { required: true })
    const teamId = input.teamId === undefined ? (prev?.teamId ?? null) : opt(input.teamId, 'team', 'team')
    const d = input.display ?? prev?.display ?? {}
    const display = {
      layout: oneOf(d.layout, ['list', 'board'], 'The layout', 'list'),
      groupBy: oneOf(d.groupBy, ['status', 'assignee', 'priority', 'project', 'cycle', 'label', 'team', 'none'], 'Grouping', 'status'),
      orderBy: oneOf(d.orderBy, ['manual', 'priority', 'updated', 'created', 'dueDate', 'title'], 'Ordering', 'manual'),
      showSubIssues: bool(d.showSubIssues, true),
      showCompleted: oneOf(d.showCompleted, ['all', 'week', 'month', 'none'], 'Completed issues', 'all'),
      showEmptyGroups: bool(d.showEmptyGroups, false),
    }
    return strip(put('customView', { ...(prev ?? { id: randomUUID(), createdAt: now() }), name, fullyQualifiedName: `${teamId ?? 'workspace'}.${name}`, teamId, description: str(input.description ?? prev?.description, 500, 'The description'), icon: str(input.icon ?? prev?.icon, 8, 'The icon'), color: color(input.color, prev?.color ?? COLORS[0]), filters: input.filters === undefined ? (prev?.filters ?? {}) : cleanFilters(input.filters), display }))
  }

  // ------------------------------------------------------------ removal (everything but issues)

  function removeOwn(type, id) {
    const e = need(id, type, type)
    db.transaction(() => {
      const clear = (field, match = (v) => v === id) => {
        for (const i of live('issue')) if (match(i[field])) put('issue', { ...i, [field]: Array.isArray(i[field]) ? i[field].filter((x) => x !== id) : null, ...(field === 'projectId' ? { projectMilestoneId: null } : {}) })
      }
      if (type === 'issueLabel') {
        clear('labelIds', (v) => v?.includes(id))
        for (const l of live('issueLabel')) if (l.parentId === id) put('issueLabel', { ...l, parentId: null, fullyQualifiedName: `${l.teamId ?? 'workspace'}.top.${l.name}` })
      }
      if (type === 'project') {
        clear('projectId')
        for (const m of live('projectMilestone')) if (m.projectId === id) db.remove(m.id)
        for (const u of live('projectUpdate')) if (u.projectId === id) db.remove(u.id)
        for (const i of live('initiative')) if (i.projectIds?.includes(id)) put('initiative', { ...i, projectIds: i.projectIds.filter((x) => x !== id) })
      }
      if (type === 'projectMilestone') clear('projectMilestoneId')
      if (type === 'cycle') clear('cycleId')
      if (type === 'initiative') for (const i of live('initiative')) if (i.parentId === id) put('initiative', { ...i, parentId: null })
      if (type === 'comment') for (const c of live('comment')) if (c.parentId === id) db.remove(c.id)
      if (type === 'workflowState' || type === 'issue') fail('Use the dedicated removal.')
      db.remove(e.id)
    })
  }

  // ------------------------------------------------------------ fictional example data

  /** A fictional team with a few projects and issues, to try things out. Only on an empty tracker. */
  function addExample() {
    if (teams().length) fail('The example is only added to an empty tracker.')
    return db.transaction(() => {
      const team = createTeam({ name: 'Product', key: 'PRD', cyclesEnabled: true, triageEnabled: true, estimateType: 'fibonacci', color: '#5e6ad2' })
      const me = ensureMe()
      const ada = saveUser({ name: 'Ada Example', color: '#4cb782' })
      const lin = saveUser({ name: 'Lin Sample', color: '#f2994a' })
      scheduleCycles(team.id)
      const states = live('workflowState').filter((s) => s.teamId === team.id)
      const st = (n) => states.find((s) => s.name === n).id
      const group = saveLabel({ name: 'Type', isGroup: true, color: '#95a2b3' })
      const bug = saveLabel({ name: 'Bug', parentId: group.id, color: '#eb5757' })
      const feature = saveLabel({ name: 'Feature', parentId: group.id, color: '#bb87fc' })
      const polish = saveLabel({ name: 'Polish', color: '#26b5ce' })
      const today = iso(now())
      const inDays = (n) => iso(now() + n * DAY)
      const onboarding = saveProject({ name: 'Onboarding refresh', summary: 'A shorter first run for new people.', status: 'started', priority: 2, leadId: me.id, teamIds: [team.id], startDate: inDays(-10), targetDate: inDays(30), icon: '🚀' })
      const search = saveProject({ name: 'Faster search', summary: 'Results while you type.', status: 'planned', priority: 3, leadId: ada.id, teamIds: [team.id], targetDate: inDays(60), icon: '🔎' })
      const m1 = saveMilestone({ projectId: onboarding.id, name: 'Welcome screen', targetDate: inDays(10) })
      saveMilestone({ projectId: onboarding.id, name: 'Guided tour', targetDate: inDays(25) })
      addProjectUpdate({ projectId: onboarding.id, health: 'onTrack', body: 'The new welcome screen is in review. The guided tour starts next cycle.' })
      saveInitiative({ name: 'Make the first week great', summary: 'Everything a new person meets in their first week.', status: 'active', ownerId: me.id, targetDate: inDays(90), projectIds: [onboarding.id, search.id], icon: '🎯' })
      const cycle = live('cycle').find((c) => c.teamId === team.id && c.startsAt <= today && today < c.endsAt)
      const mk = (title, extra) => createIssue({ teamId: team.id, title, ...extra })
      const welcome = mk('Design the new welcome screen', { stateId: st('In Review'), priority: 2, assigneeId: me.id, projectId: onboarding.id, projectMilestoneId: m1.id, cycleId: cycle?.id, estimate: 3, labelIds: [feature.id], description: 'One screen, three choices, no wall of text.' })
      mk('Write the copy for each welcome choice', { stateId: st('In Progress'), priority: 3, assigneeId: lin.id, projectId: onboarding.id, projectMilestoneId: m1.id, cycleId: cycle?.id, estimate: 2, parentId: welcome.id })
      mk('Sign-in button is cut off on narrow windows', { stateId: st('Todo'), priority: 1, assigneeId: ada.id, cycleId: cycle?.id, estimate: 1, labelIds: [bug.id], dueDate: inDays(2) })
      mk('Search results flicker while typing', { stateId: st('Backlog'), priority: 3, projectId: search.id, estimate: 5, labelIds: [bug.id] })
      mk('Remember the last search', { stateId: st('Backlog'), priority: 4, projectId: search.id, estimate: 2, labelIds: [feature.id] })
      mk('Round the corners of the tour cards', { stateId: st('Done'), priority: 4, assigneeId: me.id, projectId: onboarding.id, cycleId: cycle?.id, estimate: 1, labelIds: [polish.id] })
      mk('Someone asked for a dark welcome screen', { triage: true, priority: 0 })
      saveView({ name: 'Bugs', filters: { labelIds: [bug.id] }, display: { layout: 'list', groupBy: 'priority' }, icon: '🐞' })
      return snapshot()
    })
  }

  // ------------------------------------------------------------ entry points

  const SAVE = { user: saveUser, workflowState: saveState, issueLabel: saveLabel, project: saveProject, projectMilestone: saveMilestone, cycle: saveCycle, initiative: saveInitiative, customView: saveView, comment: saveComment }

  return {
    snapshot,
    createTeam,
    updateTeam,
    createIssue,
    updateIssues,
    deleteIssues: ({ ids: list }) => deleteIssues(list, false),
    restoreIssues: ({ ids: list }) => deleteIssues(list, true),
    issueDetail: ({ id }) => issueDetail(id),
    addProjectUpdate,
    scheduleCycles: ({ teamId }) => scheduleCycles(teamId),
    addExample,
    /** Create or update one entity of a type in SAVE. */
    save({ type, entity }) {
      const fn = SAVE[type] ?? fail('That kind of thing cannot be saved here.')
      return db.transaction(() => fn(entity ?? {}))
    },
    /** Remove one entity for good (issues: `deleteIssues`; statuses need `moveTo` when in use). */
    remove({ type, id, moveTo }) {
      if (type === 'team') return removeTeam(id)
      if (type === 'user') return removeUser(id)
      if (type === 'workflowState') return removeState(id, moveTo)
      if (!OWN_TYPES.includes(type) || type === 'issue') fail('That kind of thing cannot be removed here.')
      return removeOwn(type, id)
    },
  }
}

module.exports = { createTracker, TrackerError, STATE_TYPES, PROJECT_STATUSES, INITIATIVE_STATUSES, HEALTH, ESTIMATE_TYPES, RELATION_TYPES, OWN_TYPES, ALL_TYPES, DEFAULT_STATES }
