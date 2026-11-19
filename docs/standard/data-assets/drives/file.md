---
audience: human, ai
summary: A document or other file stored in a drive service. OpenMetadata's File entity.
---

# File

A document or other file stored in a drive service. It is OpenMetadata's
[File](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/file.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Drives](README.md).

- **Type:** `file`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/drives/files`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields file -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this file instance. |
| `name` | `entityName` | Yes | Name of the file. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the file. |
| `displayName` | `string` |  | Display Name that identifies this file. |
| `description` | `markdown` |  | Description of the file. |
| `service` | `entityReference` | Yes | Link to the drive service |
| `serviceType` | `driveServiceType` |  | Type of drive service |
| `directory` | `entityReference` |  | Parent directory containing this file |
| `fileType` | `fileType` |  | Type of file based on content |
| `mimeType` | `string` |  | MIME type of the file |
| `fileExtension` | `string` |  | File extension |
| `path` | `string` |  | Full path to the file |
| `size` | `integer` |  | File size in bytes |
| `columns` | `column[]` |  | Column definitions for structured data files (CSV, etc.) |
| `sampleData` | `tableData` |  | Sample data from the file |
| `checksum` | `string` |  | File checksum/hash |
| `webViewLink` | `string` |  | Web link to view the file |
| `downloadLink` | `string` |  | Direct download link |
| `isShared` | `boolean` |  | Whether this file is shared |
| `fileVersion` | `string` |  | File version information |
| `createdTime` | `timestamp` |  | File creation timestamp |
| `modifiedTime` | `timestamp` |  | Last modification timestamp |
| `lastModifiedBy` | `entityReference` |  | User who last modified the file |
| `sourceUrl` | `sourceUrl` |  | Link to this file in the source system. |
| `href` | `href` |  | Link to the resource corresponding to this file. |
| `owners` | `entityReferenceList` |  | Owners of this file. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `tags` | `tagLabel[]` |  | Tags associated with this file. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the File belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this file. |
| `entityStatus` | `status` |  | Status of the File. |

<!-- /standard -->
