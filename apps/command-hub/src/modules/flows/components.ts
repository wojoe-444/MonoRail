import {
  ArrowRightLeft,
  Bot,
  Braces,
  Brain,
  Code2,
  FileSearch,
  GitBranch,
  GitMerge,
  Hand,
  Layers,
  MessageSquare,
  MessageSquareText,
  Repeat,
  Split,
  SquareFunction,
  TextCursorInput,
  Type,
  Workflow,
  Wrench,
} from 'lucide-react'

import type { Category, ComponentDef, PortType } from './types'

export const CATEGORIES: Category[] = [
  { id: 'io', label: 'Input & output', icon: ArrowRightLeft },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'models', label: 'Models', icon: Brain },
  { id: 'text', label: 'Prompts & text', icon: Type },
  { id: 'tools', label: 'MonoRail tools', icon: Wrench },
  { id: 'control', label: 'Flow control', icon: GitBranch },
  { id: 'custom', label: 'Custom code', icon: Code2 },
]

export const MODELS = ['Claude Sonnet 5.5', 'Claude Opus 5.5', 'Claude Haiku 5.5', 'pi: anthropic/claude-sonnet-5-5']

/** Port colors: semantic tokens, so they follow light/dark. */
export const PORT_COLOR: Record<PortType, string> = {
  message: 'var(--primary)',
  text: 'var(--highlight)',
  data: 'var(--success)',
  agent: 'var(--warning)',
  tool: 'var(--warning)',
  any: 'var(--muted-foreground)',
}

export const PORT_LABEL: Record<PortType, string> = {
  message: 'Message',
  text: 'Text',
  data: 'Data',
  agent: 'Agent',
  tool: 'Tool',
  any: 'Anything',
}

export const COMPONENTS: ComponentDef[] = [
  // Input & output
  {
    kind: 'chat-input',
    category: 'io',
    title: 'Chat input',
    description: 'What someone types in the Playground, Chat or an MCP call.',
    icon: MessageSquare,
    fields: [{ id: 'text', label: 'Test message', kind: 'text', value: 'Hello' }],
    outputs: [{ id: 'message', label: 'Message', type: 'message' }],
  },
  {
    kind: 'text-input',
    category: 'io',
    title: 'Text input',
    description: 'A named value the caller fills in, like a repo or a topic.',
    icon: TextCursorInput,
    fields: [
      { id: 'name', label: 'Name', kind: 'text', value: 'topic' },
      { id: 'text', label: 'Default', kind: 'text', value: '' },
    ],
    outputs: [{ id: 'text', label: 'Text', type: 'text' }],
  },
  {
    kind: 'chat-output',
    category: 'io',
    title: 'Chat output',
    description: 'The flow’s answer, shown in the Playground or returned to the caller.',
    icon: MessageSquareText,
    fields: [
      { id: 'input', label: 'Reply', kind: 'text', port: 'any', required: true },
      { id: 'details', label: 'Details for the caller', kind: 'text', port: 'data' },
    ],
    outputs: [],
  },
  // Agents
  {
    kind: 'agent',
    category: 'agents',
    title: 'Agent',
    description: 'A Claude or pi agent that can think in turns and use tools.',
    icon: Bot,
    mochi: 'agent',
    fields: [
      { id: 'model', label: 'Model', kind: 'select', options: MODELS, value: MODELS[0], required: true },
      { id: 'input', label: 'Task', kind: 'text', port: 'message', required: true },
      { id: 'instructions', label: 'Instructions', kind: 'textarea', port: 'text' },
      { id: 'tools', label: 'Tools and helpers', kind: 'text', port: 'tool' },
      { id: 'mode', label: 'Permissions', kind: 'select', options: ['Ask (read only)', 'Agent (normal rules)'], value: 'Ask (read only)' },
    ],
    outputs: [
      { id: 'reply', label: 'Reply', type: 'message' },
      { id: 'as-tool', label: 'Use as helper', type: 'tool' },
    ],
  },
  {
    kind: 'subagent',
    category: 'agents',
    title: 'Subagent from Catalog',
    description: 'One of your Claude Code or pi subagents, as it is in Agents > Catalog.',
    icon: Bot,
    mochi: 'researcher',
    fields: [
      { id: 'subagent', label: 'Subagent', kind: 'select', options: ['researcher', 'code-reviewer', 'storage-detective'], value: 'researcher' },
      { id: 'input', label: 'Task', kind: 'text', port: 'message' },
    ],
    outputs: [
      { id: 'reply', label: 'Reply', type: 'message' },
      { id: 'as-tool', label: 'Use as helper', type: 'tool' },
    ],
  },
  {
    kind: 'flow',
    category: 'agents',
    title: 'Another flow',
    description: 'Runs one of your flows as a single step, with its own inner graph.',
    icon: Workflow,
    fields: [
      { id: 'flow', label: 'Flow', kind: 'select', options: ['Release notes writer', 'Repo health check'], value: 'Release notes writer' },
      { id: 'input', label: 'Input', kind: 'text', port: 'message' },
    ],
    outputs: [
      { id: 'reply', label: 'Result', type: 'message' },
      { id: 'as-tool', label: 'Use as helper', type: 'tool' },
    ],
  },
  // Models
  {
    kind: 'model',
    category: 'models',
    title: 'Model call',
    description: 'One prompt in, one answer out. No tools, no turns.',
    icon: Brain,
    fields: [
      { id: 'model', label: 'Model', kind: 'select', options: MODELS, value: MODELS[2], required: true },
      { id: 'input', label: 'Prompt', kind: 'text', port: 'any', required: true },
      { id: 'format', label: 'Answer as', kind: 'select', options: ['Text', 'JSON (schema)'], value: 'Text' },
    ],
    outputs: [{ id: 'text', label: 'Answer', type: 'text' }],
  },
  // Prompts & text
  {
    kind: 'prompt',
    category: 'text',
    title: 'Prompt template',
    description: 'Text with {placeholders} that edges fill in.',
    icon: Braces,
    fields: [{ id: 'template', label: 'Template', kind: 'textarea', value: 'Review {diff} for {topic}.' }],
    outputs: [{ id: 'text', label: 'Prompt', type: 'text' }],
  },
  {
    kind: 'combine',
    category: 'text',
    title: 'Combine text',
    description: 'Joins several inputs into one, with a separator.',
    icon: Layers,
    fields: [
      { id: 'a', label: 'First', kind: 'text', port: 'any' },
      { id: 'b', label: 'Second', kind: 'text', port: 'any' },
      { id: 'sep', label: 'Separator', kind: 'text', value: '\\n\\n' },
    ],
    outputs: [{ id: 'text', label: 'Text', type: 'text' }],
  },
  // MonoRail tools
  {
    kind: 'repo-files',
    category: 'tools',
    title: 'Read repo files',
    description: 'Read and search files in one of Chat’s allowed repos.',
    icon: FileSearch,
    fields: [{ id: 'repo', label: 'Repo', kind: 'select', options: ['MonoRail', 'KumoSQL'], value: 'MonoRail' }],
    outputs: [{ id: 'tool', label: 'Tool', type: 'tool' }],
  },
  {
    kind: 'monorail-tool',
    category: 'tools',
    title: 'MonoRail data',
    description: 'A read tool from MonoRail’s MCP server: Storage, Jira+, GitHub+, Notes.',
    icon: Wrench,
    fields: [{ id: 'tool', label: 'Tool', kind: 'select', options: ['storage_scan', 'list_jira_local_issues', 'list_github_plus_issues'], value: 'storage_scan' }],
    outputs: [
      { id: 'tool', label: 'Tool', type: 'tool' },
      { id: 'data', label: 'Data', type: 'data' },
    ],
  },
  // Flow control
  {
    kind: 'router',
    category: 'control',
    title: 'Route',
    description: 'Sends the input down one branch, by a rule or by asking a model.',
    icon: Split,
    fields: [
      { id: 'input', label: 'Input', kind: 'text', port: 'any' },
      { id: 'by', label: 'Decide by', kind: 'select', options: ['A model picks', 'Text contains', 'Python'], value: 'A model picks' },
    ],
    outputs: [
      { id: 'a', label: 'Bug', type: 'any' },
      { id: 'b', label: 'Feature', type: 'any' },
      { id: 'else', label: 'Otherwise', type: 'any' },
    ],
  },
  {
    kind: 'parallel',
    category: 'control',
    title: 'Run in parallel',
    description: 'Starts every connected branch at once.',
    icon: GitBranch,
    fields: [{ id: 'input', label: 'Input', kind: 'text', port: 'any' }],
    outputs: [{ id: 'out', label: 'Each branch', type: 'any' }],
  },
  {
    kind: 'merge',
    category: 'control',
    title: 'Wait for all',
    description: 'Waits for every branch, then passes the results on together.',
    icon: GitMerge,
    fields: [{ id: 'inputs', label: 'Branches', kind: 'text', port: 'any' }],
    outputs: [{ id: 'data', label: 'Results', type: 'data' }],
  },
  {
    kind: 'loop',
    category: 'control',
    title: 'Repeat until',
    description: 'Runs a branch again until a check passes, at most N times.',
    icon: Repeat,
    fields: [
      { id: 'input', label: 'Input', kind: 'text', port: 'any' },
      { id: 'max', label: 'At most', kind: 'number', value: 3 },
    ],
    outputs: [
      { id: 'again', label: 'Try again', type: 'any' },
      { id: 'done', label: 'Done', type: 'any' },
    ],
  },
  {
    kind: 'approval',
    category: 'control',
    title: 'Ask me first',
    description: 'Pauses the run until you approve or edit what comes next.',
    icon: Hand,
    fields: [{ id: 'input', label: 'Show me', kind: 'text', port: 'any' }],
    outputs: [{ id: 'ok', label: 'Approved', type: 'any' }],
  },
  // Custom code
  {
    kind: 'python',
    category: 'custom',
    title: 'Python component',
    description: 'Your own Python function, with typed inputs and outputs.',
    icon: SquareFunction,
    runsCode: true,
    fields: [
      { id: 'text', label: 'text', kind: 'text', port: 'text' },
      { id: 'grade', label: 'target_grade', kind: 'number', value: 8 },
    ],
    outputs: [{ id: 'data', label: 'score', type: 'data' }],
  },
]

export const COMPONENT_BY_KIND = new Map(COMPONENTS.map((c) => [c.kind, c]))

export function componentFor(kind: string): ComponentDef {
  const c = COMPONENT_BY_KIND.get(kind)
  if (!c) throw new Error(`Unknown component: ${kind}`)
  return c
}
