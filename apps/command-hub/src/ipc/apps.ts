import type { EmailApi } from '@/apps/email/api'
import type { Draft, ListOptions } from '@/apps/email/types'
import type { RepoApi } from '@/apps/github-plus/api'
import type * as Git from '@/apps/github-plus/types'
import type { JiraApi } from '@/apps/jira-plus/api'
import type { Project } from '@/apps/jira-plus/types'
import type { IssuePatch, NewIssue, SaveMap } from '@/apps/tracker/api'
import type { Comment, HistoryEntry, Issue, RemoveType, SaveType, Snapshot, Team } from '@/apps/tracker/types'
import type { Rpc } from './contract'

/** GitHub+ and Email adapt positional feature API parameters to IPC objects. */
type WithResults<Api, Payloads extends Record<keyof Api, unknown>> = {
  [M in keyof Api]: Rpc<Awaited<ReturnType<Extract<Api[M], (...args: never[]) => unknown>>>, Payloads[M]>
}

type Repo = { repo: string }
type Ref = Repo & { ref: string }
type AtPath = Ref & { path: string }
type IssueNumber = Repo & { number: number }
type FullName = { fullName: string }
type Search = { query: string; kinds: Git.SearchKind[]; opts: Git.SearchOptions; channel: string }
type AccountId = { accountId: string }
type Thread = AccountId & { threadId: string }

export type TrackerSave = { [K in SaveType]: { type: K; entity: Partial<SaveMap[K]> } }[SaveType]

export interface AppIpc {
  'github-plus': WithResults<RepoApi, {
    pickRepoFolder: undefined
    openRepo: { dir: string }
    previewFolder: { dir: string }
    initRepo: { dir: string } & Git.InitOptions
    getSettings: undefined
    saveSettings: { settings: Git.GitHubPlusSettings }
    getRecents: undefined
    getLinked: undefined
    getActivity: undefined
    getWorkingStates: undefined
    workingState: Repo
    removeRecent: { path: string }
    openInExplorer: { path: string }
    listRefs: Repo
    listTree: AtPath
    treeLastCommits: AtPath
    branchDivergence: Repo & { base: string }
    readBlob: AtPath
    readWorkingBlob: Repo & { path: string }
    search: Repo & Search
    searchAll: Search
    searchCounts: { queries: string[] }
    lineHistory: AtPath & { line: number }
    getLog: Repo & { opts: Git.LogOptions }
    countCommits: Ref
    getCommit: Repo & { sha: string }
    compareRefs: Repo & { base: string; head: string }
    listIssues: Repo & { state?: Git.IssueState | 'all' }
    issueCounts: Repo
    getIssue: IssueNumber
    createIssue: Repo & { title: string; body?: string; onGitHub?: boolean }
    githubTarget: Repo
    githubRepos: { force?: boolean } | undefined
    cloneGitHubRepo: FullName
    openOnGitHub: FullName & { issue?: number }
    updateIssue: IssueNumber & Git.IssueEdit
    linkedTasks: Repo
    linkedTaskCount: Repo
    linkedTasksOnGitHub: FullName
    linkCounts: undefined
    linkTask: Repo & { source: 'local' | 'jira'; key: string }
    unlinkTask: Repo & Pick<Git.LinkedTask, 'source' | 'key' | 'linkId'>
    addIssueComment: IssueNumber & { body: string }
    pickBackupFolder: undefined
    getBackup: Repo
    saveBackup: Repo & { schedule: Git.BackupSchedule }
    removeBackup: Repo
    runBackup: Repo
  }>
  // Jira's feature API already takes the exact IPC payload as its only parameter.
  'jira-plus': {
    [M in keyof JiraApi]: Rpc<Awaited<ReturnType<JiraApi[M]>>, Parameters<JiraApi[M]>[0]>
  } & {
    updateLocalProject: Rpc<Project, { key: string; name: string; description?: string }>
  }
  email: WithResults<EmailApi, {
    getState: undefined
    saveConnectorConfig: { kind: string; values: Record<string, string>; clearSecrets?: string[] }
    signIn: { kind: string }
    cancelSignIn: undefined
    removeAccount: AccountId
    discover: { kind: string }
    addStores: { kind: string; picks: { key: string; readOnly: boolean }[] }
    updateAccount: AccountId & { readOnly?: boolean; skipFolders?: string[] }
    listFolders: AccountId
    listThreads: AccountId & ListOptions
    searchAccounts: { accountIds: string[] } & Omit<ListOptions, 'folderId' | 'pageToken'>
    getThread: Thread
    modifyThread: Thread & { add: string[]; remove: string[] }
    archive: Thread
    markRead: Thread & { read: boolean }
    createFolder: AccountId & { name: string }
    send: AccountId & { draft: Draft }
  }>
  tracker: {
    snapshot: Rpc<Snapshot>
    createTeam: Rpc<Team, Partial<Team> & { name: string; key: string }>
    updateTeam: Rpc<Team, Partial<Team> & { id: string }>
    createIssue: Rpc<Issue, NewIssue>
    updateIssues: Rpc<Issue[], IssuePatch>
    deleteIssues: Rpc<void, { ids: string[] }>
    restoreIssues: Rpc<void, { ids: string[] }>
    issueDetail: Rpc<{ comments: Comment[]; history: HistoryEntry[] }, { id: string }>
    addProjectUpdate: Rpc<void, { projectId: string; health: string; body: string }>
    scheduleCycles: Rpc<{ created: number; rolledOver: number }, { teamId: string }>
    addExample: Rpc<Snapshot>
    save: Rpc<SaveMap[SaveType], TrackerSave>
    remove: Rpc<void, { type: RemoveType; id: string; moveTo?: string }>
  }
}
