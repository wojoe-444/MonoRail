---
audience: human, ai
summary: A path that stores data in a storage service, from a whole bucket down to a folder. OpenMetadata's Container entity.
---

# Container

A path that stores data in a storage service, from a whole bucket down to a folder. It is OpenMetadata's
[Container](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/containers) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Storage](README.md).

- **Type:** `container`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/containers`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields container -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this container instance. |
| `name` | `entityName` | Yes | Name that identifies the container. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a container in the format 'ServiceName.ContainerName'. |
| `displayName` | `string` |  | Display Name that identifies this container. |
| `description` | `markdown` |  | Description of the container instance. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this container. |
| `service` | `entityReference` | Yes | Link to the storage service where this container is hosted in. |
| `parent` | `entityReference` |  | Link to the parent container under which this entity sits, if not top level. |
| `children` | `entityReferenceList` |  | References to child containers residing under this entity. |
| `dataModel` | `containerDataModel` |  | References to the container's data model, if data is structured, or null otherwise |
| `prefix` | `string` |  | Optional prefix path defined for this container |
| `numberOfObjects` | `number` |  | The number of objects/files this container has. |
| `size` | `number` |  | The total size in KB this container has. |
| `fileFormats` | `fileFormat[]` |  | File & data formats identified for the container: e.g. |
| `serviceType` | `storageServiceType` |  | Service type this table is hosted in. |
| `followers` | `entityReferenceList` |  | Followers of this container. |
| `tags` | `tagLabel[]` |  | Tags for this container. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `retentionPeriod` | `duration` |  | Retention period of the data in the Container. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `sampleData` | `tableData` |  | Sample data for the container. |
| `sourceUrl` | `sourceUrl` |  | Source URL of container. |
| `fullPath` | `string` |  | Full path of the container/file. |
| `domains` | `entityReferenceList` |  | Domains the Container belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the Container. |

<!-- /standard -->
