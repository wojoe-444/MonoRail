---
audience: ai
summary: Transcript access, worker permissions, costs, prompts and Coordinator turn handling.
---

# Agent Chat backend

See [Chat](../guide/agents/chat.md), [Coordinator](../guide/agents/coordinator.md),
[Agent usage and catalog](agents.md) and the [developer reference](README.md).

## Transcripts and allowed repositories

`electron/modules/agent-chat.cjs` lists local Claude Code and pi sessions.
Claude logs are under `~/.claude/projects`, `~/.config/claude` or
`CLAUDE_CONFIG_DIR`. pi uses `~/.pi/agent/sessions` or `PI_CODING_AGENT_DIR`.
`agent-chat-transcript.cjs` reads the original logs and follows the branch
ending at pi's last entry. Keep transcripts out of disk caches and address
sessions from the renderer by a backend-issued id.

`agent-chat-folders.cjs` restricts listing, opening and running to repos
directly under the Repos folder (default `~/Repos`) and repos picked in the
system dialog. Resolve real paths, including symlinks and junctions, and
check again on every request. Listing examines up to the 300 newest logs and
keeps 60 chats. A history reads at most the last 4 MB and keeps 300 messages.
The page indicates truncation.

## Turn workers

Claude turns run in a worker process
(`agent-chat-worker.mjs`, run with MonoRail's own executable in
`ELECTRON_RUN_AS_NODE` mode) that drives the Claude Agent SDK against the
user's own installed `claude` executable (the SDK's bundled native binary is
excluded from the installer). The job and prompt go to the worker on stdin,
never argv; `agent-chat-turns.cjs` keeps one turn per chat, kills the whole
process tree on Stop, times out after 30 minutes and logs metadata only
(session id, SDK, model, mode, outcome). The page polls `pollTurn` for events.
Options come from `agent-chat-options.cjs`: **Ask** (default) offers only
Read/Grep/Glob with no MCP servers; **Agent** uses Claude Code's normal
permission rules. Every approval prompt is denied and shown in the thread.
`assertNoBypass()` refuses any options that would bypass permissions, and the
settings overlay disables bypass mode; never weaken either. A continued chat
runs only in its own folder, re-checked against the allowed folders. The
running cost total per session is kept in `costs.json` in the module's data
folder (numbers only) so a resumed turn's own cost can be worked out.

**pi** (`agent-chat-worker-pi.mjs`) runs through the user's own pi coding
agent SDK, found behind the `pi` command (`findPiSdk`: PATH plus the usual
npm/pnpm/bun/Volta/scoop folders, reading the command's shim to find the
package; `@earendil-works/pi-coding-agent`, or `@mariozechner/...` for pi
0.x). MonoRail does not bundle it; the worker handles pi 1.x (`ModelRuntime`)
and 0.x. pi has no approval prompts, so its limits are the tool list and a
path guard: Ask gets read/grep/find/ls, Agent adds edit/write, every tool path
must resolve (real path) inside the chat's repo, the user's pi extensions are
not loaded, and no mode ever gets bash. Effort maps to pi's thinking level
(Max = xhigh). A started chat keeps its SDK; new chats pick one in the
status bar (remembered).

## Spending limit

The [spending limit](../guide/setup/spending-limit.md) (Settings > General card `src/components/spending/SpendingCard.tsx`,
self-contained so it can move; Chat's meter and banner in
`SpendingNotice.tsx`; backend `agent-chat-spending.cjs`): off by default. When on, a daily and/or
monthly USD limit for turns MonoRail runs (Chat, coordinator and its child
turns, `ask_coordinator`), a warning at 50/80/90%, and at the limit either
stop new turns (default; `checkBeforeTurn` in `startTurn`, so every caller is
covered, and "Allow one more turn" lets one through) or only warn. A running
turn is never cut off. Each finished turn's own cost is booked from its
`onFinish` (Claude: the delta against `costs.json`, skipped when unknown; pi:
the logged cost). `spending.json` in Chat's data folder holds settings and
one total per day (numbers only), is written only while the limit is on,
synchronous with a lock file (the coordinator worker and MCP server book
turns too), and a damaged file pauses turns until the user resets it.

## System prompts

The Prompts dialog maintains one prompt per agent (Claude, pi, Coordinator).
`agent-chat-prompts.cjs` keeps them in the data folder’s `system-prompts.json`.
A prompt can append to the built-in prompt (default) or replace it
(the page warns that this drops Claude Code's tool guidance). The main process
reads the file when a turn starts and puts the prompt on the job, never taken
from the page's turn request, so coordinator child turns get it too. Claude
gets the SDK's `systemPrompt` (preset + append, or custom; `snapshot: true`, so
a started chat may keep its first prompt); pi gets the resource loader's
`systemPromptOverride` / `appendSystemPromptOverride` (never the plain options,
which pi reads as a file path), and an older pi that ignores them is refused.
The coordinator can only append (its instructions are `coordinator.md`).
`assertNoBypass` skips the prompt text only; a prompt never changes tools or
permissions.

## Detailed replies and cost

**Plain / Detailed** (status bar, remembered; Plain is the default). Detailed
shows reasoning above the tool rows and, after each reply, one row per model
call (model, cost, input, cache read, cache write, output; subagent calls
counted apart) with the reply's total and call count. Reasoning is only
requested from the SDK in Detailed mode, so Plain replies never have it.
History transcripts carry `usage` per assistant message, and Claude subagent
logs (`<session>/subagents/`) supply subagent calls. A call's cost is the
logged cost when there is one (pi); otherwise the reply's cost is split by
token weight (output 5x input, cache write 1.25x, cache read 0.1x) and marked
as an estimate (`src/modules/agent-chat/cost.ts`). **Totals**: Claude's comes
from the last cost record in `costs.json` (marked incomplete if the log
changed after it), pi's is every paid entry in the file, abandoned branches
included; past the 4 MB read limit only spend since opening is counted, and
the page says so. A total never reads complete when it is not.

## List state and side panels

**List flags** (`agent-chat-state.cjs`, `chat-state.json` in the data folder,
keyed by chat id, flags and times only): unread (the log changed after the
chat was last seen, or marked by hand; an opened unread chat stays unread
until it is left; a reply that finishes while watching counts as seen),
archived, and started-here. Claude chats whose log says they were started
headless (`entrypoint` `sdk-*`) and not from this page are tagged Scheduled.
Scheduled and archived chats are hidden behind toggle buttons; the open chat
always stays listed. Right-click a chat to mark it read/unread or archive it.
`SessionListView.tsx` shows a flat newest-first list with two collapsible
sections. **Working** uses the page's turns and the main process's
`runningChats` ids, polled every five seconds while open. **Settled** shows
read chats idle for two days (`SETTLED_AFTER_MS`). Remember both sections
in `commandHub.chat.listSections`, closed by default.

**Side panels** (page header buttons): **Changes** runs `git status` and
`git diff HEAD` for the chat's folder (`agent-chat-changes.cjs`; read-only,
folder from the main process, external diff/textconv/fsmonitor off, diff cut
at 1 MB). **Browser** shows any http(s) address in a sandboxed iframe, with
"Open in new tab" going to the system browser.

## Coordinator

**Coordinator** (pinned above the chat list): opens the latest coordinator
chat or starts one. It runs the user's `coordinator` subagent
(`~/.claude/agents/coordinator.md`, found by `findCoordinator`) with the
`agent` option, or, when there is none, MonoRail's built-in definition
(`BUILTIN_COORDINATOR`, passed as the SDK's `agents` option; never when the
user has their own), in the module's own `coordinator` folder in its data folder,
with `dontAsk`, built-in tools limited to `Agent` and `Workflow`, and one
MCP server: MonoRail's in-process chat tools (`agent-chat-coordinator.cjs`,
served by the worker as `mcp__monorail__*`: list_chats, read_chat,
send_to_chat, start_chat, wait_for_reply). Those run child turns through
Chat's own `startTurn`, so the allowed folders, Ask/Agent and
`assertNoBypass` all apply; coordinator chats are never targets, a chat whose
log changed in the last minute is refused, and child turns stop when the
coordinator's turn ends. Other agents reach it through the [MCP server](../mcp.md#the-coordinator)'s
`ask_coordinator` write tool (consent per agent, logged). A lock file per
chat (`agent-chat-locks.cjs`, `turn-locks/` in the data folder, pid and time
only) keeps one turn per chat across the app, coordinator workers and the
MCP server, which also breaks loops. `coordinatorToolsNote` warns when the
subagent's own `tools:` line would hide the chat tools. Claude only: pi has
no subagents, so a coordinator job on pi is refused. Its chats are listed
apart, first. The entry is greyed out only when Claude Code is missing.
Subscription logins are fine here: MonoRail drives the user's own unmodified
`claude` executable, signed in through Anthropic's own flow, and never
handles the token.
