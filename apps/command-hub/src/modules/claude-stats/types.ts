import type { CacheStatus } from '@/lib/cache'

/** Raw ccusage JSON (v20, `ccusage claude <report> --json --breakdown`). */
export interface CcusageModelBreakdown {
  modelName: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cost: number
}

export interface CcusageDailyRow {
  date: string // YYYY-MM-DD
  project?: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  totalCost: number
  modelsUsed: string[]
  modelBreakdowns: CcusageModelBreakdown[]
}

export interface CcusageSessionRow {
  sessionId: string
  projectPath: string
  firstActivity?: string
  lastActivity: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  totalCost: number
  modelsUsed: string[]
  modelBreakdowns: CcusageModelBreakdown[]
}

/** What the backend's getUsage returns. */
export interface UsageReport {
  version: number
  /** Undefined while no report has been built yet (`missing`). */
  generatedAt?: string
  source: 'ccusage' | 'sample'
  /** The last build failed; this is the last good report. */
  stale?: boolean
  error?: string
  /** No report has been built yet (the page never starts a build on open). */
  missing?: boolean
  /** Built time, age, limit, build in progress, last failure and next retry. */
  cache?: CacheStatus
  /** `daily --instances`: rows grouped per project, or a flat `daily` list. */
  daily: { projects?: Record<string, CcusageDailyRow[]>; daily?: CcusageDailyRow[] }
  sessions: { sessions: CcusageSessionRow[] }
  /** Session phases parsed from the raw logs (electron/modules/claude-stats-phases.cjs). */
  partners?: { idleGapMinutes?: number; error?: string; phases: RawPhase[] }
  /** ccusage failed; Claude Code costs then come from the price table. */
  ccusageError?: string
  /** Every source's logs, aggregated (electron/modules/claude-stats-scan.cjs). */
  scan?: ScanReport
  scanError?: string
}

/** The digest summarize() in the backend builds for the Home widget. */
export interface UsageSummary {
  version: number
  generatedAt: string
  days: { date: string; cost: number }[]
  total: number
  topModels: { source: SourceId; model: string; cost: number }[]
}

export type SourceId = 'claude-code' | 'gemini-cli' | 'pi'

export interface ScanSource {
  id: SourceId
  label: string
  /** False when the CLI's log folder does not exist on this machine. */
  found: boolean
  sessions?: number
  error?: string
}

/** Requests grouped by day x session x model x role x context step. */
export interface ScanRequestRow {
  date: string
  source: SourceId
  project: string
  sessionId: string
  model: string
  role: 'driver' | 'subagent'
  /** Context step: prompts in (step*50K, (step+1)*50K]. */
  step: number
  /** Claude Code effort or pi thinking level, when logged. */
  effort?: string | null
  n: number
  input: number
  output: number
  cw5m: number
  cw1h: number
  cacheRead: number
  /** Reasoning tokens (part of output); thinkingEst of them estimated from text (pi). */
  thinking?: number
  thinkingEst?: number
  /** Cost per token type as the tool logged it (pi), summed. */
  logged: { input: number; output: number; cacheWrite: number; cacheRead: number; n: number } | null
}

export interface ScanTurnRow {
  /** Day the segment (session start or compaction) began. */
  date: string
  source: SourceId
  model: string
  kind: 'start' | 'compaction'
  turn: number
  n: number
  promptSum: number
}

export interface ScanCompaction {
  date: string
  source: SourceId
  model: string | null
  trigger: 'auto' | 'manual'
  preTokens: number | null
}

export interface ScanSession {
  source: SourceId
  sessionId: string
  project: string
  first: string
  last: string
}

export interface ScanReport {
  sources: ScanSource[]
  requests: ScanRequestRow[]
  turns: ScanTurnRow[]
  compactions: ScanCompaction[]
  sessions: ScanSession[]
}

export interface RawPhaseFact {
  date: string
  model: string
  role: 'driver' | 'subagent'
  input: number
  output: number
  cacheCreate: number
  cacheRead: number
}

/** One stretch of a session: a driver model plus the models its subagents ran on. */
export interface RawPhase {
  source?: SourceId
  sessionId: string
  project: string
  /** Main-thread model. Undefined when the phase only has subagent traffic. */
  driver?: string
  effort?: string
  start: string
  end: string
  facts: RawPhaseFact[]
}

/** One normalized fact: a day x project x model. Everything aggregates from this. */
export interface UsageFact {
  date: string
  project: string
  /** Display label, e.g. "Opus 4.6". */
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cost: number
  source: SourceId
  rawModel?: string
  sessionId?: string
  role?: 'driver' | 'subagent'
  /** Context step; undefined when only ccusage totals are available. */
  step?: number
  requests?: number
  /** Cost split by token type. */
  parts?: { input: number; output: number; cacheWrite: number; cacheRead: number }
  /** True when `parts` is estimated from list-price ratios rather than logged by the tool. */
  partsEstimated?: boolean
  /** True when the model has a row in the price table. */
  priced?: boolean
  /** Model is above its prompt-size price tier in this step. */
  aboveTier?: boolean
  tierAbove?: number
  effort?: string
  thinkingTokens?: number
  /** Thinking tokens estimated from text rather than logged as a count. */
  thinkingEstimated?: number
}

export interface SessionFact {
  source?: SourceId
  id: string
  project: string
  firstActivity?: string
  lastActivity: string
  models: string[]
  outputTokens: number
  totalTokens: number
  cost: number
  thinkingTokens?: number
  thinkingEstimated?: number
}
