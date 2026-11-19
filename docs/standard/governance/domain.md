---
audience: human, ai
summary: A bounded context aligned with a business unit or function, such as Marketing. OpenMetadata's Domain entity.
---

# Domain

A bounded context aligned with a business unit or function, such as Marketing. It is OpenMetadata's
[Domain](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/domains) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `domain`
- **Required:** `id`, `domainType`, `name`, `description`
- **API:** `/v1/domains`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields domain -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique ID of the Domain |
| `domainType` | `domainType` | Yes | Domain type |
| `name` | `entityName` | Yes | A unique name of the Domain |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` | Yes | Description of the Domain. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `parent` | `entityReference` |  | Parent domains. |
| `children` | `entityReferenceList` |  | Children domains or sub-domains. |
| `childrenCount` | `integer` |  | Count of all nested children domains under this domain |
| `owners` | `entityReferenceList` |  | Owners of this Domain. |
| `experts` | `entityReferenceList` |  | List of users who are experts in this Domain. |
| `assets` | `entityReferenceList` |  | Data assets collection that is part of this domain. |
| `tags` | `tagLabel[]` |  | Tags associated with the Domain. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `entityStatus` | `status` |  | Status of the entity. |

<!-- /standard -->
