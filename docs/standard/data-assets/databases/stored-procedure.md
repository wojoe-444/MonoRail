---
audience: human, ai
summary: A procedure stored in a database schema. OpenMetadata's Stored Procedure entity.
---

# Stored Procedure

A **Stored Procedure** is code stored in a [Database Schema](database-schema.md),
next to its [tables](table.md). It is OpenMetadata's
[Stored Procedure](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/stored-procedures)
entity, adopted as it is (see the [rules](../../README.md#rules)).

- **Type:** `storedProcedure`
- **Full name:** `service.database.schema.procedure`
- **Required:** `id`, `name`, `storedProcedureCode`
- **API:** `/v1/storedProcedures`

## In MonoRail

The [OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your
own OpenMetadata server. Inside MonoRail there are none yet. No MonoRail source has stored procedures, so
[Explore](../../../guide/data/explore.md) shows this type empty until one does
([the hierarchy](README.md#the-hierarchy) shows where it fits).

## Fields

<!-- standard:fields storedProcedure -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the StoredProcedure. |
| `name` | `entityName` | Yes | Name of Stored Procedure. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of a Stored Procedure. |
| `displayName` | `string` |  | Display Name that identifies this Stored Procedure. |
| `description` | `markdown` |  | Description of a Stored Procedure. |
| `storedProcedureCode` | `storedProcedureCode` | Yes | Stored Procedure Code. |
| `version` | `entityVersion` |  | Metadata version of the Stored Procedure. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `storedProcedureType` | `storedProcedureType` |  | Type of the Stored Procedure. |
| `updatedBy` | `string` |  | User who made the query. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this Query resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `databaseSchema` | `entityReference` |  | Reference to Database Schema that contains this stored procedure. |
| `database` | `entityReference` |  | Reference to Database that contains this stored procedure. |
| `service` | `entityReference` |  | Link to Database service this table is hosted in. |
| `serviceType` | `databaseServiceType` |  | Service type this table is hosted in. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `owners` | `entityReferenceList` |  | Owners of this Stored Procedure. |
| `followers` | `entityReferenceList` |  | Followers of this Stored Procedure. |
| `votes` | `votes` |  | Votes on the entity. |
| `code` | `sqlQuery` |  | SQL Query definition. |
| `tags` | `tagLabel[]` |  | Tags for this SQL query. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of database schema. |
| `domains` | `entityReferenceList` |  | Domains the Stored Procedure belongs to. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `processedLineage` | `boolean` |  | Processed lineage for the stored procedure |
| `entityStatus` | `status` |  | Status of the StoredProcedure. |

<!-- /standard -->
