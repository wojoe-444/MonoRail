---
audience: human, ai
---

# Agent access (MCP server)

MonoRail includes a Model Context Protocol (MCP) server, so Claude Code and other agents can read what MonoRail knows: what your agents cost, your recent agent chats, local issues in GitHub+ and Jira+, and whether your account connections still work. With your OK, per agent, they can also raise and comment on local issues. The agent starts the server itself when it needs it, and MonoRail does not have to be open.

The plain-language version is [let agents use MonoRail](guide/agents/agent-access.md).

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

Every tool returns JSON text. Read tools are always available; write tools need your OK (see [Write tools and consent](#write-tools-and-consent)).

### Read tools

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
| `connection_status` | State and one-line summary of each connection, and when it was checked | Connections' last check, saved after every check. Only connections the user has set up are ever checked; nothing is checked at startup |
| `storage_scan` | Free space per drive and the size of known folders, largest first, with their largest subfolders, the change since the previous scan and advice (safe, review, keep) | Storage's last saved scan (`storage.history`); nothing is measured by the tool |
| `list_flashcard_decks` | Your Flashcards decks: name, card count, what is due today, reviews done today | Flashcards' `decks.json` in the data folder |
| `list_flashcards` | Cards of one deck (front, back, state, next due), optionally searched | Flashcards' `decks.json` |
| `check_coordinator_reply` | The coordinator's reply to an `ask_coordinator` call that was still running | Only turns this same connection started |

Results that come from a cache say when they were built. A repo is named by its folder name or by the full path `list_github_plus_repos` returns. Team Jira Cloud issues are not available through the server.

### Write tools

| Tool | What it does |
| --- | --- |
| `create_github_plus_issue` | Raises a local issue in a GitHub+ repo (title, Markdown body) |
| `comment_github_plus_issue` | Comments on a local issue in a GitHub+ repo |
| `create_jira_plus_issue` | Raises an issue in a local Jira+ project (summary, description, type, priority) |
| `comment_jira_plus_issue` | Comments on a local Jira+ issue |
| `add_flashcards` | Adds up to 200 cards to a Flashcards deck, creating the deck if asked |
| `ask_coordinator` | Sends a message to your [coordinator](#the-coordinator) and waits for its reply |

The issue tools change only local issues: GitHub+ issues are commits on `refs/local-issues` in the repo (never pushed), Jira+ issues are commits in its private local repo.

### The coordinator

The coordinator is the pinned entry on the Chat page, run by MonoRail in its own folder. It works out of the box with MonoRail's built-in coordinator; if you have your own `coordinator` subagent (`~/.claude/agents/coordinator.md`), MonoRail runs that instead. It is a coordinator of coordinators, reachable in both directions.

**It can reach your chats.** Besides delegating to subagents and running workflows, it gets five MonoRail tools:

| Tool | What it does |
| --- | --- |
| `list_chats` | Your Claude Code and pi chats in allowed repos, and the allowed repo names |
| `read_chat` | The latest messages of one chat |
| `send_to_chat` | Runs one turn in a chat, in its own repo, and waits for the reply |
| `start_chat` | Starts a new Claude or pi chat in an allowed repo and waits for the reply |
| `wait_for_reply` | Keeps waiting for a reply that was still running |

- Only chats in the repos you allowed on the Chat page, and never another coordinator chat.
- A chat runs in **Ask** mode (read-only) unless the coordinator asks for **Agent**, which uses that repo's normal Claude Code permission rules. Anything that would need your approval is denied, and nothing ever bypasses permissions.
- A chat whose log changed in the last minute is left alone: it may be open in a terminal.
- A reply still running when the coordinator's own turn ends, or when you press Stop, is stopped with it.
- If your `coordinator.md` has a `tools:` line, it must list these tools (as `mcp__monorail__list_chats` and so on), or drop the line. The Chat page warns when it doesn't.

**Other agents can reach it.** With `ask_coordinator` turned on for an agent, that agent can send the coordinator a message and get its reply. It continues the coordinator's latest chat (or starts one with `newChat`), and the message tells the coordinator which agent sent it. The call waits up to `waitSeconds` (default 300); a longer reply comes back through `check_coordinator_reply`. Turning `ask_coordinator` on lets that agent use everything the coordinator can do, including messaging your chats, so only turn it on for agents you run yourself.

**One turn per chat.** The app, the coordinator and the MCP server share a lock per chat (`turn-locks` in Chat's data folder: a process id and a start time, nothing else). A busy chat refuses a second message, which also stops loops: a chat cannot ask the coordinator while the coordinator waits on it.

All of this runs your own installed Claude Code, signed in as you are in your terminal. MonoRail never sees or stores your Claude sign-in.

### Extension tools

Installed extensions can offer their own tools ([`contributes.mcpTools`](extensions/manifest.md#mcp-tools)). They appear as `<extension>__<tool>`, for example `hello_monorail__list_notes`, and are listed on the Agent access page with the extension's name. Only active extensions take part (turned on, compatible, permissions approved).

- **Every extension tool needs your OK**, per agent, even one the extension marks read-only: MonoRail cannot check that claim.
- **Same sandbox.** The MCP server runs the extension's backend itself, with the permissions you approved and the folders you granted, and its own data folder. Secrets stay in the app: an extension cannot read its stored secrets when called by an agent.
- **After an install or update,** open the extension in MonoRail once before agents can use its tools, so its data is set up by the app.
- The server reads the installed extensions when the agent starts it; restart the agent's MonoRail server to pick up a new extension.

## Write tools and consent

- **Off by default, per agent.** The first time an agent starts the server it appears under **Agents** on the Agent access page, with every write tool off. Turn on exactly the tools you want for that agent. A refused call tells the agent where you can turn it on.
- **Changes apply at once.** The server checks the switch on every call, so turning a tool off stops the next call.
- **The agent's name** is the one its MCP client reports (for example `claude-code`). It identifies the agent program on your machine; it is not a password, so only turn on writes for agents you run yourself.
- **Forget** removes an agent and everything it was allowed; it starts again with nothing allowed if it reconnects.

## Activity log

Every tool call, read or write, is logged on the Agent access page under **Activity**: when, which agent, which tool, whether it worked, how long it took, and for a write a one-line description of what changed (for example *Created issue #7 "Flaky login test" in demo-repo*). Arguments and results are not kept. The log is `audit.jsonl` in MonoRail's data folder (`modules\mcp`), trimmed to the newest 2,000 calls; **Clear** empties it. Who may write what is kept next to it in `access.json`.

## Privacy and safety

- **stdio only.** The agent starts the server as its own subprocess and talks to it over stdin and stdout. No network port is opened, so no other program, website or machine can reach it.
- **Writes need your OK.** MonoRail's read tools change nothing. Its write tools only change local issues or ask your coordinator, and only for an agent you turned them on for. Extension tools need your OK too. Every call is logged.
- **No secrets.** Tokens, API keys and passwords are never returned. Connection status carries the state and summary only, never check details or credentials.
- **Your folders only.** Chats come only from repos you allowed on the Chat page; issues only from repos you opened in GitHub+. An agent cannot pass any other path.
- **Little is stored.** The server reads MonoRail's data folder (the same one the app picks; it never moves one). It keeps only `access.json` (agents and their switches) and `audit.jsonl` (the activity log) in `modules\mcp`. Its stderr lines hold only the tool name, outcome and time.
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
- **A write tool is refused.** Turn it on for that agent under Agents on the Agent access page. If the agent is not listed, start it once so it connects.
- **A tool says there is no report yet.** Open Claude Stats once, or leave MonoRail running: it builds the report in the background.
- **No chats are listed.** Add your Repos folder or a repo on the Chat page (Folders); only chats in allowed repos are listed.
- **Updating MonoRail fails with "Failed to uninstall old application files".** A running agent may be holding the server open. Quit the agent (or remove the server from it), then update again.
