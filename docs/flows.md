---
audience: ai
summary: Flows reference: file format, step types, the runner and its safety rules, storage and backups.
---

# Flows

**Agents > Flows** (`flows` module) builds agents as a graph of steps. The
person-facing guide is [Build a flow](guide/agents/flows.md).

## Files

| What | Where |
| --- | --- |
| Page | `src/modules/flows/` (`FlowsPage.tsx`, `FlowEditor.tsx`, `FlowNode.tsx`; canvas is `@xyflow/react`) |
| Step types | `electron/modules/flows-components.json`, shared by page and backend |
| Graph rules | `electron/modules/flows-graph.cjs` (`cleanFlow`, `problems`, `order`, `placeholders`) |
| Storage | `electron/modules/flows-store.cjs` (isomorphic-git, no Electron) |
| Runner | `electron/modules/flows-runner.cjs` |
| Backend | `electron/modules/flows.cjs`; templates in `flows-templates.cjs` |
| Tests | `electron/modules/flows.test.cjs` |

The page uses `layout: 'full'` on its `ModuleDefinition`, so `App.tsx` gives it
the whole body under the top bar instead of the 1536px container.

## Flow format

One JSON file per flow, `repo/flows/<slug>-<6 hex>.json` in the Flows data
folder (profile scope, see [profiles](profiles.md)):

```json
{ "format": 1, "id": "…", "name": "…", "description": "…", "folder": "<allowed repo name>",
  "nodes": [{ "id": "in", "kind": "chat-input", "x": 0, "y": 0, "title": "…", "values": { "text": "…" } }],
  "edges": [{ "id": "e1", "source": "in", "sourceHandle": "message", "target": "out", "targetHandle": "input" }] }
```

`cleanFlow` is applied on every save and read: unknown kinds and repeated ids
are refused, unknown fields dropped, values capped at 100,000 characters,
dangling or mistyped edges dropped, and cycles refused (loops come later).
Prompt placeholders `{name}` become input ports `var:<name>`. Port types are
`message`, `text`, `data` and `any`; message and text connect to each other,
`any` connects to everything.

## Versions

Like [Notes](notes.md): a save writes the file, commits are batched (60 s of
quiet, `flush` when the editor closes, and at the next start). `history` and
`version` read git; restoring is a normal save of the old content. The repo
never gets a remote. It is the global backup item `flows` (bundle), see
[backups](backups.md).

## Runs

`run({ id, input })` runs the **saved** flow (the page saves first). The runner
checks `problems` (a Chat output, required inputs), then starts every step
whose sources are done, at most 4 at once, with a 30-minute limit.

- Text steps (`chat-input`, `text-input`, `prompt`, `combine`, `chat-output`) run in process.
- `agent`, `subagent` and `model` are Chat turns through `agent-chat.cjs`
  `_internal.startTurn` with Chat's data folder, in the flow's repo or the
  step's own (`folder`), resolved against Chat's allowed repos on every run.
  So allowed folders, Ask/Agent, system prompts, `assertNoBypass`, the turn
  lock and the [spending limit](guide/setup/spending-limit.md) all apply; each
  turn is a new chat marked started-here. A subagent step reads the subagent
  through the [Agent Catalog](agent-catalog.md) backend (by its id) and sends
  its instructions plus the task; its `model` line maps to Chat's model ids.
  A model call is an Ask turn told not to use tools.
- A failing step fails the run and stops running turns; `stopRun` stops all.

Runs live in memory for an hour after they end (`pollRun`, `runningRun`); the
page polls every 600 ms. `runs.json` keeps metadata of the newest 200 runs
(flow id, start, duration, outcome, cost, step count), never prompts, replies
or outputs. Both files are declared in `electron/cache/declared.cjs`.

## Planned

Multi-agent helpers, branching and loops, Python components (opt-in, per-code
consent), deploying as an MCP tool or local API, and a Langflow importer come
in later phases.
