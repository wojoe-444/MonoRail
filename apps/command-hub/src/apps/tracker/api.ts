import { invokeApp } from '../client'
import { isDesktop } from '@/modules/client'

import { createSampleBackend } from './sample'
import type { Comment, CustomView, Cycle, HistoryEntry, Initiative, Issue, Label, Member, Milestone, Project, RemoveType, SaveType, Snapshot, Team, WorkflowState } from './types'

type Call = <T>(method: string, args?: unknown) => Promise<T>
let sample: Call | undefined
const call: Call = (method, args) => (isDesktop() ? invokeApp('tracker', method, args) : (sample ??= createSampleBackend())(method, args))

export interface IssuePatch {
  ids: string[]
  patch?: Partial<Issue>
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

export type NewIssue = Partial<Pick<Issue, 'description' | 'stateId' | 'priority' | 'estimate' | 'assigneeId' | 'labelIds' | 'projectId' | 'projectMilestoneId' | 'cycleId' | 'parentId' | 'dueDate' | 'relations' | 'sortOrder'>> & { teamId: string; title: string; triage?: boolean }

interface SaveMap {
  user: Member
  workflowState: WorkflowState
  issueLabel: Label
  project: Project
  projectMilestone: Milestone
  cycle: Cycle
  initiative: Initiative
  customView: CustomView
  comment: Comment
}

/** The Tracker backend (electron/apps/tracker), or the in-memory sample in the browser dev server. */
export const trackerApi = {
  snapshot: () => call<Snapshot>('snapshot'),
  createTeam: (t: Partial<Team> & { name: string; key: string }) => call<Team>('createTeam', t),
  updateTeam: (t: Partial<Team> & { id: string }) => call<Team>('updateTeam', t),
  createIssue: (i: NewIssue) => call<Issue>('createIssue', i),
  updateIssues: (p: IssuePatch) => call<Issue[]>('updateIssues', p),
  deleteIssues: (ids: string[]) => call<void>('deleteIssues', { ids }),
  restoreIssues: (ids: string[]) => call<void>('restoreIssues', { ids }),
  issueDetail: (id: string) => call<{ comments: Comment[]; history: HistoryEntry[] }>('issueDetail', { id }),
  addProjectUpdate: (u: { projectId: string; health: string; body: string }) => call<void>('addProjectUpdate', u),
  scheduleCycles: (teamId: string) => call<{ created: number; rolledOver: number }>('scheduleCycles', { teamId }),
  addExample: () => call<Snapshot>('addExample'),
  save: <K extends SaveType>(type: K, entity: Partial<SaveMap[K]> & Record<string, unknown>) => call<SaveMap[K]>('save', { type, entity }),
  remove: (type: RemoveType, id: string, moveTo?: string) => call<void>('remove', { type, id, moveTo }),
}
