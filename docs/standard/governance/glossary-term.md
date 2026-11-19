---
audience: human, ai
summary: One business term in a glossary, with its definition, synonyms and related terms. OpenMetadata's Glossary Term entity.
---

# Glossary Term

One business term in a glossary, with its definition, synonyms and related terms. It is OpenMetadata's
[Glossary Term](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/glossary-terms) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `glossaryTerm`
- **Required:** `id`, `name`, `description`, `glossary`
- **API:** `/v1/glossaryTerms`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields glossaryTerm -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of a glossary term instance. |
| `name` | `entityName` | Yes | Preferred name for the glossary term. |
| `displayName` | `string` |  | Display Name that identifies this glossary. |
| `description` | `markdown` | Yes | Description of the glossary term. |
| `style` | `style` |  | UI Style is used to associate a color code and/or icon to entity to customize the look of that entity in UI. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | A unique name that identifies a glossary term. |
| `iri` | `string` |  | Canonical IRI of this term in its source ontology (e.g., `http://example.com/ontology/hcp#HealthcareProvider`). |
| `synonyms` | `entityName[]` |  | Alternate names that are synonyms or near-synonyms for the glossary term. |
| `glossary` | `entityReference` | Yes | Glossary that this term belongs to. |
| `parent` | `entityReference` |  | Parent glossary term that this term is child of. |
| `children` | `entityReferenceList` |  | Other glossary terms that are children of this glossary term. |
| `relatedTerms` | `termRelation[]` |  | Other glossary terms that are related to this glossary term with typed semantic relations. |
| `references` | `termReference[]` |  | Link to a reference from an external glossary. |
| `conceptMappings` | `conceptMapping[]` |  | Optional mappings to external concepts (e.g., SKOS alignments). |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `reviewers` | `entityReferenceList` |  | User names of the reviewers for this glossary. |
| `owners` | `entityReferenceList` |  | Owners of this glossary term. |
| `usageCount` | `integer` |  | Count of how many times this and it's children glossary terms are used as labels. |
| `tags` | `tagLabel[]` |  | Tags associated with this glossary term. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `entityStatus` | `status` |  | Approval status of the glossary term. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System glossary can't be deleted. |
| `mutuallyExclusive` | `boolean` |  | Glossary terms that are children of this term are mutually exclusive. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `domains` | `entityReferenceList` |  | Domains the Glossary Term belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `childrenCount` | `integer` |  | Count of immediate children glossary terms. |

<!-- /standard -->
