// Plain-language descriptions of a subagent's header, for the explainer page.

import type { LucideIcon } from 'lucide-react'

import type { SubagentTool } from './types'
import { Bot, FilePen, FolderTree, FilePlus2, FileSearch, FolderSearch, Globe, ListChecks, NotebookPen, Plug, Search, SquareTerminal, TextSearch, Workflow } from 'lucide-react'

export interface ToolInfo {
  label: string
  detail: string
  icon: LucideIcon
  /** read = looks only; write = changes files; run = runs programs or reaches out. */
  power: 'read' | 'write' | 'run'
}

export const TOOL_INFO: Record<string, ToolInfo> = {
  Read: { label: 'Read files', detail: 'Opens files in the repo to look at them.', icon: FileSearch, power: 'read' },
  Grep: { label: 'Search inside files', detail: 'Finds text or patterns across the code.', icon: TextSearch, power: 'read' },
  Glob: { label: 'Find files by name', detail: 'Lists files that match a pattern, like *.test.ts.', icon: FolderSearch, power: 'read' },
  WebSearch: { label: 'Search the web', detail: 'Looks things up online.', icon: Search, power: 'run' },
  WebFetch: { label: 'Open web pages', detail: 'Reads a page at an address.', icon: Globe, power: 'run' },
  TodoWrite: { label: 'Keep a to-do list', detail: 'Tracks its own steps while it works.', icon: ListChecks, power: 'read' },
  Edit: { label: 'Change files', detail: 'Edits existing files in place.', icon: FilePen, power: 'write' },
  Write: { label: 'Create files', detail: 'Writes new files or replaces whole files.', icon: FilePlus2, power: 'write' },
  NotebookEdit: { label: 'Edit notebooks', detail: 'Changes Jupyter notebook cells.', icon: NotebookPen, power: 'write' },
  Bash: { label: 'Run terminal commands', detail: 'Runs programs, tests and scripts on your computer.', icon: SquareTerminal, power: 'run' },
  Agent: { label: 'Start other subagents', detail: 'Hands parts of the job to other subagents.', icon: Bot, power: 'run' },
  Task: { label: 'Start other subagents', detail: 'Hands parts of the job to other subagents.', icon: Bot, power: 'run' },
  Workflow: { label: 'Run workflows', detail: 'Runs multi-step workflows of subagents.', icon: Workflow, power: 'run' },
}

/** pi's built-in tools, by their lowercase names. */
export const PI_TOOL_INFO: Record<string, ToolInfo> = {
  read: TOOL_INFO.Read,
  grep: TOOL_INFO.Grep,
  find: TOOL_INFO.Glob,
  ls: { label: 'List folders', detail: 'Lists what is in a folder.', icon: FolderTree, power: 'read' },
  edit: TOOL_INFO.Edit,
  write: TOOL_INFO.Write,
  bash: TOOL_INFO.Bash,
}

/** Tools offered as checkboxes in the editor, in this order. */
export const EDITOR_TOOLS: Record<SubagentTool, readonly string[]> = {
  claude: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'WebSearch', 'WebFetch', 'TodoWrite', 'Agent'],
  pi: ['read', 'grep', 'find', 'ls', 'edit', 'write', 'bash'],
}

export const TOOL_PRESETS: Record<SubagentTool, { id: string; label: string; detail: string; tools: string[] | null }[]> = {
  claude: [
    { id: 'read', label: 'Look only', detail: 'Reads and searches files. Changes nothing.', tools: ['Read', 'Grep', 'Glob'] },
    { id: 'edit', label: 'Can edit files', detail: 'Also changes and creates files. Runs no commands.', tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write'] },
    { id: 'all', label: 'Everything', detail: 'Every tool the main chat has, including commands.', tools: null },
  ],
  pi: [
    { id: 'read', label: 'Look only', detail: 'Reads, searches and lists files. Changes nothing.', tools: ['read', 'grep', 'find', 'ls'] },
    { id: 'edit', label: 'Can edit files', detail: 'Also changes and creates files. Runs no commands.', tools: ['read', 'grep', 'find', 'ls', 'edit', 'write'] },
    { id: 'all', label: 'pi’s defaults', detail: 'pi’s default tools: read, edit, write and bash.', tools: null },
  ],
}

export function toolInfo(name: string, tool: SubagentTool = 'claude'): ToolInfo {
  if (tool === 'pi' && PI_TOOL_INFO[name]) return PI_TOOL_INFO[name]
  if (tool === 'claude' && TOOL_INFO[name]) return TOOL_INFO[name]
  const mcp = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(name)
  if (mcp) return { label: `${mcp[2].replace(/_/g, ' ')}`, detail: `A tool from the ${mcp[1]} MCP server.`, icon: Plug, power: 'run' }
  return { label: name, detail: 'A tool MonoRail does not know by name.', icon: Plug, power: 'run' }
}

export type Power = 'read' | 'write' | 'run' | 'all'

/** The strongest thing the subagent may do. */
export function powerOf(tools: string[] | undefined, tool: SubagentTool = 'claude'): Power {
  if (!tools) return tool === 'pi' ? 'run' : 'all'
  const ps = tools.map((t) => toolInfo(t, tool).power)
  return ps.includes('run') ? 'run' : ps.includes('write') ? 'write' : 'read'
}

export const POWER_LABEL: Record<Power, { label: string; detail: string; variant: 'success' | 'info' | 'warning' }> = {
  read: { label: 'Look only', detail: 'It can read and search, but cannot change anything.', variant: 'success' },
  write: { label: 'Can edit files', detail: 'It can change files in the repo, but cannot run commands.', variant: 'info' },
  run: { label: 'Can run commands', detail: 'It can run programs or reach the web.', variant: 'warning' },
  all: { label: 'Every tool', detail: 'No tool list, so it gets every tool the chat that calls it has.', variant: 'warning' },
}

/** What it cannot do, from the tools it lacks. */
export function cannotDo(tools: string[] | undefined, tool: SubagentTool = 'claude'): string[] {
  if (!tools) return tool === 'pi' ? ['Go online', 'Hand work to other subagents'] : []
  const has = new Set(tools.map((t) => toolInfo(t, tool).label))
  const out: string[] = []
  if (!has.has('Change files') && !has.has('Create files')) out.push('Change or create files')
  if (!has.has('Run terminal commands')) out.push('Run commands or tests')
  if (tool === 'pi' || (!has.has('Search the web') && !has.has('Open web pages'))) out.push('Go online')
  if (tool === 'pi' || !has.has('Start other subagents')) out.push('Hand work to other subagents')
  return out
}

/** Claude Code's model aliases. pi takes a model id instead (free text). */
export const MODEL_OPTIONS = [
  { id: 'inherit', label: 'Same as the chat', detail: 'Uses whatever model the chat that calls it is using.' },
  { id: 'haiku', label: 'Haiku', detail: 'Fastest and cheapest. Good for simple, well-defined jobs.' },
  { id: 'sonnet', label: 'Sonnet', detail: 'Balanced speed and depth. A good default for most work.' },
  { id: 'opus', label: 'Opus', detail: 'Most capable and slowest. For hard reasoning and big changes.' },
]

export function modelInfo(model?: string): { label: string; detail: string } {
  if (!model || model === 'inherit') return MODEL_OPTIONS[0]
  const m = model.toLowerCase()
  const known = MODEL_OPTIONS.find((o) => o.id === m) ?? MODEL_OPTIONS.find((o) => o.id !== 'inherit' && m.includes(o.id))
  if (known && known.id === m) return known
  return { label: model, detail: known ? `A specific model id. ${known.detail}` : 'A specific model id.' }
}

export const TOOL_LABEL: Record<SubagentTool, string> = { claude: 'Claude Code', pi: 'pi' }

/** "code-reviewer" -> "Code reviewer". */
export function humanName(name: string): string {
  const s = name.replace(/[-_]+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : name
}

/** Subagent names: lowercase letters, digits and hyphens. */
export const NAME_RE = /^[a-z][a-z0-9-]{0,63}$/
