---
audience: human, ai
summary: A knowledge page: an article or note in the knowledge center. OpenMetadata's Page entity.
---

# Page

A knowledge page: an article or note in the knowledge center. It is OpenMetadata's
[Page](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/page.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Collaboration](README.md).

- **Type:** `page`
- **Required:** `name`, `pageType`, `page`
- **API:** `/v1/contextCenter/pages`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields page -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of the Knowledge Page. |
| `name` | `entityName` | Yes | Name of Knowledge Page belongs to |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of a Knowledge Page. |
| `displayName` | `string` |  | Display Name that identifies this Knowledge Page. |
| `description` | `markdown` |  | Description of a Knowledge Page. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who updated the Knowledge Page. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this Knowledge Page resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `owners` | `entityReferenceList` |  | Owners of this Knowledge Page. |
| `reviewers` | `entityReferenceList` |  | User references of the reviewers for this tag. |
| `entityStatus` | `status` |  | Lifecycle stage of the page. |
| `followers` | `entityReferenceList` |  | Followers of this Knowledge Page. |
| `votes` | `votes` |  | Votes for this Knowledge Page. |
| `tags` | `tagLabel[]` |  | Tags for this SQL query. |
| `pageType` | `pageType` | Yes | Type of the Knowledge Page. |
| `page` | `article \| quickLink` | Yes | Knowledge Page Schema |
| `relatedEntities` | `entityReferenceList` |  | Related Entities for the Knowledge Page |
| `editors` | `entityReferenceList` |  | List of users who are updating the entity |
| `parent` | `entityReference` |  | Parent of this Knowledege Center. |
| `children` | `entityReferenceList` |  | Children of this Knowledge Center. |
| `childrenCount` | `integer` |  | Count of immediate children glossary terms. |
| `domains` | `entityReferenceList` |  | Fully qualified name of the domains the Knowledge Page belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `attachments` | `asset[]` |  | Attachments for the Knowledge Page |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `processingStatus` | `pageProcessingStatus` |  | Status of the most recent knowledge-pill extraction run on this article's body. |
| `processingError` | `string` |  | Error message from the most recent failed knowledge-pill extraction run, if any. |
| `extractionStats` | `extractionStats` |  | Statistics from the most recent knowledge-pill extraction run on this page's body. |
| `memoryCount` | `integer` |  | Number of knowledge pills (context memories) extracted from this page. |

<!-- /standard -->
