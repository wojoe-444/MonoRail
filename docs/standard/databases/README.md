---
audience: human, ai
folder: Databases
summary: OpenMetadata's database hierarchy, adopted as it is: services, databases, schemas, tables and stored procedures.
---

# Databases

The first category of the [MonoRail standard](../README.md) taken from
[OpenMetadata v2.0.x](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/databases-overview).
It describes where data lives in a warehouse or database, from the service
down to a single table. Every entity type here is OpenMetadata's own, with its
fields copied from 2.0.8 (see the [rules](../README.md#rules)).

## The hierarchy

```
Database Service      e.g. a BigQuery, Snowflake, Postgres or DuckDB connection
└── Database          a BigQuery project, a Snowflake database
    └── Database Schema    a BigQuery dataset, a Postgres schema
        ├── Table          tables and views
        └── Stored Procedure
```

Each level's `fullyQualifiedName` is its parent's plus its own name, joined
with dots: `service.database.schema.table`. In OpenMetadata, an owner or
domain set on a [Database](database.md) is inherited by its schemas and tables
unless they set their own.

**BigQuery names.** OpenMetadata's _database_ is a BigQuery **project** and its
_schema_ is a **dataset**. Pages may show the BigQuery word, but the entity
types and fields keep OpenMetadata's names.

## Entity types

<!-- standard:entities databases -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Database Service](database-service.md) | `databaseService` | A service such as BigQuery, Snowflake, Postgres or DuckDB that hosts databases. | `/v1/services/databaseServices` |
| [Database](database.md) | `database` | A logical container within a database service. In BigQuery, a project. | `/v1/databases` |
| [Database Schema](database-schema.md) | `databaseSchema` | A container of tables and stored procedures within a database. In BigQuery, a dataset. | `/v1/databaseSchemas` |
| [Table](table.md) | `table` | Data in rows and columns, defined in a database schema. Views count as tables. | `/v1/tables` |
| [Stored Procedure](stored-procedure.md) | `storedProcedure` | A procedure stored in a database schema. | `/v1/storedProcedures` |

<!-- /standard -->

## Where MonoRail gets them today

MonoRail does not connect to OpenMetadata or to a warehouse yet. For now
[Explore](../../guide/explore.md) fills this category from the
[semantic project](../../semantic.md): each
[semantic model](../semantic.md#semantic-model) names the table it is built on
(its `relation`), and Explore lists those tables with their
[databases](database.md) and [schemas](database-schema.md). The manifest does
not name the service, so `service` stays unset and full names start at the
database (`database.schema.table`) until it is known. There are no
[database services](database-service.md) or
[stored procedures](stored-procedure.md) yet, and Explore shows those types
empty.
