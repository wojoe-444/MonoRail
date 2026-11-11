export interface RepoInfo {
  path: string
  name: string
  /** Currently checked-out branch, or null when HEAD is detached / repo is empty. */
  currentBranch: string | null
  headSha: string | null
  isEmpty: boolean
  /** Branch shown by default: current branch, else main/master, else first branch. */
  defaultRef: string | null
}

export interface RefInfo {
  name: string
  type: 'branch' | 'tag'
  sha: string
  isCurrent: boolean
  date: string
  author: string
  subject: string
  /** Commits ahead/behind the repo's default branch (branches only). */
  ahead?: number
  behind?: number
}

export interface TreeEntry {
  name: string
  path: string
  type: 'dir' | 'file' | 'submodule' | 'symlink'
  size: number | null
  lastCommit?: { sha: string; subject: string; date: string }
}

export interface CommitSummary {
  sha: string
  shortSha: string
  parents: string[]
  authorName: string
  authorEmail: string
  date: string
  subject: string
  body: string
  refs: string[]
}

export type BlobResult =
  | { kind: 'text'; content: string; size: number; truncated: boolean }
  | { kind: 'image'; dataUrl: string; size: number }
  | { kind: 'binary'; size: number }
  | { kind: 'toolarge'; size: number }

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'meta'
  content: string
  oldNo: number | null
  newNo: number | null
}
export interface DiffHunk {
  header: string
  lines: DiffLine[]
}
export interface DiffFile {
  oldPath: string
  newPath: string
  status: 'added' | 'deleted' | 'modified' | 'renamed'
  binary: boolean
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface CommitDetail extends CommitSummary {
  files: DiffFile[]
  truncated: boolean
}

export interface CompareResult {
  base: string
  head: string
  commits: CommitSummary[]
  files: DiffFile[]
  truncated: boolean
}

export interface LogOptions {
  ref: string
  path?: string
  skip?: number
  limit?: number
  search?: string
}

export type BackupUnit = 'hour' | 'day' | 'week'

/** "Back up X times per unit into destination, keeping the newest `keep` backups." */
export interface BackupSchedule {
  enabled: boolean
  times: number
  unit: BackupUnit
  keep: number
  destination: string
}

export interface BackupFile {
  name: string
  path: string
  size: number
  createdAt: string
}

export type BackupResult =
  | { ok: true; at: string; file: string; size: number }
  | { ok: false; at: string; error: string }

export interface BackupState {
  schedule: BackupSchedule | null
  lastResult: BackupResult | null
  lastSuccessAt: string | null
  nextDueAt: string | null
  running: boolean
  /** Backups of this repo in the destination folder, newest first. */
  files: BackupFile[]
}
