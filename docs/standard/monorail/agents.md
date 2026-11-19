---
audience: human, ai
summary: MonoRail's own entity types for agents: subagents and flows.
---

# Agents

Entity types of MonoRail's own for working with agents. OpenMetadata has no
words for these, so the [MonoRail standard](../README.md) defines them in its
style (see the [rules](../README.md#rules)). All of them are listed on
[Explore](../../guide/data/explore.md) under **Agents**.

<!-- standard:entities agents -->

| Entity | Type | What it is | In MonoRail |
| --- | --- | --- | --- |
| [Subagent](agents.md#subagent) | `subagent` | A helper agent defined in a Markdown file with a header, for Claude Code or pi. | Agents > Catalog |
| [Flow](agents.md#flow) | `flow` | A saved chain of agent steps that runs in one of Chat's allowed repos. | Agents > Flows |

<!-- /standard -->

## Subagent

A helper agent defined in a Markdown file with a header, for Claude Code or
pi. MonoRail reads them from the home folder and Chat's allowed repos, plus its
built-ins ([Template Catalog](../../guide/agents/catalog.md#where-subagents-come-from);
how to write one: [Create an agent](../../guide/agents/create-an-agent.md)).

<!-- standard:fields subagent -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Handle the backend hands out; never a path. |
| `tool` | `enum` | Yes | `claude` or `pi`: the agent that reads the file. |
| `scope` | `enum` | Yes | `user` (home folder), `project` (an allowed repo) or `builtin` (MonoRail's own, read-only). |
| `repo` | `string` |  | The allowed repo a project subagent lives in. |
| `name` | `string` | Yes | The header's `name`: lowercase letters and hyphens. |
| `description` | `string` | Yes | When the agent should use it. |
| `model` | `string` |  | Claude: `sonnet`, `opus`, `haiku`, `inherit` or a model id; pi: a model id. Unset = the chat's model. |
| `tools` | `string[]` |  | Tools it may use. Unset = the default tools. |
| `location` | `string` | Yes | Where the file is, relative to the home folder or the repo. |
| `updatedAt` | `timestamp` | Yes | Last change to the file, ms since epoch. |
| `customized` | `boolean` |  | A built-in the user has made their own copy of. |
| `extraFields` | `string[]` | Yes | Header fields MonoRail does not edit; kept as they are on save. |
| `note` | `string` |  | Built-ins only: what it needs or how it is used. |
| `problem` | `string` |  | Why the agent would skip this file, if it would. |

<!-- /standard -->

## Flow

A saved chain of agent steps that runs in one of Chat's allowed repos
([Flows](../../flows.md), guide: [Flows](../../guide/agents/flows.md)). Explore
shows a flow's summary, not its steps.

<!-- standard:fields flow -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | The flow's id. |
| `name` | `string` | Yes | Its name. |
| `description` | `string` | Yes | What it does. |
| `folder` | `string` | Yes | The allowed repo, by name, where agent steps run by default. |
| `kinds` | `string[]` | Yes | The kinds of step it uses. |
| `steps` | `number` | Yes | How many steps it has. |
| `agentName` | `string` | Yes | The agent that runs its steps. |
| `updated` | `timestamp` | Yes | Last change, ms since epoch. |
| `runs7d` | `number` |  | Runs in the last 7 days. |
| `running` | `boolean` |  | A run is going now. |
| `error` | `string` |  | Why the flow could not be read, if it could not. |

<!-- /standard -->

## Prompt templates

The Catalog's Prompts page keeps reusable prompts. They are not a MonoRail
type: OpenMetadata 2.1 has a [Prompt Template](../data-assets/ai/prompt-template.md)
entity for the same thing, so MonoRail uses that one (see the
[rules](../README.md#rules)). Explore lists them under **AI assets**.
