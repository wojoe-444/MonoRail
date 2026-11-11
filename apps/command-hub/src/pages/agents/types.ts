/** Shapes returned by electron/modules/agents.cjs. */

import type { SessionSource } from '@/modules/agent-chat/types'

export type DefinitionKind = 'subagent' | 'skill'

export interface AgentDefinition {
  /** Handle handed out by the backend; the page never sees a path. */
  id: string
  tool: SessionSource
  kind: DefinitionKind
  scope: 'user' | 'project'
  /** The allowed repo a project definition lives in. */
  repo?: string
  name: string
  description: string
  model?: string
  tools?: string[]
  /** Display location, relative to ~ or the repo (e.g. ".claude/agents/reviewer.md"). */
  location: string
  updatedAt: number
}

export interface DefinitionDetail {
  id: string
  fields: Record<string, string>
  body: string
}

export type SessionState = 'running' | 'active' | 'idle'

export interface RecentSession {
  id: string
  source: SessionSource
  title: string
  repo: string
  branch?: string
  model?: string
  startedAt: number
  updatedAt: number
  state: SessionState
}

export interface AgentsOverview {
  generatedAt: number
  definitions: AgentDefinition[]
  definitionSources: { tool: SessionSource; kind: DefinitionKind; found: boolean }[]
  definitionsTruncated: boolean
  recent: RecentSession[]
  activity: {
    today: number
    week: number
    /** The chat list keeps only the newest chats, so the week count may be low. */
    weekCapped: boolean
    days: { start: number; claude: number; pi: number }[]
    activeNow: number
    runningTurns: number
  }
  repos: { name: string; path: string; sessions: number; lastAt: number; sources: SessionSource[] }[]
  repoCount: number
  sdks: { id: SessionSource; label: string; ready: boolean; reason?: string }[]
  sources: { id: SessionSource; label: string; found: boolean }[]
  folders: { reposRoot: string; reposRootFound: boolean; repoCount: number }
  /** Spend from the Claude Stats summary; null until Claude Stats has built a report. */
  cost: { days: { date: string; cost: number }[]; total: number; builtAt: string; stale: boolean } | null
}
