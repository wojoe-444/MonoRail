import type { TrackerSave } from '@/ipc/apps'
import { moduleClient } from '@/modules/client'

import { createSampleBackend } from './sample'
import type { Comment, CustomView, Cycle, Initiative, Issue, Label, Member, Milestone, Project, RemoveType, SaveType, Team, WorkflowState } from './types'

let sample: ReturnType<typeof createSampleBackend> | undefined
const call = moduleClient('app:tracker', (method, args) => (sample ??= createSampleBackend())(method, args))

export interface IssuePatch {
  ids: string[]
  patch?: Partial<Issue>
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

export type NewIssue = Partial<Pick<Issue, 'description' | 'stateId' | 'priority' | 'estimate' | 'assigneeId' | 'labelIds' | 'projectId' | 'projectMilestoneId' | 'cycleId' | 'parentId' | 'dueDate' | 'relations' | 'sortOrder'>> & { teamId: string; title: string; triage?: boolean }

export interface SaveMap {
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
  snapshot: () => call('snapshot'),
  createTeam: (t: Partial<Team> & { name: string; key: string }) => call('createTeam', t),
  updateTeam: (t: Partial<Team> & { id: string }) => call('updateTeam', t),
  createIssue: (i: NewIssue) => call('createIssue', i),
  updateIssues: (p: IssuePatch) => call('updateIssues', p),
  deleteIssues: (ids: string[]) => call('deleteIssues', { ids }),
  restoreIssues: (ids: string[]) => call('restoreIssues', { ids }),
  issueDetail: (id: string) => call('issueDetail', { id }),
  addProjectUpdate: (u: { projectId: string; health: string; body: string }) => call('addProjectUpdate', u),
  scheduleCycles: (teamId: string) => call('scheduleCycles', { teamId }),
  addExample: () => call('addExample'),
  save: <K extends SaveType>(type: K, entity: Partial<SaveMap[K]> & Record<string, unknown>) => call('save', { type, entity } as TrackerSave) as Promise<SaveMap[K]>,
  remove: (type: RemoveType, id: string, moveTo?: string) => call('remove', { type, id, moveTo }),
}
