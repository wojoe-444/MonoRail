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

The tree on the left follows the [MonoRail standard](../standard/README.md):
each heading is a category (Agents, Workspace, Learning, Semantic,
Databases), and under it are the kinds of thing in that category, called
[entity](glossary.md#entity) types. Open a type to see its items, and an item
to see its fields. A type with nothing in it yet still shows, with a 0, so you
can see what MonoRail could hold.

Pick a field to see its value on the right, with what the standard says the
field means and a link to the type's page in the standard.

## Searching

The search box looks through names, field names and values at once. The menu
beside it narrows the list to one category. **Clear filters** resets both,
and **Refresh** reads every source again.

## Where Databases come from

The **Databases** category uses OpenMetadata's words: database, schema,
table. For now it is filled from your [semantic project](setup/semantic.md):
each semantic model names the table it reads, and Explore lists those tables
with their databases and schemas. Until you
[set up Semantic](setup/semantic.md) on [Connections](setup/connections.md),
the category is empty. [Databases in the standard](../standard/databases/README.md)
explains each type.

To see what is in an OpenMetadata server itself, every kind of entity it
has, open the [OpenMetadata](openmetadata.md) page.

Explore only reads. It never sends anything anywhere; see
[private data stays local](private-data.md).
