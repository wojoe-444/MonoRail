---
audience: human, ai
summary: A SQL query run against data assets, with who ran it, when and what it cost. OpenMetadata's Query entity.
---

# Query

A SQL query run against data assets, with who ran it, when and what it cost. It is OpenMetadata's
[Query](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/query.json) entity, adopted as it is (see the
[rules](../../README.md#rules)), in [Databases](README.md).

- **Type:** `query`
- **Required:** `id`, `name`, `query`, `service`
- **API:** `/v1/queries`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields query -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the query. |
| `name` | `entityName` | Yes | Name of an entity to which the query belongs to |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of a query. |
| `displayName` | `string` |  | Display Name that identifies this Query. |
| `description` | `markdown` |  | Description of a query. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the query. |
| `createdAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds corresponding to when this entity was created in OpenMetadata. |
| `createdBy` | `string` |  | User or Bot who created this entity in OpenMetadata. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this Query resource. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `owners` | `entityReferenceList` |  | Owners of this Query. |
| `duration` | `number` |  | How long did the query took to run in milliseconds. |
| `users` | `entityReference[]` |  | List of users who ran this query. |
| `followers` | `entityReferenceList` |  | Followers of this Query. |
| `votes` | `votes` |  | Votes on the entity. |
| `query` | `sqlQuery` | Yes | SQL Query definition. |
| `query_type` | `string` |  | SQL query type |
| `exclude_usage` | `boolean` |  | Flag to check if query is to be excluded while processing usage |
| `checksum` | `string` |  | Checksum to avoid registering duplicate queries. |
| `queryDate` | `timestamp` |  | Date on which the query ran. |
| `usedBy` | `string[]` |  | List of users who ran the query but does not exist in OpenMetadata. |
| `tags` | `tagLabel[]` |  | Tags for this SQL query. |
| `queryUsedIn` | `entityReferenceList` |  | Entities that are using this query |
| `triggeredBy` | `entityReference` |  | Entity that triggered the query. |
| `processedLineage` | `boolean` |  | Flag if this query has already been successfully processed for lineage |
| `service` | `entityReference` | Yes | Link to the service this query belongs to. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `entityStatus` | `status` |  | Status of the Query. |

<!-- /standard -->
