---
audience: human
summary: Plain-language definitions of the words used across MonoRail and AI agents.
---

# Glossary

Plain definitions of MonoRail and AI-agent terms, linked to where each matters
most.

## Agent
An AI program that acts rather than only chatting: reads files, runs commands
and edits code (such as Claude Code or pi). See [Chat](agents/chat.md).

## Subagent
A helper agent with its own instructions and tool limits that a main agent
delegates to. See [Create an agent](agents/create-an-agent.md) and the
[mochi crew](agents/mochi-crew.md).

## Skill
Written instructions an agent follows when relevant, without separate tool
limits. See [skills](agents/create-an-agent.md#skills).

## Coordinator
A special chat pinned in Chat that reads and delegates to your other chats. See
[The Coordinator](agents/coordinator.md).

## Flow
An agent built as connected steps on a canvas: inputs, agents, subagents,
prompts and output. See [Build a flow](agents/flows.md).

## Chat
One conversation (session) with an agent. See [Chat with your agents](agents/chat.md).

## Model
The underlying AI (such as Claude Opus, Sonnet or Haiku). Larger models cost
more. See [Keep an eye on spending](agents/spend.md).

## Token
The unit models read and write (roughly ¾ of a word). Pricing is per million
tokens ([headline cost](agents/spend.md#the-headline-number)).

## Input and output
Text sent to the model (input) and generated back (output, priced higher per
token).

## Cache
Recently seen prompt text kept temporarily for cheaper reuse — or a local
rebuildable summary MonoRail stores ([Caching in MonoRail](../caching.md)).

## Effort
How long a model reasons before answering ("thinking"). Higher effort costs
more ([Claude Stats](agents/spend.md#what-the-charts-show)).

## MCP
Model Context Protocol: the standard way agents call external tools. See
[Let agents use MonoRail](agents/agent-access.md).

## Repository
A folder tracked by git with its full history ("repo"). Browsed in
[GitHub+](workspace/browse-repos.md).

## Commit
One saved snapshot in a repository's git history.

## Branch
An independent line of commits in a repository
([comparing branches](workspace/browse-repos.md#what-you-can-see)).

## Issue
A to-do or bug: [local issues](workspace/local-issues.md) inside a repo,
[Tasks](workspace/tasks.md), or [Tracker](workspace/tracker.md).

## Connection
An account or tool MonoRail signs in to ([Connections](setup/connections.md)).
Data-source connections are also [services](#service).

## Local database
MonoRail's SQLite file in your [data folder](#data-folder) storing OpenMetadata
entities, lineage and Tracker data locally
([OpenMetadata](data/openmetadata.md), [reference](../local-database.md)).

## Service
A data source (SQLite database, dbt project or OpenMetadata warehouse) read into
the catalog by **ingestion pipelines**
([Services & ingestion](data/services.md)).

## Extension
An add-on page, full-screen app or agent tool built outside MonoRail
([Add extensions](setup/extensions.md)).

## Data folder
Where MonoRail keeps all local state: `%APPDATA%\MonoRail`
([private data stays local](private-data.md)).

## Profile
One person's settings and data inside MonoRail. Developer Mode adds an empty
**New User** test profile ([Developer Mode](setup/developer-mode.md),
[Profiles](../profiles.md)).

## Entity
A typed object in the [MonoRail standard](../standard/README.md) (subagent,
note, table, database, etc.), browsable in [Explore](data/explore.md).

## For people and for agents
Audience tags on every wiki page: *For people* = plain guides; *For agents* =
technical reference ([how to read this wiki](README.md#how-to-read-this-wiki)).
