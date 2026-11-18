---
audience: human, ai
summary: Reusable context for AI-assisted search and answers. OpenMetadata's Context Memory entity.
---

# Context Memory

Reusable context for AI-assisted search and answers. It is OpenMetadata's
[Context Memory](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/context/contextMemory.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Context center](README.md).

- **Type:** `contextMemory`
- **Required:** `id`, `name`
- **API:** `/v1/contextCenter/memories`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/explore.md) lists the type with 0.

## Fields

<!-- standard:fields contextMemory -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of the memory. |
| `name` | `entityName` | Yes | Stable system name for the memory. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | Fully qualified name of the memory. |
| `displayName` | `string` |  | Display name of the memory. |
| `description` | `markdown` |  | Optional markdown description for the memory. |
| `title` | `string` |  | Short title shown in Context Center. |
| `summary` | `string` |  | Optional summary of the memory. |
| `question` | `string` |  | Canonical question or instruction represented by this memory. |
| `answer` | `string` |  | Canonical answer or retained guidance represented by this memory. |
| `memoryType` | `memoryType` |  | High-level type of reusable memory. |
| `memoryScope` | `memoryScope` |  | Scope where the memory should be applied. |
| `entityStatus` | `contextMemoryStatus` |  | Lifecycle stage of the memory: Unprocessed (awaiting reconciliation), Draft, Approved (in use), Superseded (replaced), Invalidated (found incorrect) or Archived. |
| `statusReason` | `string` |  | Why the memory reached its current status, e.g. |
| `lastReviewedAt` | `timestamp` |  | When this memory was last confirmed to hold: set whenever it becomes Approved, and each time Memory Reconciliation revalidates it. |
| `lastContentUpdatedAt` | `timestamp` |  | Server-owned timestamp of the latest change to memory content or its subject. |
| `supersededBy` | `entityReference` |  | The memory that replaced this one. |
| `disputes` | `memoryDispute[]` |  | Unresolved conflicts that hold this Draft memory in review, one per contradicting memory. |
| `pinned` | `boolean` |  | Whether this memory is globally pinned in Context Center. |
| `shareConfig` | `shareConfig` |  | Visibility and sharing configuration for the memory. |
| `primaryEntity` | `entityReference` |  | Primary entity this memory should attach to for reuse. |
| `relatedEntities` | `entityReferenceList` |  | Additional related entities this memory applies to. |
| `sourceType` | `sourceType` |  | How the memory was created. |
| `sourceConversation` | `uuid` |  | Conversation identifier that produced this memory. |
| `sourceHumanMessage` | `uuid` |  | Human message identifier used to produce this memory. |
| `sourceAssistantMessage` | `uuid` |  | Assistant message identifier used to produce this memory. |
| `sourceFile` | `entityReference` |  | Deprecated: use sourceEntity. |
| `sourceEntity` | `entityReference` |  | The Context Center entity (file or page) this memory was extracted from. |
| `rootMemory` | `entityReference` |  | Root memory in an append-style memory thread. |
| `parentMemory` | `entityReference` |  | Immediate parent memory in an append-style thread. |
| `machineRepresentation` | `machineRepresentation` |  | Optional machine-oriented representation used for prompt packing. |
| `memoryStats` | `memoryStats` |  | Telemetry + hash-gate for the Memory Agent derivation of this memory. |
| `derivedEntities` | `entityReferenceList` |  | Derived: glossary terms and metrics created by the Memory Agent from this memory (DERIVED_FROM edges, agent-owned). |
| `reusedEntities` | `entityReferenceList` |  | Derived: glossary terms and metrics reused (not created) by the Memory Agent from this memory (RELATED_TO edges). |
| `usageCount` | `integer` |  | How many times this memory has been used in AI-assisted retrieval. |
| `lastUsedAt` | `timestamp` |  | Last time the memory was used by AI-assisted retrieval. |
| `outcomes` | `memoryOutcomes` |  | Outcome counters of the answers this memory was applied to. |
| `owners` | `entityReferenceList` |  | Owners of this memory. |
| `tags` | `tagLabel[]` |  | Tags associated with this memory. |
| `domains` | `entityReferenceList` |  | Domains this memory belongs to. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to this resource. |
| `changeDescription` | `changeDescription` |  | Change that led to this version. |
| `incrementalChangeDescription` | `changeDescription` |  | Incremental change that led to this version. |
| `deleted` | `boolean` |  | When true indicates the entity has been soft deleted. |

<!-- /standard -->
