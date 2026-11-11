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
  version: 1
  generatedAt: string
  source: 'ccusage' | 'sample'
  stale?: boolean
  error?: string
  /** `daily --instances`: rows grouped per project, or a flat `daily` list. */
  daily: { projects?: Record<string, CcusageDailyRow[]>; daily?: CcusageDailyRow[] }
  sessions: { sessions: CcusageSessionRow[] }
  /** Session phases parsed from the raw logs (electron/modules/claude-stats-phases.cjs). */
  partners?: { idleGapMinutes?: number; error?: string; phases: RawPhase[] }
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
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  cost: number
}

export interface SessionFact {
  id: string
  project: string
  firstActivity?: string
  lastActivity: string
  models: string[]
  outputTokens: number
  totalTokens: number
  cost: number
}
