import { invokeApp } from '../client'
import { isDesktop } from '@/modules/client'

import { sampleApi } from './sample'
import type { BackupSchedule, BackupState, BlobResult, CommitDetail, CommitSummary, CompareResult, LogOptions, RefInfo, RepoInfo, TreeEntry } from './types'

/** Everything GitHub+ asks of its backend (electron/apps/github-plus). Every call stays on this machine. */
export interface RepoApi {
  pickRepoFolder(): Promise<string | null>
  openRepo(dir: string): Promise<RepoInfo>
  /** Recently opened repo paths, newest first. Kept in the app's AppData folder. */
  getRecents(): Promise<string[]>
  removeRecent(path: string): Promise<string[]>
  listRefs(repo: string): Promise<RefInfo[]>
  listTree(repo: string, ref: string, path: string): Promise<TreeEntry[]>
  readBlob(repo: string, ref: string, path: string): Promise<BlobResult>
  getLog(repo: string, opts: LogOptions): Promise<{ commits: CommitSummary[]; hasMore: boolean }>
  countCommits(repo: string, ref: string): Promise<number>
  getCommit(repo: string, sha: string): Promise<CommitDetail>
  compareRefs(repo: string, base: string, head: string): Promise<CompareResult>
  /** Scheduled backups (git bundles into a folder on this machine). */
  pickBackupFolder(): Promise<string | null>
  getBackup(repo: string): Promise<BackupState>
  saveBackup(repo: string, schedule: BackupSchedule): Promise<BackupState>
  removeBackup(repo: string): Promise<BackupState>
  runBackup(repo: string): Promise<BackupState>
}

const APP_ID = 'github-plus'

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
  getRecents: () => call('getRecents'),
  removeRecent: (path) => call('removeRecent', { path }),
  listRefs: (repo) => call('listRefs', { repo }),
  listTree: (repo, ref, path) => call('listTree', { repo, ref, path }),
  readBlob: (repo, ref, path) => call('readBlob', { repo, ref, path }),
  getLog: (repo, opts) => call('getLog', { repo, opts }),
  countCommits: (repo, ref) => call('countCommits', { repo, ref }),
  getCommit: (repo, sha) => call('getCommit', { repo, sha }),
  compareRefs: (repo, base, head) => call('compareRefs', { repo, base, head }),
  pickBackupFolder: () => call('pickBackupFolder'),
  getBackup: (repo) => call('getBackup', { repo }),
  saveBackup: (repo, schedule) => call('saveBackup', { repo, schedule }),
  removeBackup: (repo) => call('removeBackup', { repo }),
  runBackup: (repo) => call('runBackup', { repo }),
}

/** In the browser dev server there is no backend, so GitHub+ browses a fictional sample repo. */
export const api: RepoApi = isDesktop() ? desktopApi : sampleApi
