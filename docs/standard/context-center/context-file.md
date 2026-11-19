---
audience: human, ai
summary: A file uploaded to the context center drive, such as a PDF or spreadsheet. OpenMetadata's Context File entity.
---

# Context File

A file uploaded to the context center drive, such as a PDF or spreadsheet. It is OpenMetadata's
[Context File](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/contextFile.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Context center](README.md).

- **Type:** `contextFile`
- **Required:** `id`, `name`
- **API:** `/v1/contextCenter/drive/files`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields contextFile -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the file. |
| `name` | `entityName` | Yes | Name of the file. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the file. |
| `displayName` | `string` |  | Display name (original filename or user-provided title). |
| `description` | `markdown` |  | Description of the file. |
| `fileType` | `fileType` |  | Type of file (PDF, Spreadsheet, etc.). |
| `fileSize` | `integer` |  | File size in bytes. |
| `contentType` | `string` |  | MIME type of the file. |
| `fileExtension` | `string` |  | File extension (e.g., pdf, xlsx). |
| `assetId` | `string` |  | Legacy reference to the current Asset entity storing the file blob. |
| `headContentId` | `string` |  | Identifier of the current ContextFileContent snapshot for this file. |
| `processingStatus` | `processingStatus` |  | Current processing state after upload. |
| `processingError` | `string` |  | Reason the most recent processing attempt failed. |
| `extractionStats` | `extractionStats` |  | Statistics from the most recent knowledge-pill extraction run. |
| `extractedText` | `string` |  | Full text extracted from the file for search and AI context. |
| `pageCount` | `integer` |  | Number of pages (PDF) or sheets (spreadsheet). |
| `memoryCount` | `integer` |  | Number of knowledge pills (context memories) extracted from this file. |
| `sourceType` | `sourceType` |  | How this file was added. |
| `sourceId` | `string` |  | ID of the file in the external source system. |
| `sourceUrl` | `string` |  | URL to view the file in the external source system. |
| `folder` | `entityReference` |  | Parent folder containing this file. |
| `owners` | `entityReferenceList` |  | Owners of this file. |
| `shareConfig` | `shareConfig` |  | Who can see this file, beyond its owners. |
| `tags` | `tagLabel[]` |  | Tags associated with this file. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to this resource. |
| `changeDescription` | `changeDescription` |  | Change that led to this version. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change that led to this version. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains this file belongs to. |
| `followers` | `entityReferenceList` |  | Followers of this file. |
| `votes` | `votes` |  | Votes on this file. |

<!-- /standard -->
