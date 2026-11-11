# Agent access (MCP server)

MonoRail includes a Model Context Protocol (MCP) server, so Claude Code and other agents can read what MonoRail knows: what your agents cost, your recent agent chats, local issues in GitHub+ and Jira+, and whether your account connections still work. The agent starts the server itself when it needs it, and MonoRail does not have to be open.

Open **Configure > Agent access** in MonoRail for a ready-to-copy command with the right path for your machine.

## Connect an agent

The server is the MonoRail program started with `--mcp`. For the installed app on Windows:

```
"%LOCALAPPDATA%\Programs\command-hub\MonoRail.exe" --mcp
```

(The install folder is still called `command-hub` from the app's old name.)

**Claude Code**, once, in any terminal:

```
claude mcp add --scope user monorail -- "C:\Users\<you>\AppData\Local\Programs\command-hub\MonoRail.exe" --mcp
```

`--scope user` makes it available in every project. Check it with `claude mcp list`, or `/mcp` inside Claude Code.

**Agents with a JSON config** (Claude Desktop, Cursor, a project `.mcp.json`, and most others):

```json
{
  "mcpServers": {
    "monorail": {
      "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\command-hub\\MonoRail.exe",
      "args": ["--mcp"]
    }
  }
}
```

**pi** has no built-in MCP support; it can use the server through an MCP adapter extension, with the same command and arguments.

## Tools

Every tool is read-only and returns JSON text.

| Tool | What it returns | Where it comes from |
| --- | --- | --- |
| `usage_summary` | API-equivalent cost per day for up to 30 days, the total, top models | Claude Stats' summary file, written after each report build (every 15 minutes while MonoRail runs) |
| `list_chat_sessions` | Recent Claude Code and pi sessions: id, title, repo, branch, model, times, spend, flags | The Chat page's list: logs read in place, only in repos allowed on the Chat page |
| `list_github_plus_repos` | Repos opened in GitHub+, with open and closed local issue counts | GitHub+'s recent repos |
| `list_github_plus_issues` | Local issues of one of those repos | `refs/local-issues` in the repo |
| `get_github_plus_issue` | One local issue with its body and timeline | `refs/local-issues` in the repo |
| `list_jira_plus_projects` | Your private local Jira+ projects | Jira+'s local repo in the data folder |
| `list_jira_plus_issues` | Issues of one local project, optionally by status category | Jira+'s local repo |
| `get_jira_plus_issue` | One local issue with comments and history | Jira+'s local repo |
| `connection_status` | State and one-line summary of each connection, and when it was checked | Connections' last check, saved after every check and once at startup |

Results that come from a cache say when they were built. A repo is named by its folder name or by the full path `list_github_plus_repos` returns. Team Jira Cloud issues are not available through the server.

## Privacy and safety

- **stdio only.** The agent starts the server as its own subprocess and talks to it over stdin and stdout. No network port is opened, so no other program, website or machine can reach it.
- **Read-only.** No tool writes a file, changes an issue or starts a chat. Write tools will come later, off by default, with per-agent consent and a log.
- **No secrets.** Tokens, API keys and passwords are never returned. Connection status carries the state and summary only, never check details or credentials.
- **Your folders only.** Chats come only from repos you allowed on the Chat page; issues only from repos you opened in GitHub+. An agent cannot pass any other path.
- **Nothing new is stored.** The server reads MonoRail's data folder (the same one the app picks; it never moves or creates one) and keeps no files of its own. Its log lines go to the agent's stderr and hold only the tool name, outcome and time.
- **What the agent does with results** is up to the agent: tool results go into its conversation like anything else it reads.

## How it runs

`MonoRail.exe --mcp` opens no window. It starts `electron/mcp/server.cjs` in Node mode (`ELECTRON_RUN_AS_NODE`, the same way Chat's worker runs), hands it stdin, stdout and stderr, and exits when it ends. The server speaks MCP (protocol versions 2025-06-18, 2025-03-26 and 2024-11-05) with newline-delimited JSON-RPC, and offers tools only.

If `--mcp` misbehaves on your machine, the server can be started directly, with the same result:

```
command: C:\Users\<you>\AppData\Local\Programs\command-hub\MonoRail.exe
args:    C:\Users\<you>\AppData\Local\Programs\command-hub\resources\app.asar\electron\mcp\server.cjs
env:     ELECTRON_RUN_AS_NODE=1
```

In a development checkout, `node electron/mcp/server.cjs --data-dir <folder>` serves any data folder, and the Agent access page of a development build shows a command for its own data folder.

## Troubleshooting

- **The agent says the server failed to start.** Check the path to `MonoRail.exe`; the Agent access page shows the exact one.
- **A tool says there is no report yet.** Open Claude Stats once, or leave MonoRail running: it builds the report in the background.
- **No chats are listed.** Add your Repos folder or a repo on the Chat page (Folders); only chats in allowed repos are listed.
- **Updating MonoRail fails with "Failed to uninstall old application files".** A running agent may be holding the server open. Quit the agent (or remove the server from it), then update again.
