/** Where a project lives: the team's Jira Cloud site, or the local git repo in AppData. */
export type Source = 'jira' | 'local'
export type StatusCategory = 'todo' | 'in_progress' | 'done'

export interface Project {
  key: string
  name: string
  source: Source
  description?: string
  /** Jira only: link to the project in Jira. */
  url?: string
  issueCount: number
  openCount: number
}

export interface Issue {
  key: string
  source: Source
  projectKey: string
  projectName?: string
  summary: string
  description?: string
  type: string
  priority: string
  status: string
  statusCategory: StatusCategory
  assignee?: string
  reporter?: string
  labels: string[]
  created: string
  updated: string
  commentCount: number
  /** The issue this one sits under (an epic, story or task in the same project). */
  parent?: ParentRef
  /** Time logged on this issue itself, in seconds. */
  timeSpentSeconds?: number
  /** Jira only: link to the issue in Jira. */
  url?: string
}

/** A parent or a parent candidate: enough to show it as a chip. */
export interface ParentRef {
  key: string
  summary?: string
  type?: string
  status?: string
  statusCategory?: StatusCategory
  /** Local only: the parent's file is gone. */
  missing?: boolean
}

/** One "Log time" entry. Local ones live in the ticket's file; team ones are Jira worklogs. */
export interface Worklog {
  id: string
  author: string
  /** When the work started (ISO). */
  started: string
  seconds: number
  comment: string
  created?: string
}

export interface Comment {
  id: string
  author: string
  body: string
  created: string
}

export interface HistoryEntry {
  /** Local only: the git commit id. */
  id: string
  at: string
  text: string
}

export interface Transition {
  id: string
  name: string
  toStatus: string
  toCategory: StatusCategory
}

export interface IssueDetail extends Issue {
  description: string
  comments: Comment[]
  history: HistoryEntry[]
  transitions: Transition[]
  worklogs: Worklog[]
  /** Issues directly under this one. */
  children: Issue[]
  timeTracking: {
    /** Logged on this issue. */
    spentSeconds: number
    /** This issue plus everything under it. */
    totalSeconds: number
  }
}

export interface Connection {
  connected: boolean
  siteUrl?: string
  email?: string
  displayName?: string
  scopeJql: string
  /** Where the credentials come from: the hub's Connections page, or a token Jira+ saved before that existed. */
  via?: 'connections' | 'legacy'
  error?: string
}

export interface Overview {
  connection: Connection
  projects: Project[]
  local: {
    statuses: { name: string; category: StatusCategory }[]
    types: string[]
    priorities: string[]
    repoDir: string
  }
}

export interface IssueFields {
  summary?: string
  description?: string
  type?: string
  priority?: string
  labels?: string[]
}

export interface NewIssue extends IssueFields {
  source: Source
  projectKey: string
  summary: string
  status?: string
  parent?: string
}

/** Selected scope in the project list. */
export type Scope = { kind: 'all' } | { kind: 'project'; source: Source; key: string }

/** A repository linked to a task (stored in Jira+'s data folder only, never in Jira or GitHub). */
export interface RepoLink {
  /** Identifies the repo within the task's links (for unlinking). */
  id: string
  repo: {
    /** local: a git repo on this computer; github: a repo on github.com that is not cloned here. */
    kind: 'local' | 'github'
    path?: string
    /** "owner/name" on github.com (for a local repo: its github.com remote, if any). */
    github?: string | null
    name: string
  }
  linkedAt: string
}
