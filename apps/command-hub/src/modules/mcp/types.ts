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
