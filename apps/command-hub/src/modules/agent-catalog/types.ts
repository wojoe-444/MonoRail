/** Shapes returned by electron/modules/agent-catalog.cjs. */

/** Which agent runs it: Claude Code, or pi (through its subagent extension). */
export type SubagentTool = 'claude' | 'pi'

/** One subagent definition (a `.md` file with a frontmatter header). */
export interface Subagent {
  /** Handle handed out by the backend; the page never sees a path. */
  id: string
  tool: SubagentTool
  /** `user` = home folder, `project` = an allowed repo, `builtin` = MonoRail's own (read-only). */
  scope: 'user' | 'project' | 'builtin'
  /** The allowed repo a project subagent lives in. */
  repo?: string
  /** The `name` field: lowercase letters and hyphens. */
  name: string
  description: string
  /** Claude: `sonnet`, `opus`, `haiku`, `inherit` or a model id. pi: a model id. Unset = the chat's model. */
  model?: string
  /** Unset means the default tools (Claude: every tool the chat has). */
  tools?: string[]
  /** Display location, relative to ~ or the repo (e.g. ".claude/agents/reviewer.md"). */
  location: string
  updatedAt: number
  /** Header fields MonoRail does not edit; kept as they are on save. */
  extraFields: string[]
  /** Why the agent would skip this file, if it would. */
  problem?: string
}

export interface SubagentDetail extends Subagent {
  /** The instructions: everything after the header. */
  prompt: string
}

/** What the editor sends to create or update a subagent. */
export interface SubagentDraft {
  name: string
  description: string
  model: string
  /** null = the default tools. */
  tools: string[] | null
  prompt: string
  /** `user`, or the name of an allowed repo. */
  saveTo: string
}

export interface CatalogData {
  generatedAt: number
  subagents: Subagent[]
  truncated: boolean
  repos: { name: string; path: string }[]
  /** pi's subagent extension (or a package named like it) is installed. */
  piExtension: boolean
}
