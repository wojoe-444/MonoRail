/** Shapes returned by electron/modules/agent-catalog.cjs. */

/** One Claude Code subagent definition (a `.md` file with a frontmatter header). */
export interface Subagent {
  /** Handle handed out by the backend; the page never sees a path. */
  id: string
  /** `user` = ~/.claude/agents, `project` = <repo>/.claude/agents, `builtin` = MonoRail's own (read-only). */
  scope: 'user' | 'project' | 'builtin'
  /** The allowed repo a project subagent lives in. */
  repo?: string
  /** The `name` field: lowercase letters and hyphens. */
  name: string
  description: string
  /** `sonnet`, `opus`, `haiku`, a full model id, `inherit`, or unset (= inherit). */
  model?: string
  /** Unset means every tool the main chat has. */
  tools?: string[]
  /** Display location, relative to ~ or the repo (e.g. ".claude/agents/reviewer.md"). */
  location: string
  updatedAt: number
  /** Header fields MonoRail does not edit, kept as they are on save. */
  extraFields?: string[]
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
  /** null = every tool. */
  tools: string[] | null
  prompt: string
  /** `user`, or the name of an allowed repo. */
  saveTo: string
}

export interface CatalogData {
  subagents: Subagent[]
  repos: string[]
  generatedAt: number
}
