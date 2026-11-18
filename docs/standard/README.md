---
audience: human, ai
folder: Standard
summary: The kinds of things MonoRail knows about, and the fields each one has. It is every entity type of OpenMetadata 2.1, plus a few kinds of MonoRail's own.
---

# The MonoRail standard

The MonoRail standard names every kind of thing MonoRail knows about (an
[entity](../guide/glossary.md#entity) type: a subagent, a note, a database, a
user, a glossary term) and the fields each one has. Everything that lists,
stores or shares those things uses the same names. That includes
[Explore](../guide/explore.md), the [OpenMetadata page](../guide/openmetadata.md),
the [MCP server](../mcp.md) and extensions.

**The standard is OpenMetadata.** It is
[OpenMetadata 2.1](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference),
an open standard for describing data, adopted whole: all 91 of its entity
types, from tables and dashboards to domains, data products, teams, users,
test cases and governance workflows. Where OpenMetadata has a word for
something, MonoRail uses its name, fields and meanings unchanged. The field
lists here are copied from OpenMetadata's own schemas at **2.1.0-rc2**.
MonoRail adds its own entity types only for things OpenMetadata has no word
for, such as [subagents](monorail/agents.md), [notes](monorail/workspace.md)
and [flashcards](monorail/learning.md) ([MonoRail's own types](monorail/README.md)).

Every entity type in the standard shows up on [Explore](../guide/explore.md),
even before MonoRail has anything of that type.

## Entity categories

The categories are grouped in sections. [Data assets](data-assets/README.md)
has one category per kind of service, as in OpenMetadata's API reference.

<!-- standard:categories -->

| Section | Category | What it covers | Entity types | Defined by |
| --- | --- | --- | --- | --- |
| MonoRail | [Agents](monorail/agents.md) | Subagents and flows. | Subagent, Flow | MonoRail |
| MonoRail | [Workspace](monorail/workspace.md) | Notes, bookmarks and scheduled tasks. | Note, Bookmark, Bookmark folder, Scheduled task | MonoRail |
| MonoRail | [Learning](monorail/learning.md) | Flashcard decks and cards. | Flashcard deck, Flashcard | MonoRail |
| MonoRail | [Semantic](monorail/semantic.md) | A dbt project's semantic layer: semantic models, metrics and saved queries. | Semantic model, Metric, Saved query | MonoRail |
| Data assets | [Databases](data-assets/databases/README.md) | Database services, databases, schemas, tables, stored procedures and queries. | Database Service, Database, Database Schema, Table, Stored Procedure, Query | OpenMetadata 2.1.x |
| Data assets | [Messaging](data-assets/messaging/README.md) | Messaging services such as Kafka, and their topics. | Messaging Service, Topic | OpenMetadata 2.1.x |
| Data assets | [Dashboards](data-assets/dashboards/README.md) | Dashboard services, dashboards, charts, data models and reports. | Dashboard Service, Dashboard, Chart, Dashboard Data Model, Report | OpenMetadata 2.1.x |
| Data assets | [Pipelines](data-assets/pipelines/README.md) | Pipeline services such as Airflow, and their pipelines. | Pipeline Service, Pipeline | OpenMetadata 2.1.x |
| Data assets | [ML models](data-assets/ml-models/README.md) | Machine learning model services and models. | ML Model Service, ML Model | OpenMetadata 2.1.x |
| Data assets | [Storage](data-assets/storage/README.md) | Storage services such as S3, and their containers. | Storage Service, Container | OpenMetadata 2.1.x |
| Data assets | [Search](data-assets/search/README.md) | Search services such as OpenSearch, and their indexes. | Search Service, Search Index | OpenMetadata 2.1.x |
| Data assets | [APIs](data-assets/apis/README.md) | API services, collections and endpoints. | API Service, API Collection, API Endpoint | OpenMetadata 2.1.x |
| Data assets | [Drives](data-assets/drives/README.md) | Drive services such as Google Drive: directories, files, spreadsheets and worksheets. | Drive Service, Directory, File, Spreadsheet, Worksheet | OpenMetadata 2.1.x |
| Data assets | [Metrics](data-assets/metrics/README.md) | Business metrics and the groups that organize them. | Metric, Metric Group | OpenMetadata 2.1.x |
| Data assets | [AI assets](data-assets/ai/README.md) | LLM services and models, AI applications, MCP servers, prompt templates and AI governance. | LLM Service, LLM Model, AI Application, MCP Service, MCP Server, Prompt Template, AI Governance Framework, AI Framework Control, AI Governance Policy, Audit Report | OpenMetadata 2.1.x |
| Governance | [Data governance](governance/README.md) | Domains, data products, glossaries, classifications, tags and governance workflows. | Domain, Data Product, Glossary, Glossary Term, Classification, Tag, Workflow Definition, Intake Form | OpenMetadata 2.1.x |
| Governance | [Data contracts](data-contracts/README.md) | The schema and quality guarantees a data asset makes. | Data Contract | OpenMetadata 2.1.x |
| Governance | [Ontology](ontology/README.md) | Formal ontologies: concepts, properties, axioms, relationship types and releases. | Ontology, Ontology Concept, Ontology Property, Ontology Axiom, Ontology Change Set, Ontology Release, Relationship Type | OpenMetadata 2.1.x |
| Governance | [Teams & users](teams-and-users/README.md) | Users, teams, roles, personas, access policies and bots. | User, Team, Role, Persona, Policy, Bot | OpenMetadata 2.1.x |
| Quality & insights | [Data quality](data-quality/README.md) | Test definitions, test cases, test suites and quality dimensions. | Test Definition, Test Case, Test Suite, Data Quality Dimension | OpenMetadata 2.1.x |
| Quality & insights | [Insights](insights/README.md) | Data insight charts, KPIs and web analytic events. | Data Insight Chart, Data Insight Custom Chart, KPI, Web Analytic Event | OpenMetadata 2.1.x |
| Collaboration & context | [Collaboration](collaboration/README.md) | Tasks, announcements, knowledge pages and learning resources. | Task, Task Form Schema, Announcement, Page, Learning Resource | OpenMetadata 2.1.x |
| Collaboration & context | [Context center](context-center/README.md) | Files, folders and reusable context memory for AI-assisted work. | Folder, Context File, Context File Content, Context Memory | OpenMetadata 2.1.x |
| Platform | [Platform](platform/README.md) | How OpenMetadata itself runs: ingestion pipelines, apps, alerts, types and more. | Ingestion Pipeline, Workflow, Application, App Marketplace Definition, Event Subscription, Notification Template, Type, Test Connection Definition, Document, Metadata Service, Security Service | OpenMetadata 2.1.x |

<!-- /standard -->

[Databases](data-assets/databases/README.md) is the category MonoRail fills
itself today, starting with the [Database](data-assets/databases/database.md)
entity. The [OpenMetadata page](../guide/openmetadata.md) shows every
category from your own OpenMetadata server.

## What is not an entity type

OpenMetadata also keeps records that belong to an entity rather than standing
on their own: test case results and incident status, profiles, pipeline and
agent runs, feed threads, conversations and suggestions, and lineage edges.
They have no `id`, name and versions of their own, so they are not entity
types here. They come with the entity they belong to.

## Rules

1. **OpenMetadata first.** If OpenMetadata has an entity type for something,
   MonoRail uses it with the same type name (`database`, `databaseSchema`,
   `eventsubscription`), field names, field types and meanings. MonoRail may
   leave fields unset, but it never renames a field or gives it a different
   meaning. Fields of MonoRail's own go in `extension`, which is
   OpenMetadata's place for custom properties. When OpenMetadata adds a type
   for something MonoRail already had, MonoRail moves to it: its prompt
   templates became OpenMetadata's
   [Prompt Template](data-assets/ai/prompt-template.md) in 2.1.
2. **Own types only for new things.** MonoRail defines its own entity types
   only where OpenMetadata has none. They are named in the same camelCase
   style, and never reuse an OpenMetadata name for something else. That is
   why the semantic layer's metric is `semanticMetric`: OpenMetadata's
   [`metric`](data-assets/metrics/metric.md) is a different entity.
3. **On Explore.** Every entity type in the standard is listed on
   [Explore](../guide/explore.md) under its category, with its fields
   described from the standard.
4. **One definition.** Each entity type has a page here, and its field table
   is generated from the same definition the app reads.

## Where it is defined

The standard is one file, `apps/command-hub/src/standard/standard.json`:
sections, categories, entity types and their fields. Each OpenMetadata type
also records its schema file, REST path and reference page. The app reads it
through `src/standard/index.ts`, which Explore uses for its tree and field
descriptions, and which the OpenMetadata page uses for field descriptions.
The tables on these pages sit between `<!-- standard:... -->` comments and
are written from that file by `node scripts/standard-docs.cjs`, run from
`apps/command-hub`. `npm test` fails when a page is out of date, when an
entity type has no page or field table, when Explore lists a type the
standard does not have, or when the OpenMetadata page's REST paths differ
from the standard's.

## Moving to a new OpenMetadata version

1. Check out OpenMetadata's schemas at the new tag (only
   `openmetadata-spec/src/main/resources/json/schema` is needed; the command
   is at the top of `scripts/standard-openmetadata.cjs`).
2. Run `node scripts/standard-openmetadata.cjs <checkout>` from
   `apps/command-hub`. It rewrites every OpenMetadata type's fields from its
   schema, and lists the entity schemas the standard does not have yet and
   the entries whose schema is gone.
3. Add each new type to `standard.json` with its category, name, summary,
   REST path and reference, give it a page under its category's folder with
   a `<!-- standard:fields <type> -->` block, add it to the OpenMetadata
   page's list, and update `openMetadata.pinned`.
4. Run `node scripts/standard-docs.cjs` for the tables. Explore picks up new
   types by itself.
