---
audience: human, ai
summary: A generated evidence pack for a framework, domain or AI asset. OpenMetadata's Audit Report entity.
---

# Audit Report

A generated evidence pack for a framework, domain or AI asset. It is OpenMetadata's
[Audit Report](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/ai/auditReport.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [AI assets](README.md).

- **Type:** `auditReport`
- **Required:** `id`, `name`, `scope`, `format`, `status`
- **API:** `/v1/auditReports`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields auditReport -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier |
| `name` | `entityName` | Yes | Unique short name for this report |
| `displayName` | `string` |  | Display name for the audit report |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FQN that uniquely identifies the audit report |
| `description` | `markdown` |  | Free-text description / notes attached to this report |
| `framework` | `entityReference` |  | Framework this audit pack is scoped to (omit for an estate-wide multi-framework pack) |
| `scope` | `reportScope` | Yes | Breadth of the audit pack |
| `scopeTarget` | `entityReference` |  | Reference to the domain or asset when scope is not Estate |
| `format` | `reportFormat` | Yes | Artifact format(s) to generate |
| `status` | `reportStatus` | Yes | Current state of the audit pack job |
| `asOfDate` | `timestamp` |  | Snapshot date — the pack assembles state as it was at this time |
| `includeRedacted` | `boolean` |  | Whether to include normally-redacted evidence (DPIAs, model cards, etc.) |
| `requestedBy` | `entityReference` |  | User who requested the report |
| `requestedAt` | `timestamp` |  | When the report was requested |
| `startedAt` | `timestamp` |  | When job execution started |
| `completedAt` | `timestamp` |  | When job execution finished (success or failure) |
| `failureReason` | `string` |  | Stack/message if status=Failed |
| `runningOn` | `string` |  | Identifier of the server node that claimed and is running this job. |
| `requestSignature` | `string` |  | Deterministic hash of the request parameters (scope, target, framework, format, asOfDate, includeRedacted). |
| `artifacts` | `artifact[]` |  | Generated artifacts available for download |
| `manifest` | `manifest` |  | Top-level inventory included in the pack |
| `owners` | `entityReferenceList` |  | Owners of this audit report |
| `tags` | `tagLabel[]` |  | Tags for this audit report |
| `domains` | `entityReferenceList` |  | Domains the audit report belongs to |
| `version` | `entityVersion` |  | Metadata version of the entity |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds |
| `updatedBy` | `string` |  | User who made the update |
| `href` | `href` |  | Link to this entity |
| `changeDescription` | `changeDescription` |  | Change that led to this version of the entity |
| `incrementalChangeDescription` | `changeDescription` |  | Change that led to this version of the entity |
| `deleted` | `boolean` |  | When true, indicates the entity has been soft deleted |
| `extension` | `entityExtension` |  | Custom extension JSON |

<!-- /standard -->
