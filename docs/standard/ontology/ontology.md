---
audience: human, ai
summary: An independently governed ontology namespace. OpenMetadata's Ontology entity.
---

# Ontology

An independently governed ontology namespace. It is OpenMetadata's
[Ontology](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/data/ontology.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Ontology](README.md).

- **Type:** `ontology`
- **Required:** `id`, `name`, `fullyQualifiedName`, `iri`, `namespace`
- **API:** `/v1/ontologies`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server (they are new in 2.1, so an older server has none), and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields ontology -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique id used to identify an entity. |
| `name` | `entityName` | Yes | Name that identifies an entity. |
| `displayName` | `string` |  | Display name that identifies this entity. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` | Yes | A unique name that identifies an entity. |
| `description` | `markdown` |  | Text in Markdown format. |
| `owners` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `reviewers` | `entityReferenceList` |  | This schema defines the EntityReferenceList type used for referencing an entity. |
| `version` | `entityVersion` |  | Metadata version of the entity in the form `Major.Minor`. |
| `updatedAt` | `timestamp` |  | Timestamp in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | URI that points to a resource. |
| `changeDescription` | `changeDescription` |  | Description of the change. |
| `incrementalChangeDescription` | `changeDescription` |  | Description of the change. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `iri` | `ontologyIri` | Yes | Stable semantic identity of this ontology; independent of its name and catalog record IRI. |
| `namespace` | `ontologyIri` | Yes | Absolute namespace used to mint persistent IRIs for native definitions. |
| `layer` | `layer` |  | Governance layer of an ontology model. |
| `prefixes` | `prefix[]` |  | A compact IRI prefix and its absolute namespace. |
| `installedPacks` | `ontologyPackInstallation[]` |  | Verified library packs installed into this ontology, one entry per pack ID. |
| `publicationStatus` | `ontologyPublicationStatus` |  | Publication state derived by the server from ontology releases. |
| `approvalRule` | `ontologyApprovalRule` |  | How many reviewers must approve a release review. |

<!-- /standard -->
