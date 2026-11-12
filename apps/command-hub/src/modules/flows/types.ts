import type { MochiRoleId } from '@/components/mochi'
import type { IconComponent } from '@/modules/types'

/**
 * What travels along an edge. A port only connects to a port of the same
 * type (or `any`), and the type decides the edge and handle color.
 */
export type PortType = 'message' | 'text' | 'data' | 'agent' | 'tool' | 'any'

export interface Port {
  id: string
  label: string
  type: PortType
}

export type FieldKind = 'text' | 'textarea' | 'select' | 'number' | 'toggle' | 'code'

/** A setting shown on the node card. With `port`, an edge can feed it instead. */
export interface Field {
  id: string
  label: string
  kind: FieldKind
  value?: string | number | boolean
  options?: string[]
  port?: PortType
  required?: boolean
  hint?: string
}

export type CategoryId = 'io' | 'agents' | 'models' | 'text' | 'tools' | 'control' | 'custom'

export interface Category {
  id: CategoryId
  label: string
  icon: IconComponent
}

/** A component in the palette: the template every node of its kind starts from. */
export interface ComponentDef {
  kind: string
  category: CategoryId
  title: string
  description: string
  icon: IconComponent
  /** Agent-like components show a mochi instead of an icon. */
  mochi?: MochiRoleId
  fields: Field[]
  outputs: Port[]
  /** Runs code on this PC (Python): shown with a lock until the user allows it. */
  runsCode?: boolean
}

export type NodeStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'waiting'

export interface FlowNodeData extends Record<string, unknown> {
  kind: string
  title?: string
  /** For agent nodes: the name the mochi is picked from. */
  agentName?: string
  values: Record<string, string | number | boolean>
  status?: NodeStatus
  /** e.g. "1.4 s · $0.012" after a run. */
  result?: string
}

export interface FlowSummary {
  id: string
  name: string
  description: string
  /** Node kinds in the flow, for the mini preview and the "uses" chips. */
  kinds: string[]
  nodes: number
  updated: number
  runs7d: number
  deployed: ('mcp' | 'api' | 'chat')[]
  usesPython: boolean
  agentName: string
}
