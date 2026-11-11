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
}

export interface SessionList {
  sources: { id: SessionSource; label: string; found: boolean }[]
  sessions: SessionSummary[]
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
}

export const SOURCE_LABEL: Record<SessionSource, string> = { claude: 'Claude Code', pi: 'pi' }
