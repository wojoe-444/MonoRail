---
audience: human, ai
summary: Sealed ontology content, reviewed through the approval workflow. OpenMetadata's Ontology Release entity.
---

# Ontology Release

Sealed ontology content, reviewed through the approval workflow. It is OpenMetadata's
[Ontology Release](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontologyRelease.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontologyRelease`
- **Required:** `id`, `name`, `fullyQualifiedName`, `ontology`, `entityStatus`, `releaseRevision`, `sourceWorkingRevision`, `ontologyIri`, `versionIri`, `encodingVersion`, `contentDigest`, `memberCount`, `totalBytes`, `sealedAt`, `sealedBy`, `logicalCheck`
- **API:** `/v1/ontologyReleases`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontologyRelease -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `id` | Yes | Unique id used to identify an entity. |
| `name` | `name` | Yes | Name that identifies an entity. |
| `displayName` | `displayName` |  | Display name that identifies this entity. |
| `fullyQualifiedName` | `fullyQualifiedName` | Yes | A unique name that identifies an entity. |
| `description` | `description` |  | Text in Markdown format. |
| `ontology` | `ontology` | Yes | Owning ontology entity. |
| `owners` | `owners` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `reviewers` | `reviewers` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `version` | `version` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `updatedAt` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `updatedBy` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | URI that points to a resource. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `incrementalChangeDescription` |  | Description of the change. |
| `deleted` | `deleted` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `provider` |  | Type of provider of an entity. |
| `entityStatus` | `status` | Yes | General lifecycle stage for entities that reference this vocabulary. |
| `reviewAuthor` | `string` |  | Author of the current governed content revision; assigned by the server. |
| `reviewTask` | `uuid` |  | Current approval task, assigned by the existing workflow infrastructure. |
| `approvalBasis` | `enum` |  | Why this release was approved. |
| `releaseRevision` | `integer` | Yes | Monotonic release number allocated under the owning ontology state lock. |
| `semanticVersion` | `string` |  | Immutable semantic version allocated by the server. |
| `releaseNotes` | `string` |  | Immutable publication notes preserved exactly as captured, independently of the semantic content digest. |
| `sourceWorkingRevision` | `workingRevision` | Yes | Monotonic revision of committed working-model mutations. |
| `ontologyIri` | `ontologyIri` | Yes | Absolute semantic IRI, preserved exactly without URL normalization, case folding, or percent encoding. |
| `versionIri` | `ontologyIri` | Yes | Absolute semantic IRI, preserved exactly without URL normalization, case folding, or percent encoding. |
| `encodingVersion` | `enum` | Yes | Canonical manifest and member encoding used to reproduce the digest. |
| `contentDigest` | `string` | Yes | SHA-256 of the sealed manifest, including ordered member identities and payload digests. |
| `memberCount` | `integer` | Yes | (OpenMetadata gives no description for memberCount.) |
| `totalBytes` | `integer` | Yes | Total UTF-8 size of canonical member payloads. |
| `sealedAt` | `timestamp` | Yes | Timestamp in Unix epoch time milliseconds. |
| `sealedBy` | `string` | Yes | (OpenMetadata gives no description for sealedBy.) |
| `logicalCheck` | `enum` | Yes | Logical consistency has not been checked. |
| `baseReleaseId` | `uuid` |  | Active release at capture, retained as the immutable review comparison baseline. |
| `changeSummary` | `ontologyReleaseChangeSummary` |  | Member change counts against baseReleaseId, assigned by the server at capture. |

<!-- /standard -->
