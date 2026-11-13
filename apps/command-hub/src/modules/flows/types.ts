import type { MochiRoleId } from '@/components/mochi'

/** What travels along an edge (electron/modules/flows-components.json). */
export type PortType = 'message' | 'text' | 'data' | 'any'

export interface Port {
  id: string
  label: string
  type: PortType
  required?: boolean
}

export type FieldKind = 'text' | 'textarea' | 'select'

/** A setting on a step. With `port`, an edge can feed it instead. */
export interface Field {
  id: string
  label: string
  kind: FieldKind
  value?: string
  options?: string[]
  /** Options from the editor's lists instead of fixed ones. */
  optionsFrom?: 'models' | 'repos' | 'subagents'
  port?: PortType
  required?: boolean
  hint?: string
}

export interface Category {
  id: string
  label: string
}

export interface ComponentDef {
  kind: string
  category: string
  title: string
  description: string
  mochi?: MochiRoleId
  fields: Field[]
  outputs: Port[]
}

export interface FlowNode {
  id: string
  kind: string
  x: number
  y: number
  title?: string
  values: Record<string, string>
}

export interface FlowEdge {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface Flow {
  format: 1
  id: string
  name: string
  description: string
  /** One of Chat's allowed repos, by name: where agent steps run by default. */
  folder: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowSummary {
  id: string
  name: string
  description: string
  folder: string
  kinds: string[]
  steps: number
  agentName: string
  updated: number
  runs7d?: number
  running?: boolean
  error?: string
}

export interface FlowList {
  flows: FlowSummary[]
  pending: number
}

export interface FlowDoc {
  flow: Flow
  updated: number
  committed: boolean
}

export interface Template {
  id: string
  title: string
  text: string
}

export interface ModelOption {
  id: string
  label: string
}

export interface EditorOptions {
  repos: { name: string }[]
  subagents: { id: string; name: string; tool: 'claude' | 'pi'; scope: string; repo?: string; description?: string }[]
  models: { claude: ModelOption[]; pi: ModelOption[] }
  sdks: { id: string; ready: boolean; reason?: string }[]
  templates: Template[]
}

export type StepStatus = 'queued' | 'running' | 'done' | 'failed' | 'skipped' | 'stopped'

export interface RunStep {
  nodeId: string
  kind: string
  label: string
  status: StepStatus
  startedAt?: number
  endedAt?: number
  costUsd?: number
  tools: number
  output?: string
  error?: string
}

export interface RunSnapshot {
  id: string
  flowId: string
  status: 'running' | 'done' | 'failed' | 'stopped' | 'timed_out'
  startedAt: number
  endedAt?: number
  reply?: string
  details?: string
  error?: string
  costUsd: number
  steps: RunStep[]
}

export interface Version {
  oid: string
  message: string
  time: number
}
