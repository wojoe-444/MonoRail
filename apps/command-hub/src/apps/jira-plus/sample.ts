// Fictional sample data for the browser dev server, where there is no Electron
// backend. Nothing here is real: the site, people and tickets are made up.

import type { JiraApi } from './api'
import { sampleRepoLinks } from './sampleRepoLinks'
import type { Comment, IssueDetail, Overview, ParentRef, Project, Source, StatusCategory, Worklog } from './types'

const LOCAL_STATUSES: { name: string; category: StatusCategory }[] = [
  { name: 'To Do', category: 'todo' },
  { name: 'In Progress', category: 'in_progress' },
  { name: 'In Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
]
const JIRA_STATUSES: { name: string; category: StatusCategory }[] = [
  { name: 'Backlog', category: 'todo' },
  { name: 'Selected for Development', category: 'todo' },
  { name: 'In Progress', category: 'in_progress' },
  { name: 'Code Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
]
const TYPES = ['Task', 'Bug', 'Story', 'Spike', 'Epic', 'Sub-task', 'Recurring']
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest']
const SITE = 'https://example-team.atlassian.net'

interface Row {
  issue: IssueDetail
}

function daysAgo(d: number, h = 0): string {
  return new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString()
}

function seed(): { projects: Project[]; rows: Row[]; next: Record<string, number> } {
  const projects: Project[] = [
    { key: 'ME', name: 'Personal', source: 'local', description: 'Everything I work on, one ticket per task.', issueCount: 0, openCount: 0 },
    { key: 'PLAT', name: 'Platform', source: 'jira', url: `${SITE}/browse/PLAT`, issueCount: 0, openCount: 0 },
    { key: 'WEB', name: 'Web App', source: 'jira', url: `${SITE}/browse/WEB`, issueCount: 0, openCount: 0 },
  ]
  const raw: [Source, string, number, string, string, string, string, string[], number, string?][] = [
    ['local', 'ME', 1, 'Write up notes from the planning session', 'Task', 'Medium', 'Done', ['notes'], 6],
    ['local', 'ME', 2, 'Try the new query builder on the reporting job', 'Spike', 'Low', 'In Progress', ['research'], 1],
    ['local', 'ME', 3, 'Review the onboarding doc before Thursday', 'Task', 'High', 'To Do', [], 0],
    ['local', 'ME', 4, 'Clean up the flaky retry test locally', 'Bug', 'Medium', 'In Review', ['tests'], 2],
    ['local', 'ME', 5, 'Prep demo script for the Friday sync', 'Task', 'Medium', 'To Do', ['demo'], 0],
    ['local', 'ME', 6, 'Reporting job refresh', 'Epic', 'High', 'In Progress', ['reporting'], 0],
    ['local', 'ME', 7, 'Weekly summary email from the new reports', 'Story', 'Medium', 'To Do', ['reporting'], 0],
    ['jira', 'PLAT', 100, 'Scheduler hardening', 'Epic', 'High', 'In Progress', [], 5, 'Sam Rivera'],
    ['jira', 'PLAT', 112, 'Rate limiter drops requests during deploys', 'Bug', 'Highest', 'In Progress', ['reliability'], 0, 'Sam Rivera'],
    ['jira', 'PLAT', 118, 'Move job scheduler config to the shared store', 'Story', 'Medium', 'Selected for Development', [], 3, 'Sam Rivera'],
    ['jira', 'PLAT', 97, 'Add tracing to the ingest worker', 'Task', 'Low', 'Done', ['observability'], 9, 'Jordan Lee'],
    ['jira', 'WEB', 431, 'Settings page loses unsaved changes on tab switch', 'Bug', 'High', 'Code Review', ['ux'], 1, 'Alex Kim'],
    ['jira', 'WEB', 440, 'Export to CSV for the activity table', 'Story', 'Medium', 'Backlog', [], 4, 'Jordan Lee'],
  ]
  const rows: Row[] = raw.map(([source, project, n, summary, type, priority, status, labels, age, reporter]) => {
    const statuses = source === 'local' ? LOCAL_STATUSES : JIRA_STATUSES
    const key = `${project}-${n}`
    const created = daysAgo(age + 3)
    const updated = daysAgo(age, n % 7)
    const comments: Comment[] =
      n % 2 === 0
        ? [
            { id: `${key}-c1`, author: source === 'local' ? 'You' : (reporter ?? 'Teammate'), body: 'Looked at this today. Next step is in the description.', created: updated, mine: source === 'local' },
            ...(source === 'jira'
              ? [{ id: `${key}-c2`, author: 'Casey Morgan', body: 'Thanks, I will pick it up after standup.', created: updated, updated, mine: true }]
              : []),
          ]
        : []
    return {
      issue: {
        key,
        source,
        projectKey: project,
        projectName: projects.find((p) => p.key === project)?.name,
        summary,
        dueDate: n % 3 === 0 ? new Date(Date.now() + (n % 7 - 2) * 86400000).toLocaleDateString('en-CA') : undefined,
        description:
          source === 'local'
            ? 'Personal ticket. Lives in the local repo only.\n\n- What done looks like\n- Links and notes'
            : 'Steps to reproduce and context from the team board.',
        type,
        priority,
        status,
        statusCategory: statuses.find((s) => s.name === status)!.category,
        assignee: source === 'local' ? 'You' : 'Casey Morgan',
        reporter: source === 'local' ? 'You' : reporter,
        labels,
        created,
        updated,
        commentCount: comments.length,
        url: source === 'jira' ? `${SITE}/browse/${key}` : undefined,
        comments,
        history:
          source === 'local'
            ? [
                { id: fakeSha(key + 'b'), at: updated, text: `Status To Do → ${status}` },
                { id: fakeSha(key + 'a'), at: created, text: `Created "${summary}"` },
              ]
            : [],
        transitions: [],
        worklogs: [],
        children: [],
        timeTracking: { spentSeconds: 0, totalSeconds: 0 },
      },
    }
  })
  // Parents and time logs, so the tree and the totals have something to show.
  const parents: Record<string, string> = { 'ME-1': 'ME-6', 'ME-2': 'ME-6', 'ME-4': 'ME-6', 'ME-7': 'ME-6', 'PLAT-112': 'PLAT-100', 'PLAT-118': 'PLAT-100' }
  const logs: Record<string, [number, number, string, string?][]> = {
    'ME-6': [[0.5, 4, 'Broke the work into stories']],
    'ME-1': [[1, 6, 'Wrote up the notes']],
    'ME-2': [[1.5, 1, 'Tried the builder on two reports'], [0.75, 0, 'Compared run times']],
    'ME-4': [[2, 2, 'Found the timing issue in the retry loop']],
    'PLAT-112': [[3, 1, 'Reproduced during a staging deploy', 'Casey Morgan'], [1, 0, 'Paired on the fix', 'Sam Rivera']],
    'PLAT-118': [[1.25, 3, '', 'Casey Morgan']],
  }
  for (const { issue } of rows) {
    if (parents[issue.key]) issue.parent = { key: parents[issue.key] }
    issue.worklogs = (logs[issue.key] ?? []).map(([h, d, comment, author], n) => ({
      id: `${issue.key}-w${n}`,
      author: author ?? 'You',
      started: daysAgo(d, 3 + n),
      seconds: Math.round(h * 3600),
      comment,
    }))
  }
  return { projects, rows, next: { ME: 8, PLAT: 119, WEB: 441 } }
}

function fakeSha(s: string): string {
  let h = 2166136261
  let out = ''
  for (let round = 0; round < 5; round++) {
    for (const c of s + round) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
    out += (h >>> 0).toString(16).padStart(8, '0')
  }
  return out
}

const wait = <T,>(v: T, ms = 150) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms))

export function createSampleBackend(): JiraApi {
  const db = seed()
  const templates: import('./types').TriggerTemplate[] = []
  let connected = true
  let scopeJql = 'assignee = currentUser()'

  const statusesFor = (source: Source) => (source === 'local' ? LOCAL_STATUSES : JIRA_STATUSES)
  const find = (key: string) => {
    const row = db.rows.find((r) => r.issue.key === key)
    if (!row) throw new Error(`No ticket ${key}`)
    return row.issue
  }
  const visible = () => db.rows.map((r) => r.issue).filter((i) => connected || i.source === 'local')
  const spent = (i: IssueDetail) => i.worklogs.reduce((n, w) => n + w.seconds, 0)
  const ref = (key: string): ParentRef => {
    const p = db.rows.find((r) => r.issue.key === key)?.issue
    return p ? { key, summary: p.summary, type: p.type, status: p.status, statusCategory: p.statusCategory } : { key, missing: true }
  }
  const below = (key: string): Set<string> => {
    const out = new Set<string>()
    const walk = (k: string) =>
      db.rows.forEach(({ issue }) => {
        if (issue.parent?.key === k && !out.has(issue.key)) {
          out.add(issue.key)
          walk(issue.key)
        }
      })
    walk(key)
    return out
  }
  const summary = (i: IssueDetail) => {
    const { comments: _c, history: _h, transitions: _t, worklogs: _w, children: _ch, timeTracking: _tt, ...rest } = i
    return { ...rest, ...(i.parent ? { parent: ref(i.parent.key) } : {}), timeSpentSeconds: spent(i) }
  }
  const touch = (i: IssueDetail, text: string) => {
    i.updated = new Date().toISOString()
    if (i.source === 'local') i.history.unshift({ id: fakeSha(i.key + i.updated), at: i.updated, text })
  }

  return {
    async listTriggerTemplates({ source, projectKey }) { return wait(templates.filter((t) => t.source === source && t.projectKey === projectKey)) },
    async saveTriggerTemplate(args) {
      const index = templates.findIndex((t) => t.id === args.id && t.source === args.source && t.projectKey === args.projectKey)
      if (args.id && index < 0) throw new Error('That template no longer exists.')
      if (!args.summary.trim()) throw new Error('A template needs a task summary.')
      const now = new Date().toISOString()
      const entry = { ...args, id: args.id ?? crypto.randomUUID(), summary: args.summary.trim(), created: index < 0 ? now : templates[index].created, updated: now }
      if (index < 0) templates.push(entry); else templates[index] = entry
      return wait(entry)
    },
    async deleteTriggerTemplate({ source, projectKey, id }) {
      const index = templates.findIndex((t) => t.id === id && t.source === source && t.projectKey === projectKey)
      if (index < 0) throw new Error('That template no longer exists.')
      templates.splice(index, 1)
      return wait({ ok: true as const })
    },
    async calendarIssues({ start, end }) {
      return wait({ issues: visible().filter((i) => i.dueDate && i.dueDate >= start && i.dueDate < end).map(summary), teamConnected: connected })
    },
    async getOverview() {
      const projects = db.projects
        .filter((p) => connected || p.source === 'local')
        .map((p) => {
          const issues = visible().filter((i) => i.projectKey === p.key)
          return { ...p, issueCount: issues.length, openCount: issues.filter((i) => i.statusCategory !== 'done').length }
        })
      const overview: Overview = {
        connection: connected
          ? { connected: true, via: 'connections', siteUrl: SITE, email: 'casey@example.com', displayName: 'Casey Morgan', scopeJql }
          : { connected: false, scopeJql },
        projects,
        local: { statuses: LOCAL_STATUSES, types: TYPES, priorities: PRIORITIES, repoDir: '%APPDATA%\\MonoRail\\modules\\jira\\local-repo' },
      }
      return wait(overview)
    },
    async listIssues({ source, projectKey }) {
      const list = visible()
        .filter((i) => (source === 'all' || i.source === source) && (!projectKey || i.projectKey === projectKey))
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .map(summary)
      return wait(list)
    },
    async getIssue({ key }) {
      const i = find(key)
      const transitions = statusesFor(i.source)
        .filter((s) => s.name !== i.status)
        .map((s) => ({ id: s.name, name: s.name, toStatus: s.name, toCategory: s.category }))
      const children = db.rows
        .map((r) => r.issue)
        .filter((c) => c.parent?.key === key)
        .sort((a, b) => Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]))
        .map(summary)
      const total = [...below(key)].reduce((n, k) => n + spent(find(k)), spent(i))
      return wait({
        ...i,
        ...(i.parent ? { parent: ref(i.parent.key) } : {}),
        worklogs: [...i.worklogs].sort((a, b) => b.started.localeCompare(a.started)),
        transitions,
        children,
        timeTracking: { spentSeconds: spent(i), totalSeconds: total },
      })
    },
    async getIssueTypes({ source, subtask }) {
      return wait((source === 'local' ? TYPES : ['Task', 'Bug', 'Story', 'Epic', 'Sub-task']).filter((t) => t !== 'Recurring' && (t === 'Sub-task') === !!subtask))
    },
    async createIssue(args) {
      if (!args.summary.trim()) throw new Error('A ticket needs a summary.')
      const n = db.next[args.projectKey] ?? 1
      db.next[args.projectKey] = n + 1
      const key = `${args.projectKey}-${n}`
      const now = new Date().toISOString()
      const status = statusesFor(args.source)[0]
      const issue: IssueDetail = {
        key,
        source: args.source,
        projectKey: args.projectKey,
        projectName: db.projects.find((p) => p.key === args.projectKey)?.name,
        summary: args.summary.trim(),
        description: args.description ?? '',
        dueDate: args.dueDate,
        recurrence: args.recurrence,
        type: args.type ?? 'Task',
        priority: args.priority ?? 'Medium',
        status: status.name,
        statusCategory: status.category,
        assignee: args.source === 'local' ? 'You' : 'Casey Morgan',
        reporter: args.source === 'local' ? 'You' : 'Casey Morgan',
        labels: args.labels ?? [],
        created: now,
        updated: now,
        commentCount: 0,
        url: args.source === 'jira' ? `${SITE}/browse/${key}` : undefined,
        comments: [],
        history: args.source === 'local' ? [{ id: fakeSha(key), at: now, text: `Created "${args.summary.trim()}"` }] : [],
        transitions: [],
        worklogs: [],
        children: [],
        timeTracking: { spentSeconds: 0, totalSeconds: 0 },
        ...(args.parent ? { parent: { key: args.parent } } : {}),
      }
      db.rows.push({ issue })
      return wait(summary(issue))
    },
    async updateIssue({ key, fields }) {
      const i = find(key)
      Object.assign(i, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)))
      touch(i, `Edited ${Object.keys(fields).join(', ')}`)
      return wait(summary(i))
    },
    async transitionIssue({ key, transitionId }) {
      const i = find(key)
      const to = statusesFor(i.source).find((s) => s.name === transitionId)
      if (!to) throw new Error(`Unknown status ${transitionId}`)
      const from = i.status
      i.status = to.name
      i.statusCategory = to.category
      if (i.type === 'Recurring' && to.category === 'done' && !i.nextOccurrence && i.dueDate && i.recurrence) {
        const n = db.next[i.projectKey] ?? 1
        db.next[i.projectKey] = n + 1
        const key = `${i.projectKey}-${n}`
        const d = new Date(i.dueDate + 'T00:00:00Z')
        if (i.recurrence === 'monthly') {
          const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1)
          d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()))
        } else d.setUTCDate(d.getUTCDate() + (i.recurrence === 'weekly' ? 7 : 1))
        i.nextOccurrence = key
        const now = new Date().toISOString()
        db.rows.push({ issue: { ...i, key, dueDate: d.toISOString().slice(0, 10), nextOccurrence: undefined, status: statusesFor(i.source)[0].name, statusCategory: 'todo', created: now, updated: now, comments: [], commentCount: 0, worklogs: [], history: [], children: [], timeTracking: { spentSeconds: 0, totalSeconds: 0 } } })
      }
      touch(i, `Status ${from} → ${to.name}`)
      return wait(summary(i))
    },
    async addComment({ key, body }) {
      const i = find(key)
      const c: Comment = { id: `${key}-c${Date.now()}`, author: i.source === 'local' ? 'You' : 'Casey Morgan', body, created: new Date().toISOString(), mine: true }
      i.comments.push(c)
      i.commentCount = i.comments.length
      touch(i, 'Commented')
      return wait(c)
    },
    async updateComment({ key, id, body }) {
      const i = find(key)
      const c = i.comments.find((x) => x.id === id)
      if (!c?.mine) throw new Error('You can only edit your own comments.')
      c.body = body.trim()
      c.updated = new Date().toISOString()
      touch(i, 'Edited a comment')
      return wait(c)
    },
    async deleteComment({ key, id }) {
      const i = find(key)
      i.comments = i.comments.filter((x) => x.id !== id)
      i.commentCount = i.comments.length
      touch(i, 'Deleted a comment')
      return wait({ ok: true as const })
    },
    async deleteIssue({ key }) {
      db.rows = db.rows.filter((r) => r.issue.key !== key)
      db.rows.forEach(({ issue }) => issue.parent?.key === key && delete issue.parent)
      return wait({ ok: true as const })
    },
    async setParent({ key, parent }) {
      const i = find(key)
      if (parent) {
        const p = find(parent)
        if (p.projectKey !== i.projectKey) throw new Error('A parent must be in the same project.')
        if (parent === key || below(key).has(parent)) throw new Error(`${parent} is below this issue, so it can't be its parent.`)
        i.parent = { key: parent }
      } else delete i.parent
      touch(i, parent ? `Parent set to ${parent}` : 'Parent removed')
      return wait(summary(i))
    },
    async parentOptions({ key, projectKey }) {
      const project = projectKey ?? key?.split('-')[0]
      const skip = key ? below(key) : new Set<string>()
      const list = db.rows
        .map((r) => r.issue)
        .filter((i) => i.projectKey === project && i.key !== key && !skip.has(i.key))
        .sort((a, b) => Number(b.key.split('-')[1]) - Number(a.key.split('-')[1]))
        .map((i) => ref(i.key))
      return wait(list)
    },
    async logWork({ key, seconds, started, comment }) {
      const i = find(key)
      if (!(seconds >= 60)) throw new Error('Log at least one minute.')
      const w: Worklog = {
        id: `${key}-w${Date.now()}`,
        author: i.source === 'local' ? 'You' : 'Casey Morgan',
        started: started ? new Date(started).toISOString() : new Date().toISOString(),
        seconds,
        comment: comment?.trim() ?? '',
        created: new Date().toISOString(),
      }
      i.worklogs.push(w)
      touch(i, `Logged ${Math.round(seconds / 60)}m`)
      return wait(w)
    },
    async deleteWorklog({ key, id }) {
      const i = find(key)
      i.worklogs = i.worklogs.filter((w) => w.id !== id)
      touch(i, 'Removed a time log')
      return wait({ ok: true as const })
    },
    async createLocalProject({ key, name, description }) {
      key = key.trim().toUpperCase()
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) throw new Error('Project keys are 2 to 10 letters or digits and start with a letter.')
      if (db.projects.some((p) => p.key === key)) throw new Error(`A project with key ${key} already exists.`)
      const p: Project = { key, name: name.trim(), description, source: 'local', issueCount: 0, openCount: 0 }
      db.projects.unshift(p)
      db.next[key] = 1
      return wait(p)
    },
    async saveSettings(input) {
      scopeJql = input.scopeJql.trim() || 'assignee = currentUser()'
      return wait({ connected, via: connected ? ('connections' as const) : undefined, siteUrl: connected ? SITE : undefined, scopeJql })
    },
    async forgetLegacyConnection() {
      return wait({ connected, scopeJql })
    },
    async getRepoLinks({ source, key }) {
      return wait(sampleRepoLinks.forIssue({ source, key }))
    },
    async linkRepo({ source, key, path, github }) {
      if (path) {
        const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? path
        sampleRepoLinks.link({ source, key }, { kind: 'local', path, name, github: name === 'orbit-notes' ? 'sample-dev/orbit-notes' : null })
      } else if (github) {
        sampleRepoLinks.link({ source, key }, { kind: 'github', github, name: github })
      } else throw new Error('Pick a repository to link.')
      return wait(sampleRepoLinks.forIssue({ source, key }))
    },
    async unlinkRepo({ source, key, id }) {
      sampleRepoLinks.unlink({ source, key }, id)
      return wait(sampleRepoLinks.forIssue({ source, key }))
    },
    async pickRepoFolder() {
      return wait('C:/Users/sample/Repos/trail-planner')
    },
  }
}
