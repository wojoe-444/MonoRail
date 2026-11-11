import { invokeApp } from '../client'
import { isDesktop } from '@/modules/client'

import { sampleApi } from './sample'
import type { BackupSchedule, BackupState, BlobResult, FolderPreview, GitHubPlusSettings, Issue, IssueCounts, IssueEdit, IssueState, IssueSummary, InitOptions, RepoActivity, CommitDetail, CommitSummary, Divergence, LastCommit, CompareResult, LogOptions, RefInfo, RepoInfo, TreeEntry } from './types'

/** Everything GitHub+ asks of its backend (electron/apps/github-plus). Every call stays on this machine. */
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
  /** Home dashboard: activity across the recently opened repos. */
  getActivity(): Promise<RepoActivity[]>
  removeRecent(path: string): Promise<string[]>
  /** Show the repo's folder in File Explorer (an opened or recent repo only). */
  openInExplorer(path: string): Promise<null>
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
  createIssue(repo: string, title: string, body: string): Promise<Issue>
  updateIssue(repo: string, number: number, edit: IssueEdit): Promise<Issue>
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
  getActivity: () => call('getActivity'),
  removeRecent: (path) => call('removeRecent', { path }),
  openInExplorer: (path) => call('openInExplorer', { path }),
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
  createIssue: (repo, title, body) => call('createIssue', { repo, title, body }),
  updateIssue: (repo, number, edit) => call('updateIssue', { repo, number, ...edit }),
  addIssueComment: (repo, number, body) => call('addIssueComment', { repo, number, body }),
  pickBackupFolder: () => call('pickBackupFolder'),
  getBackup: (repo) => call('getBackup', { repo }),
  saveBackup: (repo, schedule) => call('saveBackup', { repo, schedule }),
  removeBackup: (repo) => call('removeBackup', { repo }),
  runBackup: (repo) => call('runBackup', { repo }),
}

/** In the browser dev server there is no backend, so GitHub+ browses a fictional sample repo. */
export const api: RepoApi = isDesktop() ? desktopApi : sampleApi
