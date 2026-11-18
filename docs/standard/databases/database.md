---
audience: human, ai
summary: A logical container within a database service; in BigQuery, a project. OpenMetadata's Database entity, as MonoRail uses it.
---

# Database

A **Database** is a logical container within a
[Database Service](database-service.md), holding
[Database Schemas](database-schema.md). In BigQuery it is a **project**; in
Snowflake, a database. It is OpenMetadata's
[Database](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/databases)
entity, adopted as it is (see the [rules](../README.md#rules)). It is the
first entity MonoRail is building out from
[the Databases category](README.md).

- **Type:** `database`
- **Full name:** `service.database`
- **Required:** `id`, `name`, `service`
- **Owners and domains** set on a database are inherited by its schemas and
  [tables](table.md) unless they set their own.

## In MonoRail

[Explore](../../guide/explore.md) lists one database for each distinct
`database` among the tables the [semantic project's](../../semantic.md)
models are built on. It fills `name` and `fullyQualifiedName` and lists the
schemas it holds in `databaseSchemas`. The manifest does not say which
service the database is on, so `service` is not set yet.

## API

OpenMetadata serves databases at `/v1/databases`. MonoRail does not call it
yet; this is the contract to follow when it does.

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/v1/databases` | List databases (`fields`, `service`, `limit`, `before`, `after`, `include`) |
| `GET` | `/v1/databases/{id}` | Get a database by id |
| `GET` | `/v1/databases/name/{fqn}` | Get a database by full name |
| `POST` | `/v1/databases` | Create a database |
| `PUT` | `/v1/databases` | Create or update a database |
| `PATCH` | `/v1/databases/{id}` | Update a database (JSON Patch) |
| `PATCH` | `/v1/databases/name/{fqn}` | Update a database by full name |
| `DELETE` | `/v1/databases/{id}` | Delete a database (soft unless `hardDelete`) |
| `DELETE` | `/v1/databases/name/{fqn}` | Delete a database by full name |
| `PUT` | `/v1/databases/restore` | Restore a soft-deleted database |
| `GET` | `/v1/databases/{id}/versions` | List its versions |
| `GET` | `/v1/databases/{id}/versions/{version}` | Get one version |
| `PUT` | `/v1/databases/{id}/followers` | Add a follower |
| `DELETE` | `/v1/databases/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/databases/{id}/vote` | Vote on it |
| `GET` | `/v1/databases/name/{fqn}/export` | Export it and its children as CSV (`exportAsync` for large ones) |
| `PUT` | `/v1/databases/name/{fqn}/import` | Import CSV (`importAsync` for large ones) |
| `GET` `PUT` `DELETE` | `/v1/databases/{id}/profilerConfig` | Read, set or remove its profiler settings |

## Fields

<!-- standard:fields database -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this database instance. |
| `name` | `entityName` | Yes | Name that identifies the database. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'. |
| `displayName` | `string` |  | Display Name that identifies this database. |
| `description` | `markdown` |  | Description of the database instance. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `tags` | `tagLabel[]` |  | Tags for this Database. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this database. |
| `service` | `entityReference` | Yes | Link to the database cluster/service where this database is hosted in. |
| `serviceType` | `databaseServiceType` |  | Service type where this database is hosted in. |
| `location` | `entityReference` |  | Reference to the Location that contains this database. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this database. |
| `databaseSchemas` | `entityReferenceList` |  | References to schemas in the database. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `default` | `boolean` |  | Some databases don't support a database/catalog in the hierarchy and use default database. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `retentionPeriod` | `duration` |  | Retention period of the data in the database. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of database. |
| `domains` | `entityReferenceList` |  | Domains the Database belongs to. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | The asset's certification: a tag from the Certification classification, with when it was applied and when it expires. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `databaseProfilerConfig` | `object` |  | This schema defines the type for Database profile config. |
| `entityStatus` | `status` |  | Status of the Database. |

<!-- /standard -->
