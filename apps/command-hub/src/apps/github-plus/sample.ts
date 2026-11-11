// A fictional repository for the browser dev server, where there is no git
// backend. Every name, path, person and line of code here is made up.
import type { RepoApi } from './api'
import type { BackupState, CommitDetail, CommitSummary, DiffFile, RefInfo, RepoInfo, TreeEntry } from './types'

const REPO: RepoInfo = {
  path: 'C:/Users/sample/Repos/orbit-notes',
  name: 'orbit-notes',
  currentBranch: 'main',
  headSha: 'b7e4c19a0d2f6e8a1c3b5d7f9e0a2c4b6d8f0a1c',
  isEmpty: false,
  defaultRef: 'main',
}

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
  running: false,
  files: [0.3, 1.3, 2.3].map((d) => {
    const at = day(d)
    const name = `orbit-notes-${at.slice(0, 19).replace(/:/g, '').replace('T', '_')}.bundle`
    return { name, path: `C:/Users/sample/OneDrive/Backups/orbit-notes/${name}`, size: 48_213, createdAt: at }
  }),
}
const reschedule = (b: BackupState): BackupState => ({
  ...b,
  nextDueAt: b.schedule?.enabled ? new Date((b.lastSuccessAt ? Date.parse(b.lastSuccessAt) : Date.now()) + UNIT_MS[b.schedule.unit] / b.schedule.times).toISOString() : null,
})

const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))

// A plain (non-git) folder, so the browser preview can show "Make this a git repo".
const PLAIN = 'C:/Users/sample/Documents/Job search'
let plainIsRepo = false
let settings = { autoInitFolders: false }

export const sampleApi: RepoApi = {
  pickRepoFolder: () => wait(REPO.path),
  async openRepo(dir) {
    if (dir === PLAIN && !plainIsRepo) throw new Error(`"${dir}" is not inside a git repository`)
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
  getRecents: () => wait([REPO.path, PLAIN]),
  removeRecent: () => wait([]),
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
      const last = history(ref).find((c) => touches(c, path))
      seen.set(path, { name, path, type: isDir ? 'dir' : 'file', size: isDir ? null : content.length, lastCommit: last && { sha: last.sha, subject: last.subject, date: last.date } })
    }
    const entries = [...seen.values()].sort((a, b) => (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1) || a.name.localeCompare(b.name))
    if (dir && entries.length === 0) throw new Error(`Not a tree: ${dir}`)
    return wait(entries)
  },
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
  pickBackupFolder: () => wait('C:/Users/sample/OneDrive/Backups'),
  getBackup: () => wait(backup),
  saveBackup: async (_repo, schedule) => wait((backup = reschedule({ ...backup, schedule }))),
  removeBackup: async () => wait((backup = { schedule: null, lastResult: null, lastSuccessAt: null, nextDueAt: null, running: false, files: [] })),
  async runBackup() {
    if (!backup.schedule) throw new Error('Set up backups for this repository first')
    const at = new Date().toISOString()
    const name = `orbit-notes-${at.slice(0, 19).replace(/:/g, '').replace('T', '_')}.bundle`
    const file = { name, path: `${backup.schedule.destination}/orbit-notes/${name}`, size: 48_213, createdAt: at }
    backup = reschedule({ ...backup, lastSuccessAt: at, lastResult: { ok: true, at, file: file.path, size: file.size }, files: [file, ...backup.files].slice(0, backup.schedule.keep) })
    return wait(backup)
  },
  async compareRefs(_repo, base, head) {
    const baseShas = new Set(history(base).map((c) => c.sha))
    const commits = history(head).filter((c) => !baseShas.has(c.sha))
    return wait({ base, head, commits: commits.map(summary), files: commits.flatMap((c) => c.files), truncated: false })
  },
}
