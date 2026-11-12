---
audience: human
summary: Build an agent as a graph of steps on a canvas, try it in the Playground, and bring back any earlier version.
---

# Build a flow

A **flow** is an agent you draw instead of write: a few steps on a canvas,
joined by lines that carry text from one step to the next. One flow can use
several [agents](../glossary.md#agent) at once, give one a
[subagent](../glossary.md#subagent) from your Catalog, and stitch their
answers together. Open it from **Agents > Flows**.

## Start one

Pick a template on the Flows page (Basic prompt, Agent in a repo, Draft and
review, Two takes side by side) or **New flow** for an empty canvas. A flow
keeps its own name and a **Repo** in the top bar: agent steps work inside that
repo, like a [chat](chat.md). Only the repos Chat may use are offered (see
[which chats are listed](chat.md#which-chats-are-listed)), so add one in Chat's
Folders dialog first if the list is empty.

## Add and connect steps

Drag a step from the list on the left onto the canvas. Each step is a card:

| Step | What it does |
| --- | --- |
| Chat input | What you type in the Playground |
| Text input | A fixed piece of text, like a rule or a topic |
| Agent | A Claude or pi agent working in your repo, in **Ask** (read only) or **Agent** mode |
| Subagent from Catalog | One of your subagents from the [Agent Catalog](../../agent-catalog.md), given a task |
| Model call | One question, one answer, no tools |
| Prompt template | Text with `{placeholders}`; each placeholder gets its own dot to connect |
| Combine text | Joins two pieces of text |
| Chat output | The flow's answer |

Drag from a dot on the right of a step (what it produces) to a dot on the left
of another (what it needs). A field that receives a line shows "Receiving
input"; otherwise type its value straight into the card. Double-click a step's
name to rename it, and select a step or a line and press Delete to remove it.
Steps that do not depend on each other run at the same time.

## Try it in the Playground

Type a message in the **Playground** on the right. Each step lights up while it
runs and shows its time, cost and tool calls when it is done; **Logs** at the
bottom lists every step with the start of what it produced. **Stop** ends the
run and any agent still working.

Agent, subagent and model steps are ordinary Chat turns: they follow the same
permission rules, appear in [Chat](chat.md) as new chats, and count toward your
[spending limit](../setup/spending-limit.md) and [costs](spend.md).

## Versions

Every change saves on its own. After a quiet minute, or when you leave the
flow, the saved state becomes a version. **Versions** lists them; pick one and
**Bring this version back**. The newer versions stay too, so nothing is lost.

## Where flows are kept

Flows live in a local git repository in MonoRail's
[data folder](../glossary.md#data-folder), never in a repo you push. They are
part of [backups](../setup/backups-and-updates.md) once you set a backup folder.
What a run produced is kept only while MonoRail is open; afterwards only the
time, the outcome and the cost remain. See [private data](../private-data.md).

## Related

- [The Coordinator](coordinator.md), the other way to have agents work together
- [Create an agent](create-an-agent.md), to write the subagents a flow uses
- [Flows reference](../../flows.md), for developers
