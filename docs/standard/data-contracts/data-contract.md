---
audience: human, ai
summary: The schema, quality and service-level guarantees a data asset makes. OpenMetadata's Data Contract entity.
---

# Data Contract

The schema, quality and service-level guarantees a data asset makes. It is OpenMetadata's
[Data Contract](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-contracts) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data contracts](README.md).

- **Type:** `dataContract`
- **Required:** `id`, `name`, `entity`
- **API:** `/v1/dataContracts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dataContract -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this data contract instance. |
| `name` | `entityName` | Yes | Name of the data contract. |
| `displayName` | `string` |  | Display name of the data contract. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the data contract. |
| `description` | `markdown` |  | Description of the data contract. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when the data contract was created. |
| `createdBy` | `string` |  | User or Bot who created the data contract. |
| `href` | `href` |  | Link to this data contract resource. |
| `entityStatus` | `status` |  | Approval status of the data contract. |
| `entity` | `entityReference` | Yes | Reference to the data entity (table, topic, etc.) this contract applies to. |
| `testSuite` | `entityReference` |  | Reference to the test suite that contains tests related to this data contract. |
| `schema` | `column[]` |  | Schema definition for the data contract. |
| `semantics` | `semanticsRule[]` |  | Semantics rules defined in the data contract. |
| `termsOfUse` | `termsOfUse` |  | Terms of use for the data contract for both human and AI agents consumption. |
| `security` | `contractSecurity` |  | Security and access policy expectations defined in the data contract. |
| `sla` | `contractSLA` |  | Service Level Agreement expectations defined in the data contract. |
| `qualityExpectations` | `entityReference[]` |  | Quality expectations defined in the data contract. |
| `odcsQualityRules` | `odcsQualityRule[]` |  | ODCS quality rules stored during import for round-trip compatibility with ODCS export. |
| `odcsPreservedFields` | `object` |  | ODCS metadata without a native OpenMetadata mapping, retained as a generic JSON document for export. |
| `odcsElementExtensions` | `odcsElementExtension[]` |  | ODCS schema element attributes with no OpenMetadata equivalent, stored during import for round-trip compatibility with ODCS export. |
| `contractUpdates` | `contractUpdate[]` |  | History of updates to the data contract. |
| `owners` | `entityReferenceList` |  | Owners of this data contract. |
| `reviewers` | `entityReferenceList` |  | User references of the reviewers for this data contract. |
| `effectiveFrom` | `dateTime` |  | Date from which this data contract is effective. |
| `effectiveUntil` | `dateTime` |  | Date until which this data contract is effective. |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change description of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `sourceUrl` | `sourceUrl` |  | Source URL of the data contract. |
| `latestResult` | `object` |  | Latest validation result for this data contract. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `inherited` | `boolean` |  | Indicates whether this data contract is inherited from a parent entity. |

<!-- /standard -->
