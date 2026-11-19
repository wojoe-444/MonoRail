---
audience: human, ai
summary: A unit of data assets that a team owns and offers to others as a product. OpenMetadata's Data Product entity.
---

# Data Product

A unit of data assets that a team owns and offers to others as a product. It is OpenMetadata's
[Data Product](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/data-products) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `dataProduct`
- **Required:** `id`, `name`, `description`
- **API:** `/v1/dataProducts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dataProduct -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique ID of the Data Product |
| `name` | `entityName` | Yes | A unique name of the Data Product |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName is `domain.dataProductName` or `sub-domain.dataProductName`. |
| `displayName` | `string` |  | Name used for display purposes. |
| `description` | `markdown` | Yes | Description of the Data Product. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this Data Product. |
| `experts` | `entityReferenceList` |  | List of users who are experts for this Data Product. |
| `reviewers` | `entityReferenceList` |  | User references of the reviewers for this Data Product. |
| `domains` | `entityReferenceList` |  | Domains or sub-domains to which this Data Product belongs to. |
| `assets` | `entityReferenceList` |  | Data assets collection that is part of this data product. |
| `lifecycleStage` | `lifecycleStage` |  | Current lifecycle stage of the data product. |
| `dataProductType` | `dataProductType` |  | Type of the data product (ODPS-aligned taxonomy). |
| `visibility` | `visibility` |  | Visibility level of the data product in the marketplace. |
| `portfolioPriority` | `portfolioPriority` |  | Portfolio-level priority of this data product. |
| `sla` | `slaDefinition` |  | Service Level Agreement for this data product |
| `consumesFrom` | `entityReferenceList` |  | Other data products that this product consumes data from |
| `providesTo` | `entityReferenceList` |  | Other data products that consume data from this product |
| `tags` | `tagLabel[]` |  | Tags associated with the Data Product. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `followers` | `entityReferenceList` |  | Followers of this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `entityStatus` | `status` |  | Status of the Data Product. |

<!-- /standard -->
