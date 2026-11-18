---
audience: human, ai
folder: Standard
summary: The kinds of things MonoRail knows about, and the fields each one has. It is OpenMetadata v2.0.x plus a few kinds of MonoRail's own.
---

# The MonoRail standard

The MonoRail standard names every kind of thing MonoRail knows about (an
[entity](../guide/glossary.md#entity) type: a subagent, a note, a database, a
table) and the fields each one has. Everything that lists, stores or shares
those things uses the same names. That includes [Explore](../guide/explore.md),
the [MCP server](../mcp.md) and extensions.

**For now the standard is mostly a pointer.** It is
[OpenMetadata v2.0.x](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets),
an open standard for describing data. Where OpenMetadata already has a word for
something, MonoRail uses its name, fields and meanings unchanged. The field
lists here are copied from OpenMetadata **2.0.8**. MonoRail adds its own entity
types only for things OpenMetadata has no word for, such as
[agents](agents.md), [notes](workspace.md) and [flashcards](learning.md).

Every entity type in the standard shows up on [Explore](../guide/explore.md),
even before MonoRail has anything of that type.

## Entity categories

<!-- standard:categories -->

| Category | What it covers | Entity types | Defined by |
| --- | --- | --- | --- |
| [Agents](agents.md) | Subagents, flows and prompt templates. | Subagent, Flow, Prompt template | MonoRail |
| [Workspace](workspace.md) | Notes, bookmarks and scheduled tasks. | Note, Bookmark, Bookmark folder, Scheduled task | MonoRail |
| [Learning](learning.md) | Flashcard decks and cards. | Flashcard deck, Flashcard | MonoRail |
| [Semantic](semantic.md) | A dbt project's semantic layer: semantic models, metrics and saved queries. | Semantic model, Metric, Saved query | MonoRail |
| [Databases](databases/README.md) | Database services, databases, schemas, tables and stored procedures. | Database Service, Database, Database Schema, Table, Stored Procedure | OpenMetadata 2.0.x |

<!-- /standard -->

[Databases](databases/README.md) is the first OpenMetadata category MonoRail
has adopted, starting with the [Database](databases/database.md) entity.

## OpenMetadata data assets not adopted yet

These are part of the standard by reference: OpenMetadata defines them, and
MonoRail will use them as they are once it has data of that kind. They get a
page here, and a place on Explore, when MonoRail adopts them
([how](#adopting-an-openmetadata-entity)).

<!-- standard:by-reference -->

| Category | What it covers |
| --- | --- |
| [Messaging](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/messaging-services) | Messaging services and topics, such as Kafka and Kinesis. |
| [Dashboards](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/dashboard-services) | Dashboard services, dashboards and charts. |
| [Pipelines](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/pipeline-services) | Pipeline services and pipelines. |
| [ML Models](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/mlmodel-services) | ML model services and ML models. |
| [Storage](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/storage-services) | Storage services and containers. |
| [Search Indexes](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/search-indexes) | Search index entities. |
| [API Services](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/api-collections) | API collections and endpoints. |

<!-- /standard -->

## Rules

1. **OpenMetadata first.** If OpenMetadata v2.0.x has an entity type for
   something, MonoRail uses it with the same type name (`database`,
   `databaseSchema`), field names, field types and meanings. MonoRail may
   leave fields unset, but it never renames a field or gives it a different
   meaning. Fields of MonoRail's own go in `extension`, which is
   OpenMetadata's place for custom properties.
2. **Own types only for new things.** MonoRail defines its own entity types
   only where OpenMetadata has none. They are named in the same camelCase
   style, and never reuse an OpenMetadata name for something else. That is
   why the semantic layer's metric is `semanticMetric`: OpenMetadata's
   `metric` is a different entity.
3. **On Explore.** Every entity type in the standard is listed on
   [Explore](../guide/explore.md) under its category, with its fields
   described from the standard.
4. **One definition.** Each entity type has a page here, and its field table
   is generated from the same definition the app reads.

## Where it is defined

The standard is one file, `apps/command-hub/src/standard/standard.json`:
categories, entity types and their fields. The app reads it through
`src/standard/index.ts`, which Explore uses for its tree and its field
descriptions. The tables on these pages sit between
`<!-- standard:... -->` comments and are written from that file by
`node scripts/standard-docs.cjs`, run from `apps/command-hub`. `npm test`
fails when a page is out of date, when an entity type has no page or field
table, or when Explore does not list an entity type.

## Adopting an OpenMetadata entity

1. Copy the entity's fields from OpenMetadata's 2.0.8 JSON schema
   (`openmetadata-spec/src/main/resources/json/schema/entity/...` on the
   `2.0.8-release` branch of `open-metadata/OpenMetadata`) into
   `standard.json`, with its category, base path and reference link. If it
   starts a new category, add the category and remove that category from
   `byReference`.
2. Add its page under `docs/standard/<category>/` with a
   `<!-- standard:fields <type> -->` block, link it from the category's
   index, and run `node scripts/standard-docs.cjs`.
3. Explore picks up the new type from the standard. Give it entries once a
   MonoRail source has data of that kind.
