/** Shapes returned by electron/modules/agent-chat.cjs. */

export type SessionSource = 'claude' | 'pi'

export interface SessionSummary {
  /** "<source>:<sessionId>"; the only handle the page passes back. */
  id: string
  source: SessionSource
  sessionId: string
  title: string
  preview: string
  project: string
  cwd?: string
  branch?: string
  model?: string
  startedAt: number
  updatedAt: number
  sizeBytes: number
  /** The allowed repo this chat's folder is in. */
  repo: { name: string; path: string }
}

export interface SessionList {
  sources: { id: SessionSource; label: string; found: boolean }[]
  sessions: SessionSummary[]
  limits: { scanned: number; totalLogs: number; kept: number; dropped: number; outsideAllowed: number }
  folders: { reposRoot: string; reposRootFound: boolean; repoCount: number }
}

export interface AllowedFolders {
  reposRoot: string
  reposRootFound: boolean
  rootIsDefault: boolean
  repos: { path: string; name: string; source: 'root' | 'added' }[]
  /** Repos added in settings, as saved (some may no longer exist). */
  added: string[]
}

export type ChatBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; id?: string; name: string; summary: string; input: string; result?: string; isError?: boolean }

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  ts?: number
  model?: string
  blocks: ChatBlock[]
}

export interface SessionTranscript {
  id: string
  messages: ChatMessage[]
  /** Set when the history was cut to the read limits. */
  truncated?: { bytes: boolean; messages: number }
}

export const SOURCE_LABEL: Record<SessionSource, string> = { claude: 'Claude Code', pi: 'pi' }
