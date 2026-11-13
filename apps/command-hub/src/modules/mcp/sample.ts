import type { McpAccess, McpAuditEntry, McpSetup } from './types'

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
    { name: 'list_flashcard_decks', title: 'Flashcard decks', description: 'Your spaced repetition decks and what is due.', readOnly: true },
    { name: 'add_flashcards', title: 'Add flashcards', description: 'Add cards to a Flashcards deck.', readOnly: false, needsConsent: true },
    { name: 'create_github_plus_issue', title: 'Raise a GitHub+ local issue', description: 'Create a local issue in a GitHub+ repo.', readOnly: false, needsConsent: true },
    { name: 'comment_github_plus_issue', title: 'Comment on a GitHub+ local issue', description: 'Add a comment to a local issue.', readOnly: false, needsConsent: true },
    { name: 'create_jira_plus_issue', title: 'Raise a Jira+ local issue', description: 'Create an issue in a private local Jira+ project.', readOnly: false, needsConsent: true },
    { name: 'comment_jira_plus_issue', title: 'Comment on a Jira+ local issue', description: 'Add a comment to a local Jira+ issue.', readOnly: false, needsConsent: true },
    { name: 'hello_monorail__list_notes', title: 'Hello MonoRail: List notes', description: 'The notes kept by the Hello MonoRail extension.', readOnly: true, needsConsent: true, extension: 'Hello MonoRail' },
  ],
}

/** An ISO time `min` minutes ago, so sample times read naturally. */
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

const writeTools = sampleSetup.tools.filter((t) => t.needsConsent).map(({ name, title, extension }) => ({ name, title, extension }))

export const sampleAccess: McpAccess = {
  writeTools,
  agents: [
    { name: 'claude-code', version: '2.1.0', firstSeen: ago(26 * 60), allow: ['create_github_plus_issue'] },
    { name: 'example-agent', version: '0.4.2', firstSeen: ago(40), allow: [] },
  ],
}

export const sampleAudit: McpAuditEntry[] = [
  { at: ago(3), agent: 'claude-code', tool: 'create_github_plus_issue', write: true, ok: true, ms: 84, did: 'Created issue #7 "Flaky login test" in demo-repo' },
  { at: ago(4), agent: 'claude-code', tool: 'list_github_plus_issues', write: false, ok: true, ms: 41 },
  { at: ago(39), agent: 'example-agent', tool: 'create_jira_plus_issue', write: true, ok: false, ms: 2, error: 'MonoRail has not allowed "example-agent" to use create_jira_plus_issue.' },
  { at: ago(40), agent: 'example-agent', tool: 'usage_summary', write: false, ok: true, ms: 6 },
]
