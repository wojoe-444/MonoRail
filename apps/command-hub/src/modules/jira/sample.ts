// Fictional sample data for the browser dev server, where there is no Electron
// backend. Nothing here is real: the site, people and tickets are made up.

import type { JiraApi } from './api'
import type { Comment, IssueDetail, Overview, Project, Source, StatusCategory } from './types'

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
const TYPES = ['Task', 'Bug', 'Story', 'Spike']
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
        ? [{ id: `${key}-c1`, author: source === 'local' ? 'You' : (reporter ?? 'Teammate'), body: 'Looked at this today. Next step is in the description.', created: updated }]
        : []
    return {
      issue: {
        key,
        source,
        projectKey: project,
        projectName: projects.find((p) => p.key === project)?.name,
        summary,
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
      },
    }
  })
  return { projects, rows, next: { ME: 6, PLAT: 119, WEB: 441 } }
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
  let connected = true

  const statusesFor = (source: Source) => (source === 'local' ? LOCAL_STATUSES : JIRA_STATUSES)
  const find = (key: string) => {
    const row = db.rows.find((r) => r.issue.key === key)
    if (!row) throw new Error(`No ticket ${key}`)
    return row.issue
  }
  const visible = () => db.rows.map((r) => r.issue).filter((i) => connected || i.source === 'local')
  const summary = (i: IssueDetail) => {
    const { comments: _c, history: _h, transitions: _t, ...rest } = i
    return rest
  }
  const touch = (i: IssueDetail, text: string) => {
    i.updated = new Date().toISOString()
    if (i.source === 'local') i.history.unshift({ id: fakeSha(i.key + i.updated), at: i.updated, text })
  }

  return {
    async getOverview() {
      const projects = db.projects
        .filter((p) => connected || p.source === 'local')
        .map((p) => {
          const issues = visible().filter((i) => i.projectKey === p.key)
          return { ...p, issueCount: issues.length, openCount: issues.filter((i) => i.statusCategory !== 'done').length }
        })
      const overview: Overview = {
        connection: connected
          ? { connected: true, siteUrl: SITE, email: 'casey@example.com', displayName: 'Casey Morgan', scopeJql: 'assignee = currentUser()', encrypted: true }
          : { connected: false, scopeJql: 'assignee = currentUser()' },
        projects,
        local: { statuses: LOCAL_STATUSES, types: TYPES, priorities: PRIORITIES, repoDir: '%APPDATA%\\MonoHub\\modules\\jira\\local-repo' },
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
      return wait({ ...i, transitions })
    },
    async getIssueTypes({ source }) {
      return wait(source === 'local' ? TYPES : ['Task', 'Bug', 'Story'])
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
      touch(i, `Status ${from} → ${to.name}`)
      return wait(summary(i))
    },
    async addComment({ key, body }) {
      const i = find(key)
      const c: Comment = { id: `${key}-c${Date.now()}`, author: i.source === 'local' ? 'You' : 'Casey Morgan', body, created: new Date().toISOString() }
      i.comments.push(c)
      i.commentCount = i.comments.length
      touch(i, 'Commented')
      return wait(c)
    },
    async deleteIssue({ key }) {
      db.rows = db.rows.filter((r) => r.issue.key !== key)
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
    async saveConnection(input) {
      connected = true
      return wait({ connected: true, siteUrl: input.siteUrl, email: input.email, displayName: 'Casey Morgan', scopeJql: input.scopeJql, encrypted: true })
    },
    async disconnect() {
      connected = false
      return wait({ connected: false, scopeJql: 'assignee = currentUser()' })
    },
  }
}
