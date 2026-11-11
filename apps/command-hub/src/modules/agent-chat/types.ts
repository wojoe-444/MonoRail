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
  /** What the chat has cost so far, when it can be read. */
  total?: ChatTotal
  /** Changed since it was last seen here, or marked unread. */
  unread?: boolean
  archived?: boolean
  /** Run by a script, a scheduled task or another app, not started from this page. */
  scheduled?: boolean
  /** A coordinator chat (runs in the module's own folder, listed apart). */
  coordinator?: boolean
}

/**
 * A chat's spend. `complete` is false whenever the figure may be short:
 * too-big = the log is past the read limit, no-record = no cost record for
 * this Claude chat, stale = turns ran elsewhere after the last record.
 */
export interface ChatTotal {
  usd?: number
  complete: boolean
  reason?: 'too-big' | 'no-record' | 'stale'
}

/** One model call: its tokens, and its cost when the log has one. */
export interface CallUsage {
  model?: string
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
  costUsd?: number
  ts?: number
  subagent?: boolean
}

export interface SessionList {
  sources: { id: SessionSource; label: string; found: boolean }[]
  sessions: SessionSummary[]
  limits: { scanned: number; totalLogs: number; kept: number; dropped: number; outsideAllowed: number; hiddenFolders?: { path: string; count: number; gitRepo?: boolean }[] }
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
  /** A tool call nobody could approve (Denied) or that the rules refused (Blocked). Live turns only. */
  | { type: 'denied'; kind: 'Denied' | 'Blocked'; tool: string; summary?: string; reason: string }

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  ts?: number
  model?: string
  blocks: ChatBlock[]
  /** Assistant messages: the model call that produced it. */
  usage?: CallUsage
}

export interface SessionTranscript {
  id: string
  messages: ChatMessage[]
  /** Set when the history was cut to the read limits. */
  truncated?: { bytes: boolean; messages: number }
  /** Claude subagent model calls, placed in replies by time. */
  subagentCalls?: CallUsage[]
  total?: ChatTotal
}

export type ChatView = 'plain' | 'detailed'

export const SOURCE_LABEL: Record<SessionSource, string> = { claude: 'Claude Code', pi: 'pi' }

// ---------------------------------------------------------------------------
// Live turns (electron/modules/agent-chat-turns.cjs and agent-chat-worker.mjs)

export type ChatMode = 'ask' | 'agent'

export interface ComposerInfo {
  sdks: { id: SessionSource; label: string; ready: boolean; reason?: string }[]
  models: { id: string; label: string }[]
  piModels: { id: string; label: string }[]
  /** The coordinator entry: greyed out with the reason when it cannot run. */
  coordinator?: { ready: boolean; reason?: string }
  efforts: string[]
  repos: { name: string; path: string }[]
}

export type TurnEvent =
  | { t: 'init'; sessionId: string; model?: string }
  | { t: 'message_start'; id?: string }
  | { t: 'delta'; text: string }
  | { t: 'assistant'; id?: string; model?: string; blocks: ChatBlock[] }
  | { t: 'tool_result'; toolUseId: string; result: string; isError: boolean }
  | { t: 'denied'; kind: 'Denied' | 'Blocked'; tool: string; toolUseId?: string; summary?: string; reason: string }
  | { t: 'usage'; id?: string; subagent?: boolean; model?: string; input: number; cacheRead: number; cacheWrite: number; output: number; costUsd?: number }
  | { t: 'result'; subtype: string; isError: boolean; costUsd?: number; durationMs?: number; numTurns?: number; contextWindow?: number; errors?: string[] }
  | { t: 'cost'; turnUsd?: number; sessionUsd?: number; exact: boolean }
  | { t: 'error'; message: string }
  | { t: 'stopped' }

export type TurnStatus = 'running' | 'done' | 'failed' | 'stopped' | 'timed_out'

export interface TurnPoll {
  status: TurnStatus
  sessionId?: string
  startedAt: number
  endedAt?: number
  events: TurnEvent[]
  next: number
  /** For a new chat: the project it runs in. */
  repo?: { name: string; path: string }
}

export interface LiveTurn {
  turnId: string
  /** The chat this turn belongs to: a session id ("claude:…"), or the draft key of a new chat. */
  chatKey: string
  sdk: SessionSource
  sessionId?: string
  prompt: string
  startedAt: number
  endedAt?: number
  status: TurnStatus
  events: TurnEvent[]
  next: number
  /** For a new chat: the project it runs in. */
  repo?: { name: string; path: string }
}
