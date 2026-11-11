import { invokeModule, isDesktop } from '@/modules/client'

import { createSampleBackend } from './sample'
import type {
  Comment,
  Connection,
  ConnectionInput,
  Issue,
  IssueDetail,
  IssueFields,
  NewIssue,
  Overview,
  Project,
  Source,
} from './types'

const MODULE_ID = 'jira'

/**
 * The page talks to this interface. In the desktop app it calls the backend in
 * electron/modules/jira.cjs; in the browser dev server it uses an in-memory
 * store seeded with fictional sample data, so every screen still works.
 */
export interface JiraApi {
  getOverview(): Promise<Overview>
  listIssues(args: { source: Source | 'all'; projectKey?: string }): Promise<Issue[]>
  getIssue(args: { source: Source; key: string }): Promise<IssueDetail>
  getIssueTypes(args: { source: Source; projectKey: string }): Promise<string[]>
  createIssue(args: NewIssue): Promise<Issue>
  updateIssue(args: { source: Source; key: string; fields: IssueFields }): Promise<Issue>
  transitionIssue(args: { source: Source; key: string; transitionId: string }): Promise<Issue>
  addComment(args: { source: Source; key: string; body: string }): Promise<Comment>
  deleteIssue(args: { source: Source; key: string }): Promise<{ ok: true }>
  createLocalProject(args: { key: string; name: string; description?: string }): Promise<Project>
  saveConnection(args: ConnectionInput): Promise<Connection>
  disconnect(): Promise<Connection>
}

function desktopApi(): JiraApi {
  const call =
    <A, R>(method: string) =>
    (args?: A) =>
      invokeModule<R>(MODULE_ID, method, args)
  return {
    getOverview: call('getOverview'),
    listIssues: call('listIssues'),
    getIssue: call('getIssue'),
    getIssueTypes: call('getIssueTypes'),
    createIssue: call('createIssue'),
    updateIssue: call('updateIssue'),
    transitionIssue: call('transitionIssue'),
    addComment: call('addComment'),
    deleteIssue: call('deleteIssue'),
    createLocalProject: call('createLocalProject'),
    saveConnection: call('saveConnection'),
    disconnect: call('disconnect'),
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
