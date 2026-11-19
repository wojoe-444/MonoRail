---
audience: human, ai
summary: A folder in a drive service that holds files, spreadsheets and other directories. OpenMetadata's Directory entity.
---

# Directory

A folder in a drive service that holds files, spreadsheets and other directories. It is OpenMetadata's
[Directory](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/directory.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Drives](README.md).

- **Type:** `directory`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/drives/directories`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields directory -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this directory instance. |
| `name` | `entityName` | Yes | Name of the directory. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the directory. |
| `displayName` | `string` |  | Display Name that identifies this directory. |
| `description` | `markdown` |  | Description of the directory. |
| `service` | `entityReference` | Yes | Link to the drive service this directory belongs to |
| `serviceType` | `driveServiceType` |  | Type of drive service |
| `parent` | `entityReference` |  | Parent directory reference |
| `children` | `entityReferenceList` |  | Child directories and files |
| `directoryType` | `directoryType` |  | Type of directory |
| `path` | `string` |  | Full path to the directory |
| `isShared` | `boolean` |  | Whether this directory is shared |
| `numberOfFiles` | `integer` |  | Number of files in this directory |
| `numberOfSubDirectories` | `integer` |  | Number of subdirectories |
| `totalSize` | `integer` |  | Total size of all files in bytes |
| `sourceUrl` | `sourceUrl` |  | Link to this directory in the source system. |
| `href` | `href` |  | Link to the resource corresponding to this directory. |
| `owners` | `entityReferenceList` |  | Owners of this directory. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `tags` | `tagLabel[]` |  | Tags associated with this directory. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Directory belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this directory. |
| `entityStatus` | `status` |  | Status of the Directory. |

<!-- /standard -->
