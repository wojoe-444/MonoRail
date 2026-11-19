---
audience: human, ai
summary: The steps for testing a connection to one kind of service. OpenMetadata's Test Connection Definition entity.
---

# Test Connection Definition

The steps for testing a connection to one kind of service. It is OpenMetadata's
[Test Connection Definition](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/testConnectionDefinition.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `testConnectionDefinition`
- **Required:** `name`, `steps`
- **API:** `/v1/services/testConnectionDefinitions`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields testConnectionDefinition -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this test case definition instance. |
| `name` | `entityName` | Yes | Name of the Test Connection Definition. |
| `displayName` | `string` |  | Display Name that identifies this test definition. |
| `description` | `markdown` |  | Description of the test connection def. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `steps` | `testConnectionStep[]` | Yes | Steps to test the connection. |
| `owners` | `entityReferenceList` |  | Owner of this TestConnection definition. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |

<!-- /standard -->
