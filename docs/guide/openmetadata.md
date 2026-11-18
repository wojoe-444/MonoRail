---
audience: human
summary: One page for everything in your OpenMetadata server, every kind of entity it has, with every field, relationship and version.
---

# Browse your OpenMetadata server

**OpenMetadata**, right under Home and [Explore](explore.md), shows everything
in an [OpenMetadata](https://open-metadata.org) server on one page: tables,
databases and schemas, dashboards, pipelines, glossaries, tags, test cases,
users, roles and every other kind of thing OpenMetadata keeps. It shows each
one the way OpenMetadata stores it, in the same words the
[MonoRail standard](../standard/README.md) uses.

It is optional. Nothing happens until you add the **OpenMetadata** connection
on [Connections](setup/connections.md).

## Set it up

1. Have an OpenMetadata 2.0 or 2.1 server running. On your own computer that is
   usually OpenMetadata's Docker setup, at `http://localhost:8585`.
2. In OpenMetadata, open **Settings > Bots**, pick a bot (or make one) and
   copy its token.
3. In MonoRail, open [Connections](setup/connections.md), add
   **OpenMetadata**, enter the server and paste the token. You can sign in
   with an email and password instead, if your server uses its own logins.

The token is encrypted and stays on this computer
([passwords and tokens are encrypted](private-data.md#passwords-and-tokens-are-encrypted)).
A server on another computer must use https.

## Find your way around

The list on the left has every kind of [entity](glossary.md#entity)
OpenMetadata has, in its groups (data assets, AI assets, services,
governance, ontology, data quality, teams and access, collaboration and
context, platform), with how many your server holds. Kinds with none are
greyed out but still there, so you can see what OpenMetadata could hold. A
server older than 2.1 has no ontology kinds, so those stay greyed out.

- **Overview** shows the totals, which server you are connected to, and what
  changed most recently.
- **Pick a kind** to list its entities, with their owners and tags. Type in
  the box to narrow the list by name, and switch on **Include deleted** to
  see deleted ones too.
- **Pick an entity** to see everything about it: owners, tags and domains,
  its description, every other field, its columns (for tables and the like),
  the other entities it points to, its earlier versions, and the raw data
  OpenMetadata sent. For the kinds MonoRail has adopted into the standard,
  like tables and databases, each field also says what it means, with a link
  to the kind's page in the standard.

## Editing

You can change an entity's **description** (the pencil beside it). It is
saved to OpenMetadata, which keeps the old text as an earlier version, so
nothing is lost. Everything else on the page only reads.

## What it sends where

The page talks only to the server in your connection, and only while it is
open. It keeps nothing on your computer. See
[private data stays local](private-data.md).

## Related

- [Explore](explore.md) lists what MonoRail itself knows, sorted the same way.
- [Services and ingestion pipelines](setup/services.md) runs, deploys and adds
  the server's ingestion pipelines, and runs pipelines on your PC too.
- [The MonoRail standard](../standard/README.md) explains every kind, with all
  its fields; [Databases](../standard/data-assets/databases/README.md) is the
  one MonoRail fills itself too.
