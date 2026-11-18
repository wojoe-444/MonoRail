---
audience: human, ai
summary: A collection of business terms in a hierarchy. OpenMetadata's Glossary entity.
---

# Glossary

A collection of business terms in a hierarchy. It is OpenMetadata's
[Glossary](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance/glossaries) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Data governance](README.md).

- **Type:** `glossary`
- **Required:** `id`, `name`, `description`
- **API:** `/v1/glossaries`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields glossary -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of a glossary instance. |
| `name` | `entityName` | Yes | Name of the glossary |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as name. |
| `displayName` | `string` |  | Display Name that identifies this glossary. |
| `description` | `markdown` | Yes | Description of the glossary. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `reviewers` | `entityReference[]` |  | User references of the reviewers for this glossary. |
| `owners` | `entityReferenceList` |  | Owners of this glossary. |
| `usageCount` | `integer` |  | Count of how many times terms from this glossary are used. |
| `tags` | `tagLabel[]` |  | Tags for this glossary. |
| `termCount` | `integer` |  | Total number of terms in the glossary. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `provider` | `providerType` |  | Type of provider of an entity. |
| `disabled` | `boolean` |  | System glossary can't be deleted. |
| `mutuallyExclusive` | `boolean` |  | Glossary terms that are direct children in this glossary are mutually exclusive. |
| `domains` | `entityReferenceList` |  | Domains the Glossary belongs to. |
| `dataProducts` | `entityReferenceList` |  | List of data products this entity is part of. |
| `dataContract` | `entityReference` |  | Reference to the data contract for this entity. |
| `votes` | `votes` |  | Votes on the entity. |
| `extension` | `entityExtension` |  | Entity extension data with custom attributes added to the entity. |
| `entityStatus` | `status` |  | Status of the Glossary. |
| `namespaces` | `object[]` |  | Namespace prefix to IRI mappings for terms imported from an external ontology. |

<!-- /standard -->
