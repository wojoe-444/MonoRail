---
audience: human, ai
summary: One data quality test run against a table, column or other asset. OpenMetadata's Test Case entity.
---

# Test Case

One data quality test run against a table, column or other asset. It is OpenMetadata's
[Test Case](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-quality/test-cases) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data quality](README.md).

- **Type:** `testCase`
- **Required:** `name`, `testDefinition`, `entityLink`, `testSuite`
- **API:** `/v1/dataQuality/testCases`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields testCase -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` |  | Unique identifier of this table instance. |
| `name` | `testCaseEntityName` | Yes | Name that identifies this test case. |
| `displayName` | `string` |  | Display Name that identifies this test. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `description` | `markdown` |  | Description of the testcase. |
| `testDefinition` | `entityReference` | Yes | Test definition that this test case is based on. |
| `entityLink` | `entityLink` | Yes | Link to the entity that this test case is testing. |
| `entityFQN` | `string` |  | (OpenMetadata gives no description for entityFQN.) |
| `testSuite` | `entityReference` | Yes | Basic Test Suite that this test case belongs to. |
| `testSuites` | `testSuite[]` |  | Basic and Logical Test Suites this test case belongs to |
| `parameterValues` | `testCaseParameterValue[]` |  | This schema defines the parameter values that can be passed for a Test Case. |
| `dataQualityDimension` | `entityReference` |  | Data quality dimension this test case belongs to. |
| `testCaseResult` | `testCaseResult` |  | Latest test case result obtained for this test case. |
| `testCaseStatus` | `testCaseStatus` |  | Status of Test Case run. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `owners` | `entityReferenceList` |  | Owners of this Pipeline. |
| `createdBy` | `string` |  | User who made the update. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `computePassedFailedRowCount` | `boolean` |  | Compute the passed and failed row count for the test case. |
| `autoCloseIncident` | `boolean` |  | Automatically resolve an open incident when a subsequent test result succeeds. |
| `incidentId` | `uuid` |  | Reference to an ongoing Incident ID (stateId) for this test case. |
| `incidentStatus` | `testCaseResolutionStatus` |  | Latest incident resolution status for this test case. |
| `failedRowsSample` | `tableData` |  | Sample of failed rows for this test case. |
| `inspectionQuery` | `sqlQuery` |  | SQL query to retrieve the failed rows for this test case. |
| `domains` | `entityReferenceList` |  | Domains the test case belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this test case is part of. |
| `followers` | `entityReferenceList` |  | Followers of this test case. |
| `useDynamicAssertion` | `boolean` |  | If the test definition supports it, use dynamic assertion to evaluate the test case. |
| `tags` | `tagLabel[]` |  | Tags for this test case. |
| `dimensionColumns` | `string[]` |  | List of columns to group test results by dimensions. |
| `topDimensions` | `integer` |  | Number of top dimension values to show before grouping the rest as Others. |
| `entityStatus` | `status` |  | Current status of the test case. |
| `reviewers` | `entityReferenceList` |  | List of reviewers for this entity. |

<!-- /standard -->
