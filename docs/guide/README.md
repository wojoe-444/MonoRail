---
audience: human
folder: Guides
summary: What MonoRail is, what it does, and how to read this wiki.
---

# Welcome to MonoRail

MonoRail is a desktop hub for working alongside AI [agents](glossary.md#agent)
like Claude Code and pi. It puts your agent chats, costs, repositories, tasks
and data catalog in one place.

MonoRail runs locally on your computer. It reads files already on disk, keeps
its own state in your [data folder](glossary.md#data-folder), and uploads
nothing on its own ([private data stays local](private-data.md)).

## What you can do

- **Work with [agents](agents/README.md).** Continue Claude Code and pi
  sessions in [Chat](agents/chat.md), delegate across chats with the
  [Coordinator](agents/coordinator.md), draw multi-step [flows](agents/flows.md),
  build helpers in the [Template Catalog](agents/catalog.md), track costs in
  [Claude Stats](agents/spend.md), and control [agent access](agents/agent-access.md).
- **Manage your [workspace](workspace/README.md).** Browse and search repos in
  [GitHub+](workspace/browse-repos.md), track work in [Tasks](workspace/tasks.md)
  or [Tracker](workspace/tracker.md), jot [Notes](workspace/notes.md), study
  [Flashcards](workspace/flashcards.md), and manage [Files](workspace/files.md),
  [Email](workspace/email.md), [Docker](workspace/docker.md) and
  [Storage](workspace/storage.md).
- **Explore [data & catalog](data/README.md).** Inspect every entity in
  [Explore](data/explore.md) and [OpenMetadata](data/openmetadata.md), run
  [ingestion pipelines](data/services.md), query [BigQuery](data/bigquery.md),
  edit [SQLX](data/sqlx.md), and browse [Malloy](data/malloy.md) or
  [MetricFlow](data/semantic.md) models.
- **Find anything fast.** Press **Ctrl+K** anywhere to [search](search.md)
  pages, settings, chats, the wiki and the
  [MonoRail standard](../standard/README.md).
- **Make it yours.** [Connect accounts](setup/connections.md), pick a
  [theme](setup/appearance.md), schedule
  [backups](setup/backups-and-updates.md), or add
  [extensions](setup/extensions.md) ([full setup guide](setup/README.md)).

## How to read this wiki

Follow links instead of hunting through the sidebar:

- **Inline links** jump to the page explaining that concept — hover any link
  for a preview.
- **Linked from** at the bottom of a page shows every page pointing here.
- **Breadcrumbs** at the top (`Wiki › Guides › Agents`) jump up to the parent
  section.

Start with [your first ten minutes](first-ten-minutes.md). Check the
[glossary](glossary.md) for terms and [questions and answers](faq.md) for
common snags.

## For people, for agents

Every page is tagged with its audience (switchable at the top of the sidebar;
starts on **People**):

- **For people**: plain-language guides requiring no code.
- **For agents**: dense technical reference (file paths, schemas, contracts)
  such as [extensions](../extensions/README.md) and
  [caching](../caching.md).
