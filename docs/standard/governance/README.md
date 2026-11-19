---
audience: human, ai
folder: Data governance
summary: Domains, data products, glossaries, classifications, tags and governance workflows.
---

# Data governance

Domains, data products, glossaries, classifications, tags and governance workflows. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/governance).

## Entity types

<!-- standard:entities governance -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Domain](domain.md) | `domain` | A bounded context aligned with a business unit or function, such as Marketing. | `/v1/domains` |
| [Data Product](data-product.md) | `dataProduct` | A unit of data assets that a team owns and offers to others as a product. | `/v1/dataProducts` |
| [Glossary](glossary.md) | `glossary` | A collection of business terms in a hierarchy. | `/v1/glossaries` |
| [Glossary Term](glossary-term.md) | `glossaryTerm` | One business term in a glossary, with its definition, synonyms and related terms. | `/v1/glossaryTerms` |
| [Classification](classification.md) | `classification` | A set of tags for classifying data, such as PII or Tier. | `/v1/classifications` |
| [Tag](tag.md) | `tag` | One label in a classification, used to tag data assets. | `/v1/tags` |
| [Workflow Definition](workflow-definition.md) | `workflowDefinition` | A governance workflow: its trigger, nodes and edges, such as a glossary approval. | `/v1/governance/workflowDefinitions` |
| [Intake Form](intake-form.md) | `intakeForm` | The fields asked for when someone creates or changes a domain, data product or glossary term. | `/v1/governance/intakeForms` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
