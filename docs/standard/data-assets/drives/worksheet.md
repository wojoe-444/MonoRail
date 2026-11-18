---
audience: human, ai
summary: One tab of a spreadsheet, with its columns. OpenMetadata's Worksheet entity.
---

# Worksheet

One tab of a spreadsheet, with its columns. It is OpenMetadata's
[Worksheet](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/worksheet.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Drives](README.md).

- **Type:** `worksheet`
- **Required:** `id`, `name`, `spreadsheet`, `service`
- **API:** `/v1/drives/worksheets`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields worksheet -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this worksheet instance. |
| `name` | `entityName` | Yes | Name of the worksheet. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the worksheet. |
| `displayName` | `string` |  | Display Name that identifies this worksheet. |
| `description` | `markdown` |  | Description of the worksheet. |
| `spreadsheet` | `entityReference` | Yes | Reference to the parent File entity (with fileType=Spreadsheet) |
| `service` | `entityReference` | Yes | Link to the drive service |
| `serviceType` | `driveServiceType` |  | Type of drive service |
| `worksheetId` | `string` |  | Native worksheet/tab ID |
| `index` | `integer` |  | Position/index of the worksheet in the spreadsheet |
| `rowCount` | `integer` |  | Number of rows in the worksheet |
| `columnCount` | `integer` |  | Number of columns in the worksheet |
| `columns` | `column[]` |  | Column definitions if structured data |
| `sampleData` | `tableData` |  | Sample data from the worksheet |
| `isHidden` | `boolean` |  | Whether the worksheet is hidden |
| `sourceUrl` | `sourceUrl` |  | Link to this worksheet in the source system. |
| `href` | `href` |  | Link to the resource corresponding to this worksheet. |
| `owners` | `entityReferenceList` |  | Owners of this worksheet. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `tags` | `tagLabel[]` |  | Tags associated with this worksheet. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Worksheet belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle of the entity |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this worksheet. |
| `entityStatus` | `status` |  | Status of the Worksheet. |

<!-- /standard -->
