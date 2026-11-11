import type { McpSetup } from './types'

/** Shown in the browser dev server, where there is no backend. Fictional paths. */
export const sampleSetup: McpSetup = {
  packaged: true,
  command: 'C:\\Users\\you\\AppData\\Local\\Programs\\command-hub\\MonoRail.exe',
  args: ['--mcp'],
  env: {},
  dataDir: '%APPDATA%\\MonoRail',
  snippets: {
    claudeCode: 'claude mcp add --scope user monorail -- "C:\\Users\\you\\AppData\\Local\\Programs\\command-hub\\MonoRail.exe" --mcp',
    json: JSON.stringify(
      { mcpServers: { monorail: { command: 'C:\\Users\\you\\AppData\\Local\\Programs\\command-hub\\MonoRail.exe', args: ['--mcp'] } } },
      null,
      2,
    ),
  },
  tools: [
    { name: 'usage_summary', title: 'Agent usage and cost', description: 'API-equivalent spend per day for the last 30 days and the top models.', readOnly: true },
    { name: 'list_chat_sessions', title: 'Recent agent chats', description: 'Recent Claude Code and pi sessions in allowed repos.', readOnly: true },
    { name: 'list_github_plus_repos', title: 'GitHub+ repos', description: 'Repos opened in GitHub+, with local issue counts.', readOnly: true },
    { name: 'list_github_plus_issues', title: 'GitHub+ local issues', description: 'Local issues of one GitHub+ repo.', readOnly: true },
    { name: 'get_github_plus_issue', title: 'GitHub+ local issue', description: 'One local issue with its timeline.', readOnly: true },
    { name: 'list_jira_plus_projects', title: 'Jira+ local projects', description: 'Private local Jira+ projects.', readOnly: true },
    { name: 'list_jira_plus_issues', title: 'Jira+ local issues', description: 'Issues of one local Jira+ project.', readOnly: true },
    { name: 'get_jira_plus_issue', title: 'Jira+ local issue', description: 'One local Jira+ issue with comments and history.', readOnly: true },
    { name: 'connection_status', title: 'Account connections', description: 'Whether each connection still works. No credentials.', readOnly: true },
  ],
}
