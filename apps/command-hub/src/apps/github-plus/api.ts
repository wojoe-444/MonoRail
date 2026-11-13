import { invokeApp } from '../client'
import { isDesktop } from '@/modules/client'

import { sampleApi } from './sample'
import type { LinkCounts, LinkedTask, GitHubRepos, GitHubTarget, BackupSchedule, BackupState, BlobResult, FolderPreview, GitHubPlusSettings, LinkedRepo, Issue, IssueCounts, IssueEdit, IssueState, IssueSummary, InitOptions, RepoActivity, CommitDetail, CommitSummary, Divergence, LastCommit, CompareResult, LogOptions, RefInfo, RepoInfo, TreeEntry } from './types'

/**
 * Everything GitHub+ asks of its backend (electron/apps/github-plus). Every call
 * stays on this machine except the GitHub ones, which run only once the user has
 * set up GitHub on the Connections page.
 */
export interface RepoApi {
  pickRepoFolder(): Promise<string | null>
  openRepo(dir: string): Promise<RepoInfo>
  /** Plain folders: preview, then git init + first commit (opens the new repo). */
  previewFolder(dir: string): Promise<FolderPreview>
  initRepo(dir: string, opts: InitOptions): Promise<RepoInfo>
  getSettings(): Promise<GitHubPlusSettings>
  saveSettings(settings: GitHubPlusSettings): Promise<GitHubPlusSettings>
  /** Recently opened repo paths, newest first. Kept in the app's AppData folder. */
  getRecents(): Promise<string[]>
  /** Repos other MonoRail apps created (Tasks' private projects), listed without being opened first. */
  getLinked(): Promise<LinkedRepo[]>
  /** Home dashboard: activity across the recently opened repos and the linked ones. */
  getActivity(): Promise<RepoActivity[]>
  removeRecent(path: string): Promise<string[]>
  listRefs(repo: string): Promise<RefInfo[]>
  /** Folder entries only; the last commit per entry is treeLastCommits, so the list shows first. */
  listTree(repo: string, ref: string, path: string): Promise<TreeEntry[]>
  /** Newest commit touching each entry of a folder, by entry name. */
  treeLastCommits(repo: string, ref: string, path: string): Promise<Record<string, LastCommit>>
  /** Ahead/behind of every branch against `base`, by branch name. */
  branchDivergence(repo: string, base: string): Promise<Record<string, Divergence>>
  readBlob(repo: string, ref: string, path: string): Promise<BlobResult>
  getLog(repo: string, opts: LogOptions): Promise<{ commits: CommitSummary[]; hasMore: boolean }>
  countCommits(repo: string, ref: string): Promise<number>
  getCommit(repo: string, sha: string): Promise<CommitDetail>
  compareRefs(repo: string, base: string, head: string): Promise<CompareResult>
  /** Local issues, kept inside the repo (refs/local-issues). */
  listIssues(repo: string, state: IssueState | 'all'): Promise<IssueSummary[]>
  issueCounts(repo: string): Promise<IssueCounts>
  getIssue(repo: string, number: number): Promise<Issue>
  /** onGitHub: also create it on the repo's github.com remote (off unless the user turns it on). */
  createIssue(repo: string, title: string, body: string, onGitHub?: boolean): Promise<Issue>
  /** The repo's github.com remote and whether GitHub is set up. Contacts nobody. */
  githubTarget(repo: string): Promise<GitHubTarget>
  /** The user's repositories on github.com (owned, shared, organizations'). In memory, 10 minutes. */
  githubRepos(force?: boolean): Promise<GitHubRepos>
  /** Clone a repo from that list into a folder the user picks, then open it. Null when cancelled. */
  cloneGitHubRepo(fullName: string): Promise<RepoInfo | null>
  /** Open a repo (or one of its issues) on github.com in the system browser. */
  openOnGitHub(fullName: string, issue?: number): Promise<null>
  updateIssue(repo: string, number: number, edit: IssueEdit): Promise<Issue>
  /** tasks linked to this repo (by folder or github.com remote). */
  linkedTasks(repo: string): Promise<LinkedTask[]>
  /** How many tasks are linked to this repo. Contacts nobody. */
  linkedTaskCount(repo: string): Promise<number>
  /** tasks linked to a repo on github.com. */
  linkedTasksOnGitHub(fullName: string): Promise<LinkedTask[]>
  /** Task counts per repo for the Home lists. Reads Tasks' links file only. */
  linkCounts(): Promise<LinkCounts>
  linkTask(repo: string, source: 'local' | 'jira', key: string): Promise<LinkedTask[]>
  unlinkTask(repo: string, task: Pick<LinkedTask, 'source' | 'key' | 'linkId'>): Promise<LinkedTask[]>
  addIssueComment(repo: string, number: number, body: string): Promise<Issue>
  /** Scheduled backups (git bundles into a folder on this machine). */
  pickBackupFolder(): Promise<string | null>
  getBackup(repo: string): Promise<BackupState>
  saveBackup(repo: string, schedule: BackupSchedule): Promise<BackupState>
  removeBackup(repo: string): Promise<BackupState>
  runBackup(repo: string): Promise<BackupState>
}

const APP_ID = 'github-plus'

/** The backend's error when a folder is not (inside) a git repo; GitHub+ then offers to make it one. */
export const isNotARepoError = (e: unknown): boolean => e instanceof Error && /is not inside a git repository/.test(e.message)

/** Electron wraps errors as "Error invoking remote method '…': Error: msg"; keep just msg. */
async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invokeApp<T>(APP_ID, method, args)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
  }
}

const desktopApi: RepoApi = {
  pickRepoFolder: () => call('pickRepoFolder'),
  openRepo: (dir) => call('openRepo', { dir }),
  previewFolder: (dir) => call('previewFolder', { dir }),
  initRepo: (dir, opts) => call('initRepo', { dir, ...opts }),
  getSettings: () => call('getSettings'),
  saveSettings: (settings) => call('saveSettings', { settings }),
  getRecents: () => call('getRecents'),
  getLinked: () => call('getLinked'),
  getActivity: () => call('getActivity'),
  removeRecent: (path) => call('removeRecent', { path }),
  listRefs: (repo) => call('listRefs', { repo }),
  listTree: (repo, ref, path) => call('listTree', { repo, ref, path }),
  treeLastCommits: (repo, ref, path) => call('treeLastCommits', { repo, ref, path }),
  branchDivergence: (repo, base) => call('branchDivergence', { repo, base }),
  readBlob: (repo, ref, path) => call('readBlob', { repo, ref, path }),
  getLog: (repo, opts) => call('getLog', { repo, opts }),
  countCommits: (repo, ref) => call('countCommits', { repo, ref }),
  getCommit: (repo, sha) => call('getCommit', { repo, sha }),
  compareRefs: (repo, base, head) => call('compareRefs', { repo, base, head }),
  listIssues: (repo, state) => call('listIssues', { repo, state }),
  issueCounts: (repo) => call('issueCounts', { repo }),
  getIssue: (repo, number) => call('getIssue', { repo, number }),
  createIssue: (repo, title, body, onGitHub) => call('createIssue', { repo, title, body, onGitHub: onGitHub === true }),
  githubTarget: (repo) => call('githubTarget', { repo }),
  githubRepos: (force) => call('githubRepos', { force: force === true }),
  cloneGitHubRepo: (fullName) => call('cloneGitHubRepo', { fullName }),
  openOnGitHub: (fullName, issue) => call('openOnGitHub', { fullName, issue }),
  updateIssue: (repo, number, edit) => call('updateIssue', { repo, number, ...edit }),
  linkedTasks: (repo) => call('linkedTasks', { repo }),
  linkedTaskCount: (repo) => call('linkedTaskCount', { repo }),
  linkedTasksOnGitHub: (fullName) => call('linkedTasksOnGitHub', { fullName }),
  linkCounts: () => call('linkCounts'),
  linkTask: (repo, source, key) => call('linkTask', { repo, source, key }),
  unlinkTask: (repo, t) => call('unlinkTask', { repo, source: t.source, key: t.key, linkId: t.linkId }),
  addIssueComment: (repo, number, body) => call('addIssueComment', { repo, number, body }),
  pickBackupFolder: () => call('pickBackupFolder'),
  getBackup: (repo) => call('getBackup', { repo }),
  saveBackup: (repo, schedule) => call('saveBackup', { repo, schedule }),
  removeBackup: (repo) => call('removeBackup', { repo }),
  runBackup: (repo) => call('runBackup', { repo }),
}

/** In the browser dev server there is no backend, so GitHub+ browses a fictional sample repo. */
export const api: RepoApi = isDesktop() ? desktopApi : sampleApi
