---
audience: human
summary: Build an agent visually as connected steps on a canvas, test it in the Playground, and restore earlier versions.
---

# Build a flow

A **flow** (**Bots > Flows**) is a visual graph of connected steps — combine
multiple [agents](../glossary.md#agent), [subagents](../glossary.md#subagent)
from your [Template Catalog](catalog.md), and prompt templates without writing
code.

## Start one

Pick a starter template (*Basic prompt*, *Agent in a repo*, *Draft and review*,
*Two takes side by side*) or **New flow**. Choose a **Repo** in the top bar for
agent steps to work in (uses Chat's
[allowed folders](chat.md#which-chats-are-listed)).

## Add and connect steps

Drag steps from the left palette onto the canvas:

| Step | Purpose |
| --- | --- |
| **Chat input** | Text you type in the Playground |
| **Text input** | Fixed text (rules, context, topic) |
| **Agent** | Claude or pi running in the flow's repo (**Ask** or **Agent** mode) |
| **Subagent from Catalog** | A subagent from [Template Catalog](catalog.md) |
| **Model call** | Single prompt-response call, no tools |
| **Prompt template** | Text with `{placeholders}` — each creates an input handle |
| **Combine text** | Joins two text inputs |
| **Chat output** | Final response shown in Playground |

Drag from a right-side output dot to a left-side input dot. Independent branches
run in parallel. Double-click a step's title to rename it; select any step or
wire and press **Delete** (or click its × / right-click menu) to remove or
duplicate it.

## Try it in the Playground

Send a prompt in the right-hand **Playground**. Active steps highlight while
running and report duration, cost and tool calls; **Logs** below records every
step's output preview. **Stop** halts the run and all active agents.

Agent, subagent and model steps run as normal [Chat](chat.md) turns — they obey
the same permissions, appear in Chat, and count toward your
[spending limit](../setup/spending-limit.md) and [Claude Stats](spend.md).

## Versions

Edits auto-save and commit as a version after one quiet minute or when leaving
the flow. Open **Versions** to inspect or **Bring this version back** without
erasing newer versions.

## Where flows are kept

Stored in a local git repo inside your [data folder](../glossary.md#data-folder)
(never pushed), included in [backups](../setup/backups-and-updates.md). Run
outputs stay in memory only; afterward only timing, status and cost remain
([private data stays local](../private-data.md)).

## Related

- [The Coordinator](coordinator.md) · [Create an agent](create-an-agent.md) ·
  [Flows reference](../../flows.md) (for developers)
