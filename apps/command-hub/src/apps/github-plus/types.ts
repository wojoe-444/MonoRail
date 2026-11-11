export interface RepoInfo {
  path: string
  name: string
  /** Currently checked-out branch, or null when HEAD is detached / repo is empty. */
  currentBranch: string | null
  headSha: string | null
  isEmpty: boolean
  /** Branch shown by default: current branch, else main/master, else first branch. */
  defaultRef: string | null
  /** Set when another MonoRail app created this repo (e.g. Jira+'s private projects). */
  linked?: LinkedSource
}

/** Which MonoRail app created a repo, for its badge. */
export interface LinkedSource {
  app: string
  label: string
}

/** A repo another MonoRail app created, listed in GitHub+ without being opened first. */
export interface LinkedRepo extends LinkedSource {
  path: string
  name: string
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
  lastCommit?: LastCommit
}

export interface LastCommit { sha: string; subject: string; date: string }
export interface Divergence { ahead: number; behind: number }

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

/** What making a plain folder into a repo would snapshot. Nothing has been written yet. */
export interface FolderPreview {
  path: string
  name: string
  fileCount: number
  totalBytes: number
  /** True when the scan stopped early (very large folder). */
  truncated: boolean
  large: { path: string; size: number }[]
  sensitive: string[]
  /** Folders such as node_modules that are skipped and ignored by default. */
  skippedDirs: string[]
  hasGitignore: boolean
  largeThresholdBytes: number
}

export interface InitOptions {
  excludeLarge: boolean
  excludeSensitive: boolean
}

export interface GitHubPlusSettings {
  /** Make plain folders into repos without asking. Off by default. */
  autoInitFolders: boolean
}

export interface ActiveBranch {
  name: string
  sha: string
  date: string
  author: string
  subject: string
  isDefault: boolean
  ahead?: number
  behind?: number
}

/** One recently opened repo, as summarized for the home dashboard. */
export interface RepoActivity {
  path: string
  name: string
  defaultRef?: string | null
  currentBranch?: string | null
  isEmpty?: boolean
  /** Set when the repo could not be read (moved, deleted, no longer a repo). */
  error?: string
  /** Set when another MonoRail app created this repo (e.g. Jira+'s private projects). */
  linked?: LinkedSource
  /** Newest commits on any branch. */
  commits: CommitSummary[]
  /** Most recently updated branches. */
  branches: ActiveBranch[]
  backup: Pick<BackupState, 'schedule' | 'lastResult' | 'nextDueAt'> | null
  /** Open local issues: the count and the newest few. */
  openIssues?: number
  issues?: IssueSummary[]
  /** "owner/name" of the repo's github.com remote (origin first), if it has one. */
  github?: string | null
}

/** One of the user's repositories on github.com (GitHub connection on Connections). */
export interface GitHubRepo {
  fullName: string
  owner: string
  name: string
  description: string
  private: boolean
  fork: boolean
  archived: boolean
  hasIssues: boolean
  canPush: boolean
  /** owner: yours; organization: an organization you belong to; collaborator: shared with you. */
  relation: 'owner' | 'organization' | 'collaborator'
  pushedAt: string | null
  defaultBranch: string | null
}
export interface GitHubRepos {
  /** False until the user sets up GitHub on the Connections page; nothing is fetched before that. */
  connected: boolean
  login?: string | null
  repos: GitHubRepo[]
  /** More than 1,000 repositories: only the most recently pushed are listed. */
  truncated?: boolean
  fetchedAt?: string | null
  /** The last fetch failed (repos are then the last good list, if any). */
  error?: string
}
/** Where a new issue could also be created on GitHub. */
export interface GitHubTarget {
  /** "owner/name" of the repo's github.com remote, or null. */
  repo: string | null
  /** True once GitHub is set up on the Connections page. */
  connected: boolean
}
/** Set on a local issue that was also created on GitHub. */
export interface GitHubIssueLink { repo: string; number: number; url: string }

/** Local issues, stored in the repo under refs/local-issues (one JSON file per issue). */
export type IssueState = 'open' | 'closed'
export type IssueEvent =
  | { kind: 'comment'; author: string; at: string; body: string }
  | { kind: 'closed' | 'reopened'; author: string; at: string }
export interface Issue {
  number: number
  title: string
  body: string
  state: IssueState
  author: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  timeline: IssueEvent[]
  /** Set when the issue was also created on GitHub. Later edits and comments stay local. */
  github?: GitHubIssueLink | null
}
export type IssueSummary = Omit<Issue, 'body' | 'timeline'> & { comments: number }
export interface IssueCounts { open: number; closed: number }
export interface IssueEdit { title?: string; body?: string; state?: IssueState }
