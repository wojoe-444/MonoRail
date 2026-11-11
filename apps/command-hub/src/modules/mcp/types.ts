/** One tool of MonoRail's MCP server (electron/mcp/tools.cjs). */
export interface McpTool {
  name: string
  title: string
  description: string
  readOnly: boolean
}

/** What electron/modules/mcp.cjs getSetup returns. */
export interface McpSetup {
  packaged: boolean
  command: string
  args: string[]
  env: Record<string, string>
  dataDir: string
  snippets: { claudeCode: string; json: string }
  tools: McpTool[]
}

/** One agent that has connected to the server (access.json). */
export interface McpAgent {
  name: string
  title?: string
  version?: string
  firstSeen: string
  /** Write tools this agent may use. */
  allow: string[]
}

export interface McpAccess {
  writeTools: { name: string; title: string }[]
  agents: McpAgent[]
}

/** One line of the audit log (audit.jsonl), newest first. */
export interface McpAuditEntry {
  at: string
  agent: string
  tool: string
  write: boolean
  ok: boolean
  ms: number
  error?: string
  did?: string
}
