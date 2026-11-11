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
  /** Jira only: link to the issue in Jira. */
  url?: string
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
}

/** Selected scope in the project list. */
export type Scope = { kind: 'all' } | { kind: 'project'; source: Source; key: string }
