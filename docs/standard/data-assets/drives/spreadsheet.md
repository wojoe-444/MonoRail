---
audience: human, ai
summary: A file of worksheets, such as a Google Sheets or Excel file. OpenMetadata's Spreadsheet entity.
---

# Spreadsheet

A file of worksheets, such as a Google Sheets or Excel file. It is OpenMetadata's
[Spreadsheet](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/spreadsheet.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Drives](README.md).

- **Type:** `spreadsheet`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/drives/spreadsheets`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields spreadsheet -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this spreadsheet instance. |
| `name` | `entityName` | Yes | Name that identifies the spreadsheet. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Name that uniquely identifies a spreadsheet in the format 'ServiceName.DirectoryPath.SpreadsheetName'. |
| `displayName` | `string` |  | Display Name that identifies this spreadsheet. |
| `description` | `markdown` |  | Description of the spreadsheet instance. |
| `service` | `entityReference` | Yes | Link to the drive service where this spreadsheet is hosted. |
| `serviceType` | `driveServiceType` |  | Service type where this spreadsheet is hosted. |
| `directory` | `entityReference` |  | Reference to Directory that contains this spreadsheet. |
| `worksheets` | `entityReferenceList` |  | References to worksheets/tabs in the spreadsheet. |
| `mimeType` | `spreadsheetMimeType` |  | MIME type of the spreadsheet file |
| `path` | `string` |  | Full path to the spreadsheet file |
| `driveFileId` | `string` |  | Native file ID in the source system |
| `size` | `integer` |  | File size in bytes (may be null for cloud-native files like Google Sheets) |
| `fileVersion` | `string` |  | File version information |
| `createdTime` | `timestamp` |  | Spreadsheet creation timestamp |
| `modifiedTime` | `timestamp` |  | Last modification timestamp |
| `lastModifiedBy` | `entityReference` |  | User who last modified the spreadsheet |
| `usageSummary` | `usageDetails` |  | Latest usage information for this spreadsheet. |
| `sourceUrl` | `sourceUrl` |  | Link to view/edit this spreadsheet in the source system (e.g., Google Sheets URL, SharePoint URL). |
| `href` | `href` |  | Link to the resource corresponding to this spreadsheet. |
| `owners` | `entityReferenceList` |  | Owners of this spreadsheet. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `tags` | `tagLabel[]` |  | Tags associated with this spreadsheet. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Spreadsheet belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `entityStatus` | `status` |  | Status of the Spreadsheet. |

<!-- /standard -->
