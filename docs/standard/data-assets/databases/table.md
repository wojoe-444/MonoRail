---
audience: human, ai
summary: Data in rows and columns, defined in a database schema; views count too. OpenMetadata's Table entity.
---

# Table

A **Table** organizes data in rows and columns and is defined in a
[Database Schema](database-schema.md). Views, materialized views and external
tables are tables too (`tableType`). It is OpenMetadata's
[Table](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/tables)
entity, adopted as it is (see the [rules](../../README.md#rules)).

- **Type:** `table`
- **Full name:** `service.database.schema.table`
- **Required:** `id`, `name`, `columns`
- **API:** `/v1/tables`

## In MonoRail

The [OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your
own OpenMetadata server. [Explore](../../../guide/data/explore.md) lists the tables the
[semantic project's](../../../semantic.md) models are built on: each
[semantic model's](../../monorail/semantic.md#semantic-model) `relation`. It fills
`name`, `fullyQualifiedName`, `database` and `databaseSchema`. Columns are not
in the manifest, so `columns` is empty for now.

## Fields

<!-- standard:fields table -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this table instance. |
| `name` | `entityName` | Yes | Name of a table. |
| `displayName` | `string` |  | Display Name that identifies this table. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of a table in the form `serviceName.databaseName.tableName`. |
| `description` | `markdown` |  | Description of a table. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this table resource. |
| `tableType` | `tableType` |  | This schema defines the type used for describing different types of tables. |
| `columns` | `column[]` | Yes | Columns in this table. |
| `tableConstraints` | `tableConstraint[]` |  | Table constraints. |
| `aliases` | `fullyQualifiedEntityName[]` |  | Alternate fully qualified SQL names that resolve to this table, such as SQL Server synonyms. |
| `tablePartition` | `tablePartition` |  | This schema defines the partition column of a table and format the partition is created. |
| `owners` | `entityReferenceList` |  | Owners of this table. |
| `databaseSchema` | `entityReference` |  | Reference to database schema that contains this table. |
| `database` | `entityReference` |  | Reference to Database that contains this table. |
| `service` | `entityReference` |  | Link to Database service this table is hosted in. |
| `serviceType` | `databaseServiceType` |  | Service type this table is hosted in. |
| `location` | `entityReference` |  | Reference to the Location that contains this table. |
| `locationPath` | `string` |  | Full storage path in case of external and managed tables. |
| `schemaDefinition` | `sqlQuery` |  | DDL for Tables and Views |
| `tags` | `tagLabel[]` |  | Tags for this table. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this table. |
| `followers` | `entityReferenceList` |  | Followers of this table. |
| `joins` | `tableJoins` |  | Details of other tables this table is frequently joined with. |
| `sampleData` | `tableData` |  | Sample data for a table. |
| `tableProfilerConfig` | `tableProfilerConfig` |  | Table Profiler Config to include or exclude columns from profiling. |
| `customMetrics` | `customMetric[]` |  | List of Custom Metrics registered for a table. |
| `profile` | `tableProfile` |  | Latest Data profile for a table. |
| `testSuite` | `entityReference` |  | Executable test suite associated with this table |
| `dataModel` | `dataModel` |  | This captures information about how the table is modeled. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `retentionPeriod` | `duration` |  | Retention period of the data in the table. |
| `compressionEnabled` | `boolean` |  | Indicates whether compression is enabled on this table. |
| `compressionCodec` | `string` |  | Compression algorithm/codec used. |
| `compressionStrategy` | `object` |  | Compression strategy configuration including segment/partition/order keys |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sourceUrl` | `sourceUrl` |  | Source URL of table. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `fileFormat` | `fileFormat` |  | File format in case of file/datalake tables. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `processedLineage` | `boolean` |  | Processed lineage for the table |
| `queries` | `sqlQuery[]` |  | List of queries that are used to create this table. |
| `pipelineObservability` | `pipelineObservability[]` |  | Pipeline observability information for the table. |
| `entityStatus` | `status` |  | Status of the Table. |
| `tableSharding` | `tableSharding` |  | Daily shard family metadata. |

<!-- /standard -->
