/**
 * Tracker's data as the backend (electron/apps/tracker/model.cjs) sends it.
 * Entity types and fields: docs/standard/monorail/tracker.md.
 */

export type StateType = 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
export type EstimateType = 'notUsed' | 'exponential' | 'fibonacci' | 'linear' | 'tShirt'
export type ProjectStatus = 'backlog' | 'planned' | 'started' | 'paused' | 'completed' | 'canceled'
export type InitiativeStatus = 'planned' | 'active' | 'completed'
export type Health = 'onTrack' | 'atRisk' | 'offTrack'
export type RelationType = 'blocks' | 'related' | 'duplicate'

interface Stored {
  id: string
  name: string
  version: number
  updatedAt: number
}

export interface Team {
  id: string
  key: string
  name: string
  description: string
  color: string
  icon: string
  triageEnabled: boolean
  cyclesEnabled: boolean
  cycleDuration: number
  cycleCooldown: number
  cycleStartDate: string | null
  upcomingCycleCount: number
  cycleAutoRollover: boolean
  estimateType: EstimateType
  allowZeroEstimates: boolean
  defaultStateId: string | null
  issueCount: number
}

export interface Member {
  id: string
  name: string
  email: string
  color: string
  me: boolean
}

export interface WorkflowState extends Stored {
  teamId: string
  type: StateType
  color: string
  position: number
  description: string
}

export interface Label extends Stored {
  teamId: string | null
  parentId: string | null
  isGroup: boolean
  color: string
  description: string
}

export interface Relation {
  type: RelationType
  issueId: string
}

export interface Issue extends Stored {
  number: number
  title: string
  description: string
  teamId: string
  stateId: string
  priority: number
  estimate: number | null
  assigneeId: string | null
  creatorId: string | null
  labelIds: string[]
  projectId: string | null
  projectMilestoneId: string | null
  cycleId: string | null
  parentId: string | null
  dueDate: string | null
  relations: Relation[]
  sortOrder: number
  createdAt: number
  startedAt?: number | null
  completedAt?: number | null
  canceledAt?: number | null
  triagedAt?: number | null
  previousIdentifiers?: string[]
}

export interface Project extends Stored {
  summary: string
  description: string
  icon: string
  color: string
  status: ProjectStatus
  priority: number
  leadId: string | null
  memberIds: string[]
  teamIds: string[]
  startDate: string | null
  targetDate: string | null
  startedAt?: number | null
  completedAt?: number | null
  canceledAt?: number | null
  sortOrder: number
  createdAt: number
}

export interface Milestone extends Stored {
  projectId: string
  description: string
  targetDate: string | null
  sortOrder: number
}

export interface ProjectUpdate extends Stored {
  projectId: string
  health: Health
  body: string
  userId: string
  createdAt: number
}

export interface Cycle extends Stored {
  teamId: string
  number: number
  title: string
  description: string
  startsAt: string
  endsAt: string
  completedAt?: number | null
}

export interface Initiative extends Stored {
  summary: string
  description: string
  icon: string
  color: string
  status: InitiativeStatus
  ownerId: string | null
  targetDate: string | null
  projectIds: string[]
  parentId: string | null
  sortOrder: number
  createdAt: number
}

export type GroupBy = 'status' | 'assignee' | 'priority' | 'project' | 'cycle' | 'label' | 'team' | 'none'
export type OrderBy = 'manual' | 'priority' | 'updated' | 'created' | 'dueDate' | 'title'

export interface Filters {
  stateTypes?: StateType[]
  stateIds?: string[]
  priorities?: number[]
  /** `null` in a list means "not set" (no assignee, no project, ...). */
  assigneeIds?: (string | null)[]
  labelIds?: string[]
  projectIds?: (string | null)[]
  cycleIds?: (string | null)[]
  teamIds?: string[]
  creatorIds?: string[]
  milestoneIds?: (string | null)[]
  due?: 'overdue' | 'week' | 'none' | 'any'
  query?: string
}

export interface Display {
  layout: 'list' | 'board'
  groupBy: GroupBy
  orderBy: OrderBy
  showSubIssues: boolean
  showCompleted: 'all' | 'week' | 'month' | 'none'
  showEmptyGroups: boolean
}

export interface CustomView extends Stored {
  teamId: string | null
  description: string
  icon: string
  color: string
  filters: Filters
  display: Display
  createdAt: number
}

export interface Comment extends Stored {
  issueId: string
  parentId: string | null
  body: string
  userId: string
  createdAt: number
  editedAt: number | null
}

export interface HistoryEntry {
  at: number
  field: string
  from?: unknown
  to?: unknown
}

export interface Snapshot {
  teams: Team[]
  users: Member[]
  states: WorkflowState[]
  labels: Label[]
  issues: Issue[]
  projects: Project[]
  milestones: Milestone[]
  projectUpdates: ProjectUpdate[]
  cycles: Cycle[]
  initiatives: Initiative[]
  views: CustomView[]
  commentCounts: Record<string, number>
  meId: string | null
}

/** The things `save` / `remove` take, by entity type. */
export type SaveType = 'user' | 'workflowState' | 'issueLabel' | 'project' | 'projectMilestone' | 'cycle' | 'initiative' | 'customView' | 'comment'
export type RemoveType = SaveType | 'team' | 'projectUpdate'
