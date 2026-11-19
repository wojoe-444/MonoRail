---
audience: human, ai
summary: Static information computed from data on a schedule: text, tables and visuals. OpenMetadata's Report entity.
---

# Report

Static information computed from data on a schedule: text, tables and visuals. It is OpenMetadata's
[Report](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/report.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Dashboards](README.md).

- **Type:** `report`
- **Required:** `id`, `name`, `service`
- **API:** `/v1/reports`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields report -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier that identifies this report. |
| `name` | `entityName` | Yes | Name that identifies this report instance uniquely. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a report in the format 'ServiceName.ReportName'. |
| `displayName` | `string` |  | Display Name that identifies this report. |
| `description` | `markdown` |  | Description of this report instance. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this report. |
| `owners` | `entityReferenceList` |  | Owners of this Report. |
| `service` | `entityReference` | Yes | Link to service where this report is hosted in. |
| `usageSummary` | `usageDetails` |  | Latest usage information for this database. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `votes` | `votes` |  | Votes on the entity. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `entityStatus` | `status` |  | Status of the Report. |

<!-- /standard -->
