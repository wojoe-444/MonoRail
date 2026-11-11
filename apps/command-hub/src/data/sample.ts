/**
 * Placeholder data for the home page while agent loading is not wired up.
 * Everything here is fictional and safe to commit. Real agent definitions
 * live in the repo's /agents folder; real user data lives in local AppData.
 */

export type AgentStatus = 'running' | 'idle' | 'attention' | 'paused'

export interface AgentSummary {
  id: string
  name: string
  description: string
  status: AgentStatus
  lastRun: string
  successRate: number
}

export interface ActivityItem {
  id: string
  agent: string
  message: string
  time: string
  tone: 'success' | 'warning' | 'info' | 'destructive'
}

export const sampleAgents: AgentSummary[] = [
  {
    id: 'triage',
    name: 'Issue Triage',
    description: 'Labels and routes new GitHub issues',
    status: 'running',
    lastRun: '2 min ago',
    successRate: 98,
  },
  {
    id: 'release-notes',
    name: 'Release Notes',
    description: 'Drafts changelogs from merged PRs',
    status: 'idle',
    lastRun: '3 h ago',
    successRate: 100,
  },
  {
    id: 'inbox',
    name: 'Inbox Digest',
    description: 'Summarizes unread mail every morning',
    status: 'attention',
    lastRun: '9 h ago',
    successRate: 82,
  },
  {
    id: 'deps',
    name: 'Dependency Watch',
    description: 'Flags outdated or vulnerable packages',
    status: 'paused',
    lastRun: '2 d ago',
    successRate: 94,
  },
]

export const sampleActivity: ActivityItem[] = [
  { id: 'a1', agent: 'Issue Triage', message: 'Labeled 4 new issues', time: '2 min ago', tone: 'success' },
  { id: 'a2', agent: 'Inbox Digest', message: 'Sign-in expired, needs reconnect', time: '9 h ago', tone: 'destructive' },
  { id: 'a3', agent: 'Release Notes', message: 'Drafted notes for v0.4.0', time: '3 h ago', tone: 'info' },
  { id: 'a4', agent: 'Dependency Watch', message: 'Paused by you', time: '2 d ago', tone: 'warning' },
]
