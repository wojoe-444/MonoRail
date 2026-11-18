---
audience: human, ai
summary: The connection that hosts databases, such as BigQuery, Snowflake, Postgres or DuckDB. OpenMetadata's Database Service entity.
---

# Database Service

A **Database Service** is a service that hosts [databases](database.md), such
as BigQuery, Snowflake, Redshift, Postgres or DuckDB. It is the top of
[the database hierarchy](README.md#the-hierarchy) and OpenMetadata's
[Database Service](https://docs.open-metadata.org/v2.0.x/api-reference/data-assets/database-services)
entity, adopted as it is (see the [rules](../README.md#rules)).

- **Type:** `databaseService`
- **Full name:** its own name
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/databaseServices`

## In MonoRail

None yet. The [semantic project's](../../semantic.md) manifest names tables
but not the service they are on, so [Explore](../../guide/explore.md) shows
this type empty. Its `connection` holds secrets in OpenMetadata; MonoRail will
never show them, and keeps any it needs in
[Connections](../../guide/setup/connections.md).

## Fields

<!-- standard:fields databaseService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this database service instance. |
| `name` | `entityName` | Yes | Name that identifies this database service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this database service. |
| `serviceType` | `databaseServiceType` | Yes | Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... |
| `description` | `markdown` |  | Description of a database service instance. |
| `connection` | `databaseConnection` |  | How to connect to the service. Secrets in it are never shown. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this Database Service. |
| `style` | `style` |  | Color and icon for the entity in the UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `owners` | `entityReferenceList` |  | Owners of this database service. |
| `href` | `href` |  | Link to the resource corresponding to this database service. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `domains` | `entityReferenceList` |  | Domains the Database service belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
