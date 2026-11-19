---
audience: human
summary: One page that lists everything MonoRail knows about, sorted by kind, with every field it has.
---

# Explore everything MonoRail knows

**Explore**, right under Home, lists everything MonoRail knows about in one
place: your [subagents](glossary.md#subagent), [flows](agents/flows.md),
notes, bookmarks, flashcards, your [semantic project](setup/semantic.md) and
the tables behind it. Nothing new is stored; Explore reads what the other
pages already keep.

## How it is sorted

The tree on the left follows the [MonoRail standard](../standard/README.md).
It is grouped in sections: MonoRail's own things first (Agents, Workspace,
Learning, Semantic), then everything OpenMetadata describes (data assets
such as Databases and Dashboards, governance, teams and users, data quality,
and more). Each section holds categories, and each category holds the kinds
of thing in it, called [entity](glossary.md#entity) types. Open a type to see its items, and an item
to see its fields. A type with nothing in it yet still shows, with a 0, so you
can see what MonoRail could hold. Your prompt templates are under **AI assets**: OpenMetadata has a
word for them, so MonoRail uses it.

Pick a field to see its value on the right, with what the standard says the
field means and a link to the type's page in the standard.

## Searching

To jump to one kind of thing from any page, press Ctrl+K and type its name
(for example "table" or "subagent"): [search](search.md) opens Explore at
that kind.

The search box looks through names, field names and values at once. The menu
beside it narrows the list to one category. **Clear filters** resets both,
and **Refresh** reads every source again.

## Where Databases come from

The **Databases** category uses OpenMetadata's words: database, schema,
table. For now it is filled from your [semantic project](setup/semantic.md):
each semantic model names the table it reads, and Explore lists those tables
with their databases and schemas. Until you
[set up Semantic](setup/semantic.md) on [Connections](setup/connections.md),
the category is empty. [Databases in the standard](../standard/data-assets/databases/README.md)
explains each type.

[Ingestion pipelines](setup/services.md) that run on your PC add more: the
tables, views and columns of a SQLite database, row counts from a profiler
run, and the models, sources and [lineage](openmetadata.md#lineage) of a dbt project. Their full names
start with the service, such as `local_sqlite.main.main.notes`.

When a BigQuery dataset is
[the source of truth for your metadata](openmetadata.md#bigquery-as-the-source-of-truth),
Explore lists everything in it too, from the copy MonoRail keeps on your PC:
tables, glossary terms, data products, users and every other kind it holds,
each under its own category. Deleted ones are left out. Explore never syncs
the copy itself: after a change in BigQuery, press **Sync now** on the
OpenMetadata page (or wait for the next sync), then **Refresh** here.

To see what is in an OpenMetadata server itself, every kind of entity it
has, open the [OpenMetadata](openmetadata.md) page.

Explore only reads. It never sends anything anywhere; see
[private data stays local](private-data.md).
