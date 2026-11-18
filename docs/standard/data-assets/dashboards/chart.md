---
audience: human, ai
summary: One visual presentation of data, usually part of a dashboard. OpenMetadata's Chart entity.
---

# Chart

One visual presentation of data, usually part of a dashboard. It is OpenMetadata's
[Chart](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/charts) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Dashboards](README.md).

- **Type:** `chart`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/charts`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields chart -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a chart instance. |
| `name` | `entityName` | Yes | Name that identifies this Chart. |
| `displayName` | `string` |  | Display Name that identifies this Chart. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a dashboard in the format 'ServiceName.ChartName'. |
| `description` | `markdown` |  | Description of the dashboard, what it is, and how to use it. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `chartType` | `chartType` |  | This schema defines the type used for describing different types of charts. |
| `sourceUrl` | `sourceUrl` |  | Chart URL suffix from its service. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this chart. |
| `followers` | `entityReferenceList` |  | Followers of this chart. |
| `tags` | `tagLabel[]` |  | Tags for this chart. |
| `service` | `entityReference` | Yes | Link to service where this dashboard is hosted in. |
| `serviceType` | `dashboardServiceType` |  | Service type where this chart is hosted in. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this chart. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `domains` | `entityReferenceList` |  | Domains the Chart belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `dashboards` | `entityReferenceList` |  | All the dashboards containing this chart. |
| `entityStatus` | `status` |  | Status of the Chart. |

<!-- /standard -->
