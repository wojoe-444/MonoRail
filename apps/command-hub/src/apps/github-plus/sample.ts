// A fictional repository for the browser dev server, where there is no git
// backend. Every name, path, person and line of code here is made up.
import type { RepoApi } from './api'
import { jiraApi } from '../jira-plus/api'
import { sampleRepoLinks } from '../jira-plus/sampleRepoLinks'
import type { LinkedTask } from './types'

/** Linked tasks from the shared sample links, with summaries from the Tasks sample tickets. */
async function sampleTasks(repo: { path?: string; github?: string | null }): Promise<LinkedTask[]> {
  const all = await jiraApi().listIssues({ source: 'all' })
  return sampleRepoLinks.forRepo(repo).map(({ issue, link }) => {
    const i = all.find((x) => x.source === issue.source && x.key === issue.key)
    const base = { linkId: link.id, source: issue.source, key: issue.key, linkedAt: link.linkedAt }
    return i
      ? { ...base, summary: i.summary, status: i.status, statusCategory: i.statusCategory, type: i.type, projectName: i.projectName, url: i.url }
      : { ...base, error: 'This ticket no longer exists in Tasks.' }
  })
}
const sampleGitHubOf = (repo: string) => (repo.endsWith('/orbit-notes') ? 'sample-dev/orbit-notes' : null)
import type { GitHubRepo, BackupState, CommitDetail, Issue, IssueSummary, LinkedRepo, RepoActivity, CommitSummary, LastCommit, DiffFile, RefInfo, RepoInfo, TreeEntry } from './types'

const REPO: RepoInfo = {
  path: 'C:/Users/sample/Repos/orbit-notes',
  name: 'orbit-notes',
  currentBranch: 'main',
  headSha: 'b7e4c19a0d2f6e8a1c3b5d7f9e0a2c4b6d8f0a1c',
  isEmpty: false,
  defaultRef: 'main',
}

// Fictional github.com repositories: orbit-notes matches the local sample repo.
const ghRepo = (fullName: string, relation: GitHubRepo['relation'], extra: Partial<GitHubRepo> = {}): GitHubRepo => ({
  fullName,
  owner: fullName.split('/')[0],
  name: fullName.split('/')[1],
  description: '',
  private: false,
  fork: false,
  archived: false,
  hasIssues: true,
  canPush: true,
  relation,
  pushedAt: new Date(Date.now() - 3_600_000).toISOString(),
  defaultBranch: 'main',
  ...extra,
})
const GITHUB_REPOS: GitHubRepo[] = [
  ghRepo('sample-dev/orbit-notes', 'owner', { description: 'A tiny note-taking library.' }),
  ghRepo('acme-demo/platform-api', 'organization', { private: true, description: 'Team service (fictional).' }),
  ghRepo('acme-demo/web-console', 'organization', { private: true }),
  ghRepo('river-labs/data-pipes', 'collaborator', { description: 'Shared with you as a collaborator.' }),
  ghRepo('sample-dev/dotfiles', 'owner', { archived: true }),
]

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const README = `# orbit-notes

A tiny note-taking library used as **sample data** for GitHub+.

## Features

- Plain-text notes stored as Markdown
- Tags and quick search
- Zero network access

\`\`\`ts
import { createNote } from './src/notes'

createNote('Groceries', 'Oat milk, coffee')
\`\`\`

See [the guide](docs/guide.md) for more.
`
const GUIDE = `# Guide

Notes live in a folder you choose. Each note is one Markdown file.

| Command | What it does |
| --- | --- |
| \`add\` | Create a note |
| \`list\` | List notes |
`
const NOTES_V1 = `export interface Note {
  title: string
  body: string
  tags: string[]
}

export function createNote(title: string, body: string, tags: string[] = []): Note {
  return { title, body, tags }
}
`
const NOTES_V2 = NOTES_V1 + `
export function hasTag(note: Note, tag: string): boolean {
  return note.tags.includes(tag)
}
`
const SEARCH = `import type { Note } from './notes'

/** Case-insensitive search over titles and bodies. */
export function search(notes: Note[], query: string): Note[] {
  const q = query.toLowerCase()
  return notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
}
`
const INDEX = `export * from './notes'\n`
const PKG = `{\n  "name": "orbit-notes",\n  "version": "0.1.0",\n  "private": true\n}\n`

type Files = Record<string, string>
const MAIN_FILES: Files = { 'README.md': README, 'package.json': PKG, 'src/index.ts': INDEX, 'src/notes.ts': NOTES_V1, 'docs/guide.md': GUIDE }
const FEATURE_FILES: Files = { ...MAIN_FILES, 'src/notes.ts': NOTES_V2, 'src/search.ts': SEARCH }

const lines = (s: string) => s.replace(/\n$/, '').split('\n')
const added = (path: string, content: string): DiffFile => ({
  oldPath: path,
  newPath: path,
  status: 'added',
  binary: false,
  additions: lines(content).length,
  deletions: 0,
  hunks: [{ header: `@@ -0,0 +1,${lines(content).length} @@`, lines: lines(content).map((c, i) => ({ type: 'add', content: c, oldNo: null, newNo: i + 1 })) }],
})

interface SampleCommit extends CommitSummary {
  files: DiffFile[]
}
const commit = (sha: string, parents: string[], authorName: string, daysAgo: number, subject: string, files: DiffFile[], body = '', refs: string[] = []): SampleCommit => ({
  sha,
  shortSha: sha.slice(0, 7),
  parents,
  authorName,
  authorEmail: `${authorName.split(' ')[0].toLowerCase()}@example.invalid`,
  date: day(daysAgo),
  subject,
  body,
  refs,
  files,
})

const notesDiff: DiffFile = {
  oldPath: 'src/notes.ts',
  newPath: 'src/notes.ts',
  status: 'modified',
  binary: false,
  additions: 4,
  deletions: 0,
  hunks: [
    {
      header: '@@ -7,3 +7,7 @@ export function createNote',
      lines: [
        { type: 'context', content: '  return { title, body, tags }', oldNo: 8, newNo: 8 },
        { type: 'context', content: '}', oldNo: 9, newNo: 9 },
        { type: 'add', content: '', oldNo: null, newNo: 10 },
        { type: 'add', content: 'export function hasTag(note: Note, tag: string): boolean {', oldNo: null, newNo: 11 },
        { type: 'add', content: '  return note.tags.includes(tag)', oldNo: null, newNo: 12 },
        { type: 'add', content: '}', oldNo: null, newNo: 13 },
      ],
    },
  ],
}

const C1 = commit('3f2a9c1e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a', [], 'Avery Lin', 21, 'Initial commit', [
  added('README.md', README),
  added('package.json', PKG),
  added('src/index.ts', INDEX),
  added('src/notes.ts', NOTES_V1),
])
const C2 = commit('b7e4c19a0d2f6e8a1c3b5d7f9e0a2c4b6d8f0a1c', [C1.sha], 'Sam Ortega', 9, 'Add user guide', [added('docs/guide.md', GUIDE)], 'Covers the folder layout and the two CLI commands.', ['HEAD -> main', 'tag: v0.1.0'])
const C3 = commit('e1d9b8a7c6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1', [C2.sha], 'Avery Lin', 2, 'Add quick search and tag filter', [added('src/search.ts', SEARCH), notesDiff], '', ['feature/search'])
const COMMITS = [C3, C2, C1]

const REFS: RefInfo[] = [
  { name: 'feature/search', type: 'branch', sha: C3.sha, isCurrent: false, date: C3.date, author: C3.authorName, subject: C3.subject, ahead: 1, behind: 0 },
  { name: 'main', type: 'branch', sha: C2.sha, isCurrent: true, date: C2.date, author: C2.authorName, subject: C2.subject, ahead: 0, behind: 0 },
  { name: 'v0.1.0', type: 'tag', sha: C2.sha, isCurrent: false, date: C2.date, author: C2.authorName, subject: C2.subject },
]

/** Commits reachable from a ref, newest first. */
function history(ref: string): SampleCommit[] {
  const tip = REFS.find((r) => r.name === ref)?.sha ?? COMMITS.find((c) => c.sha.startsWith(ref))?.sha ?? (ref === 'HEAD' ? C2.sha : undefined)
  if (!tip) throw new Error(`unknown revision: ${ref}`)
  return COMMITS.slice(COMMITS.findIndex((c) => c.sha === tip))
}
const filesAt = (ref: string): Files => (history(ref)[0] === C3 ? FEATURE_FILES : MAIN_FILES)
const summary = ({ files: _files, ...c }: SampleCommit): CommitSummary => c
const touches = (c: SampleCommit, path: string) => c.files.some((f) => f.newPath === path || f.newPath.startsWith(path + '/'))

// Backups in the browser preview: kept in memory, nothing is written.
const UNIT_MS = { hour: 3_600_000, day: 86_400_000, week: 604_800_000 }
let backup: BackupState = {
  schedule: { enabled: true, times: 1, unit: 'day', keep: 14, destination: 'C:/Users/sample/OneDrive/Backups' },
  lastResult: { ok: true, at: day(0.3), file: 'C:/Users/sample/OneDrive/Backups/orbit-notes/orbit-notes-sample.bundle', size: 48_213 },
  lastSuccessAt: day(0.3),
  nextDueAt: new Date(Date.parse(day(0.3)) + UNIT_MS.day).toISOString(),
  effective: { destination: 'C:/Users/sample/OneDrive/Backups', times: 1, unit: 'day', keep: 14 },
  problem: null,
  global: { enabled: true, folder: 'C:/Users/sample/OneDrive/MonoRail backups', times: 1, unit: 'day', keep: 14 },
  globalFolder: 'C:/Users/sample/OneDrive/MonoRail backups/github-plus',
  running: false,
  files: [0.3, 1.3, 2.3].map((d) => {
    const at = day(d)
    const name = `orbit-notes-${at.slice(0, 19).replace(/:/g, '').replace('T', '_')}.bundle`
    return { name, path: `C:/Users/sample/OneDrive/Backups/orbit-notes/${name}`, size: 48_213, createdAt: at }
  }),
}
const reschedule = (b: BackupState): BackupState => {
  const s = b.schedule
  const f = s?.useGlobalFrequency && b.global ? b.global : s
  const effective = s && f ? { destination: s.useGlobalFolder ? b.globalFolder ?? '' : s.destination, times: f.times, unit: f.unit, keep: f.keep } : null
  return {
    ...b,
    effective,
    nextDueAt: s?.enabled && effective ? new Date((b.lastSuccessAt ? Date.parse(b.lastSuccessAt) : Date.now()) + UNIT_MS[effective.unit] / effective.times).toISOString() : null,
  }
}

const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))

// Two more fictional repos so the home dashboard has something to show.
const OTHER_REPOS: RepoActivity[] = [
  {
    path: 'C:/Users/sample/Repos/trail-planner',
    name: 'trail-planner',
    defaultRef: 'main',
    currentBranch: 'elevation-chart',
    commits: [
      commit('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', [], 'Jordan Pike', 0.1, 'Draw elevation profile under the map', []),
      commit('b2c3d4e5f60718293a4b5c6d7e8f901234567890', [], 'Jordan Pike', 1.2, 'Cache tile downloads for offline use', []),
      commit('c3d4e5f60718293a4b5c6d7e8f90123456789012', [], 'Riley Chen', 4, 'Fix distance rounding for short trails', []),
    ].map(summary),
    branches: [
      { name: 'elevation-chart', sha: 'a1b2c3d4', date: day(0.1), author: 'Jordan Pike', subject: 'Draw elevation profile under the map', isDefault: false, ahead: 3, behind: 1 },
      { name: 'main', sha: 'c3d4e5f6', date: day(4), author: 'Riley Chen', subject: 'Fix distance rounding for short trails', isDefault: true },
    ],
    backup: null,
  },
  {
    path: 'C:/Users/sample/Repos/recipe-box',
    name: 'recipe-box',
    defaultRef: 'main',
    currentBranch: 'main',
    commits: [commit('d4e5f60718293a4b5c6d7e8f9012345678901234', [], 'Sam Ortega', 6, 'Add shopping list export', [])].map(summary),
    branches: [{ name: 'main', sha: 'd4e5f607', date: day(6), author: 'Sam Ortega', subject: 'Add shopping list export', isDefault: true }],
    backup: null,
  },
]

// Tasks' private projects repo, listed without being opened (linked.cjs on the desktop).
const JIRA_REPO: LinkedRepo = { path: 'C:/Users/sample/AppData/Roaming/MonoRail/apps/jira-plus/local-repo', name: 'Tasks projects', app: 'jira-plus', label: 'Tasks' }
const JIRA_ACTIVITY: RepoActivity = {
  path: JIRA_REPO.path,
  name: JIRA_REPO.name,
  linked: { app: JIRA_REPO.app, label: JIRA_REPO.label },
  defaultRef: 'main',
  currentBranch: 'main',
  commits: [commit('e5f60718293a4b5c6d7e8f90123456789012345a', [], 'You', 0.3, 'ME-2: Status In Progress', [])].map(summary),
  branches: [{ name: 'main', sha: 'e5f60718', date: day(0.3), author: 'You', subject: 'ME-2: Status In Progress', isDefault: true }],
  backup: null,
}

// Fictional local issues for orbit-notes.
let issues: Issue[] = [
  {
    number: 3, title: 'Search ignores accents (café vs cafe)', state: 'open', author: 'Avery Lin', createdAt: day(1.5), updatedAt: day(0.4), closedAt: null,
    body: 'Searching for `cafe` should also find notes titled **Café plans**.\n\nProbably normalize with `String.prototype.normalize("NFD")` in `src/search.ts`.',
    timeline: [{ kind: 'comment', author: 'Sam Ortega', at: day(0.4), body: 'Agreed. Tags too, while we are at it.' }],
  },
  {
    number: 2, title: 'Add an export to Markdown command', state: 'open', author: 'Sam Ortega', createdAt: day(5), updatedAt: day(5), closedAt: null,
    body: 'One `.md` file per note, front matter for tags.', timeline: [],
  },
  {
    number: 1, title: 'Guide mentions a command that does not exist', state: 'closed', author: 'Avery Lin', createdAt: day(12), updatedAt: day(9), closedAt: day(9),
    body: '`orbit sync` is described in docs/guide.md but was never built.',
    timeline: [
      { kind: 'comment', author: 'Sam Ortega', at: day(9.1), body: 'Removed it from the guide in the user guide commit.' },
      { kind: 'closed', author: 'Sam Ortega', at: day(9) },
    ],
  },
]
const issueSummary = ({ body: _b, timeline, ...i }: Issue): IssueSummary => ({ ...i, comments: timeline.filter((t) => t.kind === 'comment').length })
const findIssue = (n: number): Issue => {
  const i = issues.find((x) => x.number === n)
  if (!i) throw new Error(`Issue #${n} was not found`)
  return i
}
const saveIssue = (i: Issue): Promise<Issue> => {
  issues = [i, ...issues.filter((x) => x.number !== i.number)].sort((a, b) => b.number - a.number)
  return wait(i)
}
const SAMPLE_USER = 'Avery Lin'

// A plain (non-git) folder, so the browser preview can show "Make this a git repo".
const PLAIN = 'C:/Users/sample/Documents/Job search'
let plainIsRepo = false
let settings = { autoInitFolders: false }

export const sampleApi: RepoApi = {
  pickRepoFolder: () => wait(REPO.path),
  async openRepo(dir) {
    if (dir === PLAIN && !plainIsRepo) throw new Error(`"${dir}" is not inside a git repository`)
    if (dir === JIRA_REPO.path) return wait({ ...REPO, path: dir, name: JIRA_REPO.name, linked: { app: JIRA_REPO.app, label: JIRA_REPO.label } })
    return wait(dir === PLAIN ? { ...REPO, path: PLAIN, name: 'Job search' } : REPO)
  },
  previewFolder: (dir) =>
    wait({
      path: dir,
      name: dir.split('/').pop() ?? dir,
      fileCount: 37,
      totalBytes: 212_000_000,
      truncated: false,
      large: [{ path: 'Interview recordings/mock-interview.mp4', size: 184_000_000 }],
      sensitive: ['.env'],
      skippedDirs: [],
      hasGitignore: false,
      largeThresholdBytes: 50 * 1024 * 1024,
    }),
  async initRepo(dir) {
    plainIsRepo = true
    return this.openRepo(dir)
  },
  getSettings: () => wait(settings),
  saveSettings: async (s) => wait((settings = { ...s })),
  getRecents: () => wait([REPO.path, PLAIN, ...OTHER_REPOS.map((r) => r.path)]),
  async getActivity() {
    const orbit: RepoActivity = {
      path: REPO.path,
      name: REPO.name,
      defaultRef: 'main',
      currentBranch: 'main',
      commits: COMMITS.map(summary),
      branches: [
        { name: 'feature/search', sha: C3.sha, date: C3.date, author: C3.authorName, subject: C3.subject, isDefault: false, ahead: 1, behind: 0 },
        { name: 'main', sha: C2.sha, date: C2.date, author: C2.authorName, subject: C2.subject, isDefault: true },
      ],
      backup: backup.schedule ? { schedule: backup.schedule, lastResult: backup.lastResult, nextDueAt: backup.nextDueAt } : null,
      openIssues: issues.filter((i) => i.state === 'open').length,
      issues: issues.filter((i) => i.state === 'open').slice(0, 5).map(issueSummary),
      github: 'sample-dev/orbit-notes',
    }
    const plain: RepoActivity = plainIsRepo
      ? { ...orbit, path: PLAIN, name: 'Job search', backup: null }
      : { path: PLAIN, name: 'Job search', error: `"${PLAIN}" is not inside a git repository`, commits: [], branches: [], backup: null }
    return wait([orbit, plain, ...OTHER_REPOS, JIRA_ACTIVITY])
  },
  getLinked: () => wait([JIRA_REPO]),
  githubRepos: () => wait({ connected: true, login: 'sample-dev', repos: GITHUB_REPOS, truncated: false, fetchedAt: new Date().toISOString() }),
  githubTarget: (repo) => wait({ repo: repo === REPO.path ? 'sample-dev/orbit-notes' : null, connected: true }),
  cloneGitHubRepo: async () => {
    throw new Error('Cloning needs the desktop app.')
  },
  openOnGitHub: () => wait(null),
  linkedTasks: (repo) => sampleTasks({ path: repo, github: sampleGitHubOf(repo) }),
  linkedTaskCount: async (repo) => wait(sampleRepoLinks.forRepo({ path: repo, github: sampleGitHubOf(repo) }).length),
  linkedTasksOnGitHub: (fullName) => sampleTasks({ github: fullName }),
  linkCounts: async () => wait(sampleRepoLinks.counts()),
  async linkTask(repo, source, key) {
    sampleRepoLinks.link({ source, key }, { kind: 'local', path: repo, name: repo.split('/').pop() ?? repo, github: sampleGitHubOf(repo) })
    return sampleTasks({ path: repo, github: sampleGitHubOf(repo) })
  },
  async unlinkTask(repo, t) {
    sampleRepoLinks.unlink({ source: t.source, key: t.key }, t.linkId)
    return sampleTasks({ path: repo, github: sampleGitHubOf(repo) })
  },
  removeRecent: () => wait([]),
  // No file manager in the browser dev server.
  openInExplorer: () => wait(null),
  listRefs: () => wait(REFS),
  async listTree(_repo, ref, dir) {
    const files = filesAt(ref)
    const prefix = dir ? dir + '/' : ''
    const seen = new Map<string, TreeEntry>()
    for (const [p, content] of Object.entries(files)) {
      if (!p.startsWith(prefix)) continue
      const [name, ...rest] = p.slice(prefix.length).split('/')
      const path = prefix + name
      const isDir = rest.length > 0
      seen.set(path, { name, path, type: isDir ? 'dir' : 'file', size: isDir ? null : content.length })
    }
    const entries = [...seen.values()].sort((a, b) => (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || a.name.localeCompare(b.name))
    if (dir && entries.length === 0) throw new Error(`Not a tree: ${dir}`)
    return wait(entries)
  },
  async treeLastCommits(repo, ref, dir) {
    const out: Record<string, LastCommit> = {}
    for (const e of await sampleApi.listTree(repo, ref, dir)) {
      const last = history(ref).find((c) => touches(c, e.path))
      if (last) out[e.name] = { sha: last.sha, subject: last.subject, date: last.date }
    }
    return wait(out)
  },
  branchDivergence: async () => wait(Object.fromEntries(REFS.filter((r) => r.type === 'branch').map((r) => [r.name, { ahead: r.ahead ?? 0, behind: r.behind ?? 0 }]))),
  async readBlob(_repo, ref, path) {
    const content = filesAt(ref)[path]
    if (content === undefined) throw new Error(`path '${path}' does not exist in '${ref}'`)
    return wait({ kind: 'text' as const, content, size: content.length, truncated: false })
  },
  async getLog(_repo, { ref, path, search, skip = 0, limit = 30 }) {
    let list = history(ref)
    if (path) list = list.filter((c) => touches(c, path))
    if (search) list = list.filter((c) => c.subject.toLowerCase().includes(search.toLowerCase()))
    return wait({ commits: list.slice(skip, skip + limit).map(summary), hasMore: list.length > skip + limit })
  },
  countCommits: async (_repo, ref) => wait(history(ref).length),
  async getCommit(_repo, sha) {
    const c = COMMITS.find((x) => x.sha.startsWith(sha))
    if (!c) throw new Error(`Commit not found: ${sha}`)
    return wait<CommitDetail>({ ...c, truncated: false })
  },
  listIssues: (_repo, state) => wait(issues.filter((i) => state === 'all' || i.state === state).map(issueSummary)),
  issueCounts: () => wait({ open: issues.filter((i) => i.state === 'open').length, closed: issues.filter((i) => i.state === 'closed').length }),
  getIssue: async (_repo, n) => wait(findIssue(n)),
  async createIssue(_repo, title, body, onGitHub) {
    if (!title.trim()) throw new Error('An issue needs a title')
    const now = new Date().toISOString()
    const number = Math.max(0, ...issues.map((i) => i.number)) + 1
    const github = onGitHub ? { repo: 'sample-dev/orbit-notes', number: 40 + number, url: `https://github.com/sample-dev/orbit-notes/issues/${40 + number}` } : null
    return saveIssue({ number, title: title.trim(), body, state: 'open', author: SAMPLE_USER, createdAt: now, updatedAt: now, closedAt: null, timeline: [], github })
  },
  async updateIssue(_repo, n, edit) {
    const i = structuredClone(findIssue(n))
    const now = new Date().toISOString()
    if (edit.title !== undefined) i.title = edit.title.trim()
    if (edit.body !== undefined) i.body = edit.body
    if (edit.state && edit.state !== i.state) {
      i.state = edit.state
      i.closedAt = edit.state === 'closed' ? now : null
      i.timeline.push({ kind: edit.state === 'closed' ? 'closed' : 'reopened', author: SAMPLE_USER, at: now })
    }
    i.updatedAt = now
    return saveIssue(i)
  },
  async addIssueComment(_repo, n, body) {
    if (!body.trim()) throw new Error('A comment needs some text')
    const i = structuredClone(findIssue(n))
    const now = new Date().toISOString()
    i.timeline.push({ kind: 'comment', author: SAMPLE_USER, at: now, body })
    i.updatedAt = now
    return saveIssue(i)
  },
  pickBackupFolder: () => wait('C:/Users/sample/OneDrive/Backups'),
  getBackup: () => wait(backup),
  saveBackup: async (_repo, schedule) => wait((backup = reschedule({ ...backup, schedule }))),
  removeBackup: async () => wait((backup = { ...backup, schedule: null, effective: null, lastResult: null, lastSuccessAt: null, nextDueAt: null, running: false, files: [] })),
  async runBackup() {
    if (!backup.schedule) throw new Error('Set up backups for this repository first')
    const at = new Date().toISOString()
    const name = `orbit-notes-${at.slice(0, 19).replace(/:/g, '').replace('T', '_')}.bundle`
    const eff = backup.effective ?? { destination: backup.schedule.destination, keep: backup.schedule.keep }
    const file = { name, path: `${eff.destination}/orbit-notes/${name}`, size: 48_213, createdAt: at }
    backup = reschedule({ ...backup, lastSuccessAt: at, lastResult: { ok: true, at, file: file.path, size: file.size }, files: [file, ...backup.files].slice(0, eff.keep) })
    return wait(backup)
  },
  async compareRefs(_repo, base, head) {
    const baseShas = new Set(history(base).map((c) => c.sha))
    const commits = history(head).filter((c) => !baseShas.has(c.sha))
    return wait({ base, head, commits: commits.map(summary), files: commits.flatMap((c) => c.files), truncated: false })
  },
}
