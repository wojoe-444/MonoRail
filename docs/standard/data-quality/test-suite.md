---
audience: human, ai
summary: A set of test cases run together. OpenMetadata's Test Suite entity.
---

# Test Suite

A set of test cases run together. It is OpenMetadata's
[Test Suite](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-quality/test-suites) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data quality](README.md).

- **Type:** `testSuite`
- **Required:** `name`
- **API:** `/v1/dataQuality/testSuites`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields testSuite -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this test suite instance. |
| `name` | `testSuiteEntityName` | Yes | Name that identifies this test suite. |
| `displayName` | `string` |  | Display Name that identifies this test suite. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Description of the test suite. |
| `tests` | `entityReference[]` |  | This schema defines the EntityReference type used for referencing an entity. |
| `connection` | `testSuiteConnection` |  | TestSuite mock connection, since it needs to implement a Service. |
| `testConnectionResult` | `testConnectionResult` |  | Result of the test connection. |
| `pipelines` | `entityReferenceList` |  | References to pipelines deployed for this Test Suite to execute the tests. |
| `serviceType` | `enum` |  | Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... |
| `owners` | `entityReferenceList` |  | Owners of this TestCase definition. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `basic` | `boolean` |  | Indicates if the test suite is basic, i.e., the parent suite of a test and linked to an entity. |
| `executable` | `boolean` |  | DEPRECATED in 1.6.2: Use 'basic' |
| `basicEntityReference` | `entityReference` |  | Entity reference the test suite needs to execute the test against. |
| `executableEntityReference` | `entityReference` |  | DEPRECATED in 1.6.2: Use 'basicEntityReference'. |
| `dataContract` | `entityReference` |  | Reference to the data contract that this test suite is associated with. |
| `summary` | `testSummary` |  | Summary of the previous day test cases execution for this test suite. |
| `testCaseResultSummary` | `resultSummary[]` |  | Summary of test case execution |
| `domains` | `entityReferenceList` |  | Domains the test Suite belongs to. |
| `tags` | `tagLabel[]` |  | Tags for this test suite. |
| `inherited` | `boolean` |  | Indicates if the test suite is inherited from a parent entity. |
| `ingestionRunner` | `entityReference` |  | Link to the ingestion pipeline that ingested this entity. |
| `reviewers` | `entityReferenceList` |  | List of reviewers for this entity. |

<!-- /standard -->
