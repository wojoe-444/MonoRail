import { invokeApp } from '@/apps/client'
import { isDesktop } from '@/modules/client'

import { createSampleBackend } from './sample'
import type {
  CalendarIssues,
  Comment,
  Connection,
  Issue,
  IssueDetail,
  IssueFields,
  NewIssue,
  Overview,
  ParentRef,
  Project,
  RepoLink,
  Source,
  Worklog,
  TriggerTemplate,
  TriggerTemplateDraft,
} from './types'

const APP_ID = 'jira-plus'

/**
 * The app talks to this interface. In the desktop app it calls the backend in
 * electron/apps/jira-plus; in the browser dev server it uses an in-memory
 * store seeded with fictional sample data, so every screen still works.
 */
export interface JiraApi {
  listTriggerTemplates(args: { source: Source; projectKey: string }): Promise<TriggerTemplate[]>
  saveTriggerTemplate(args: TriggerTemplateDraft): Promise<TriggerTemplate>
  deleteTriggerTemplate(args: { source: Source; projectKey: string; id: string }): Promise<{ ok: true }>
  calendarIssues(args: { start: string; end: string }): Promise<CalendarIssues>
  getOverview(): Promise<Overview>
  listIssues(args: { source: Source | 'all'; projectKey?: string }): Promise<Issue[]>
  getIssue(args: { source: Source; key: string }): Promise<IssueDetail>
  getIssueTypes(args: { source: Source; projectKey: string; subtask?: boolean }): Promise<string[]>
  createIssue(args: NewIssue): Promise<Issue>
  updateIssue(args: { source: Source; key: string; fields: IssueFields }): Promise<Issue>
  transitionIssue(args: { source: Source; key: string; transitionId: string }): Promise<Issue>
  addComment(args: { source: Source; key: string; body: string }): Promise<Comment>
  updateComment(args: { source: Source; key: string; id: string; body: string }): Promise<Comment>
  deleteComment(args: { source: Source; key: string; id: string }): Promise<{ ok: true }>
  deleteIssue(args: { source: Source; key: string }): Promise<{ ok: true }>
  /** Put an issue under another one in the same project, or take it out (parent: null). */
  setParent(args: { source: Source; key: string; parent: string | null }): Promise<Issue>
  /** Issues that can be the parent of `key`, or of a new issue in `projectKey`. */
  parentOptions(args: { source: Source; key?: string; projectKey?: string }): Promise<ParentRef[]>
  /** Log time on a ticket. Team tickets get a real Jira worklog. */
  logWork(args: { source: Source; key: string; seconds: number; started?: string; comment?: string }): Promise<Worklog>
  deleteWorklog(args: { source: Source; key: string; id: string }): Promise<{ ok: true }>
  createLocalProject(args: { key: string; name: string; description?: string }): Promise<Project>
  /** Jira+'s own settings; the account itself comes from the Connections page. */
  saveSettings(args: { scopeJql: string }): Promise<Connection>
  /** Deletes the token Jira+ saved before the Connections page existed. */
  forgetLegacyConnection(): Promise<Connection>
  /** Repos linked to a task. Links live in Jira+'s data folder only. */
  getRepoLinks(args: { source: Source; key: string }): Promise<RepoLink[]>
  /** Link a local repo (path) or a repo on github.com (github: "owner/name"). Returns the task's links. */
  linkRepo(args: { source: Source; key: string; path?: string; github?: string }): Promise<RepoLink[]>
  unlinkRepo(args: { source: Source; key: string; id: string }): Promise<RepoLink[]>
  /** The system folder picker; null when cancelled. */
  pickRepoFolder(): Promise<string | null>
}

function desktopApi(): JiraApi {
  const call =
    <A, R>(method: string) =>
    (args?: A) =>
      invokeApp<R>(APP_ID, method, args)
  return {
    listTriggerTemplates: call('listTriggerTemplates'),
    saveTriggerTemplate: call('saveTriggerTemplate'),
    deleteTriggerTemplate: call('deleteTriggerTemplate'),
    calendarIssues: call('calendarIssues'),
    getOverview: call('getOverview'),
    listIssues: call('listIssues'),
    getIssue: call('getIssue'),
    getIssueTypes: call('getIssueTypes'),
    createIssue: call('createIssue'),
    updateIssue: call('updateIssue'),
    transitionIssue: call('transitionIssue'),
    addComment: call('addComment'),
    updateComment: call('updateComment'),
    deleteComment: call('deleteComment'),
    deleteIssue: call('deleteIssue'),
    setParent: call('setParent'),
    parentOptions: call('parentOptions'),
    logWork: call('logWork'),
    deleteWorklog: call('deleteWorklog'),
    createLocalProject: call('createLocalProject'),
    saveSettings: call('saveSettings'),
    forgetLegacyConnection: call('forgetLegacyConnection'),
    getRepoLinks: call('getRepoLinks'),
    linkRepo: call('linkRepo'),
    unlinkRepo: call('unlinkRepo'),
    pickRepoFolder: call('pickRepoFolder'),
  } as JiraApi
}

let api: JiraApi | undefined
export function jiraApi(): JiraApi {
  if (!api) api = isDesktop() ? desktopApi() : createSampleBackend()
  return api
}

/** Electron wraps backend errors as "Error invoking remote method 'module:invoke': Error: ...". */
export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '')
}
