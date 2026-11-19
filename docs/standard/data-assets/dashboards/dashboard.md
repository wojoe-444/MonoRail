---
audience: human, ai
summary: A set of charts that present data, metrics and KPIs together. OpenMetadata's Dashboard entity.
---

# Dashboard

A set of charts that present data, metrics and KPIs together. It is OpenMetadata's
[Dashboard](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/dashboards) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Dashboards](README.md).

- **Type:** `dashboard`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/dashboards`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields dashboard -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies a dashboard instance. |
| `name` | `entityName` | Yes | Name that identifies this dashboard. |
| `displayName` | `string` |  | Display Name that identifies this Dashboard. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a dashboard in the format 'ServiceName.DashboardName'. |
| `description` | `markdown` |  | Description of the dashboard, what it is, and how to use it. |
| `project` | `string` |  | Name of the project / workspace / collection in which the dashboard is contained |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `dashboardType` | `dashboardType` |  | This schema defines the type used for describing different types of dashboards. |
| `sourceUrl` | `sourceUrl` |  | Dashboard URL suffix from its service. |
| `charts` | `entityReferenceList` |  | All the charts included in this Dashboard. |
| `dataModels` | `entityReferenceList` |  | List of data models used by this dashboard or the charts contained on it. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `owners` | `entityReferenceList` |  | Owners of this dashboard. |
| `followers` | `entityReferenceList` |  | Followers of this dashboard. |
| `tags` | `tagLabel[]` |  | Tags for this dashboard. |
| `service` | `entityReference` | Yes | Link to service where this dashboard is hosted in. |
| `serviceType` | `dashboardServiceType` |  | Service type where this dashboard is hosted in. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this dashboard. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `domains` | `entityReferenceList` |  | Domains the Dashboard belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `lifeCycle` | `lifeCycle` |  | Life Cycle properties of the entity |
| `certification` | `assetCertification` |  | Defines the Asset Certification schema. |
| `sourceHash` | `string` |  | Source hash of the entity |
| `entityStatus` | `status` |  | Status of the Dashboard. |

<!-- /standard -->
