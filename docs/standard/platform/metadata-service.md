---
audience: human, ai
summary: Another metadata catalog, such as Amundsen or Atlas, read as a source. OpenMetadata's Metadata Service entity.
---

# Metadata Service

Another metadata catalog, such as Amundsen or Atlas, read as a source. It is OpenMetadata's
[Metadata Service](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/metadataService.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `metadataService`
- **Required:** `id`, `name`, `serviceType`
- **API:** `/v1/services/metadataServices`

## In MonoRail

MonoRail has one of its own: a BigQuery dataset made the
[source of truth for MonoRail's metadata](../../bigquery-metadata.md), service
type `BigQuery`, listed on the [Services page](../../guide/setup/services.md)
and on [Explore](../../guide/explore.md) once it is set up. The
[OpenMetadata page](../../guide/openmetadata.md) lists the metadata services
of your own OpenMetadata server.

## Service types

`serviceType` takes OpenMetadata's values, plus `BigQuery`, which MonoRail
adds ([rule 5](../README.md#rules)). An OpenMetadata server does not know
`BigQuery` as a metadata service type, so a metadata service of that type
stays in MonoRail.

<!-- standard:enum metadataServiceType -->

| Value | Defined by | What it is |
| --- | --- | --- |
| `Amundsen` | OpenMetadata 2.1.x | |
| `MetadataES` | OpenMetadata 2.1.x | |
| `OpenMetadata` | OpenMetadata 2.1.x | |
| `Atlas` | OpenMetadata 2.1.x | |
| `Alation` | OpenMetadata 2.1.x | |
| `AlationSink` | OpenMetadata 2.1.x | |
| `Collibra` | OpenMetadata 2.1.x | |
| `BigQuery` | MonoRail | A BigQuery dataset in MonoRail's metadata layout (monorail.metadata/2), made the source of truth for MonoRail's metadata. MonoRail reads it and keeps a copy on the PC. [More](../../bigquery-metadata.md) |

<!-- /standard -->

## Fields

<!-- standard:fields metadataService -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this database service instance. |
| `name` | `entityName` | Yes | Name that identifies this database service. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Display Name that identifies this database service. |
| `serviceType` | `metadataServiceType` | Yes | Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... MonoRail adds `BigQuery`. |
| `description` | `markdown` |  | Description of a database service instance. |
| `connection` | `metadataConnection` |  | Metadata Service Connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `testConnectionResult` | `testConnectionResult` |  | Last test connection results for this service |
| `tags` | `tagLabel[]` |  | Tags for this Metadata Service. |
| `serviceAttributes` | `serviceAttributes` |  | Deployment attributes of this service: environment, region and deployment. |
| `owners` | `entityReferenceList` |  | Owners of this database service. |
| `href` | `href` |  | Link to the resource corresponding to this database service. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `entityStatus` | `status` |  | Status of the entity. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `ingestionRunner` | `entityReference` |  | The ingestion agent responsible for executing the ingestion pipeline. |

<!-- /standard -->
