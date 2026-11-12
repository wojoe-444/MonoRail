import { Bot, Braces, Brain, Layers, MessageSquare, MessageSquareText, Type, TextCursorInput, ArrowRightLeft } from 'lucide-react'

import componentsFile from '../../../electron/modules/flows-components.json'
import type { IconComponent } from '@/modules/types'

import type { Category, ComponentDef, FlowNode, Port, PortType } from './types'

/** The step types, shared with the backend (electron/modules/flows-components.json). */
export const COMPONENTS = componentsFile.components as ComponentDef[]
export const CATEGORIES = componentsFile.categories as Category[]
export const COMPONENT_BY_KIND = new Map(COMPONENTS.map((c) => [c.kind, c]))

export const KIND_ICON: Record<string, IconComponent> = {
  'chat-input': MessageSquare,
  'text-input': TextCursorInput,
  'chat-output': MessageSquareText,
  agent: Bot,
  subagent: Bot,
  model: Brain,
  prompt: Braces,
  combine: Layers,
}

export const CATEGORY_ICON: Record<string, IconComponent> = { io: ArrowRightLeft, agents: Bot, models: Brain, text: Type }

/** Port colors: semantic tokens, so they follow the palette and light/dark. */
export const PORT_COLOR: Record<PortType, string> = {
  message: 'var(--primary)',
  text: 'var(--highlight)',
  data: 'var(--success)',
  any: 'var(--muted-foreground)',
}

export const PORT_LABEL: Record<PortType, string> = { message: 'Message', text: 'Text', data: 'Data', any: 'Anything' }

const VAR_RE = /\{([A-Za-z_][A-Za-z0-9_]{0,40})\}/g

/** A prompt template's {placeholders}, in order, once each (same rule as flows-graph.cjs). */
export function placeholders(template: string): string[] {
  const out: string[] = []
  for (const m of template.matchAll(VAR_RE)) if (!out.includes(m[1])) out.push(m[1])
  return out.slice(0, 20)
}

export function componentFor(kind: string): ComponentDef {
  const c = COMPONENT_BY_KIND.get(kind)
  if (!c) throw new Error(`Unknown step type: ${kind}`)
  return c
}

export function valueOf(node: Pick<FlowNode, 'kind' | 'values'>, field: string): string {
  if (node.values[field] !== undefined) return node.values[field]
  return componentFor(node.kind).fields.find((f) => f.id === field)?.value ?? ''
}

/** Input ports: fields with a port, plus a prompt's placeholders as `var:<name>`. */
export function inputsOf(node: Pick<FlowNode, 'kind' | 'values'>): Port[] {
  const def = componentFor(node.kind)
  const ports: Port[] = def.fields.filter((f) => f.port).map((f) => ({ id: f.id, label: f.label, type: f.port!, required: f.required }))
  if (node.kind === 'prompt') for (const v of placeholders(valueOf(node, 'template'))) ports.push({ id: `var:${v}`, label: v, type: 'any' })
  return ports
}

export function canConnect(from: PortType, to: PortType): boolean {
  if (from === 'any' || to === 'any') return true
  const text: PortType[] = ['message', 'text']
  return from === to || (text.includes(from) && text.includes(to))
}
