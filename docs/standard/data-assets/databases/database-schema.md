---
audience: human, ai
summary: A container of tables within a database; in BigQuery, a dataset. OpenMetadata's Database Schema entity.
---

# Database Schema

A **Database Schema** is a container within a [Database](database.md) that
holds [tables](table.md) and [stored procedures](stored-procedure.md). In
BigQuery it is a **dataset**. It is OpenMetadata's
[Database Schema](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/database-schemas)
entity, adopted as it is (see the [rules](../../README.md#rules)).

- **Type:** `databaseSchema`
- **Full name:** `service.database.schema`
- **Required:** `id`, `name`, `database`, `service`
- **API:** `/v1/databaseSchemas`

## In MonoRail

The [OpenMetadata page](../../../guide/openmetadata.md) lists them from your
own OpenMetadata server. [Explore](../../../guide/explore.md) lists one schema for each distinct
database and schema among the tables the
[semantic project's](../../../semantic.md) models are built on, with `name`,
`fullyQualifiedName`, `database` and the `tables` it holds.

## Fields

<!-- standard:fields databaseSchema -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this schema instance. |
| `name` | `entityName` | Yes | Name that identifies the schema. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a schema in the format 'ServiceName.DatabaseName.SchemaName'. |
| `displayName` | `string` |  | Display Name that identifies this schema. |
| `description` | `markdown` |  | Description of the schema instance. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owner of this schema. |
| `service` | `entityReference` | Yes | Link to the database cluster/service where this schema is hosted in. |
| `serviceType` | `databaseServiceType` |  | Service type where this schema is hosted in. |
| `database` | `entityReference` | Yes | Reference to Database that contains this table. |
| `tables` | `entityReferenceList` |  | References to tables in the schema. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this database. |
| `tags` | `tagLabel[]` |  | Tags for this Database Schema Service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `retentionPeriod` | `duration` |  | Retention period of the data in the database schema. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of database schema. |
| `domains` | `entityReferenceList` |  | Domains the Database Schema belongs to. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `databaseSchemaProfilerConfig` | `object` |  | This schema defines the type for Schema profile config. |
| `entityStatus` | `status` |  | Status of the DatabaseSchema. |

<!-- /standard -->
