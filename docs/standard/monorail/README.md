---
audience: human, ai
folder: MonoRail
summary: Entity types of MonoRail's own, for things OpenMetadata has no word for: subagents, flows, notes, bookmarks, flashcards and a dbt project's semantic layer.
---

# MonoRail's own entity types

Most of the [MonoRail standard](../README.md) is OpenMetadata's. These
categories are MonoRail's own, for things OpenMetadata has no word for. They
follow the same style and never reuse an OpenMetadata type name (see the
[rules](../README.md#rules)).

<!-- standard:categories monorail -->

| Category | What it covers | Entity types |
| --- | --- | --- |
| [Agents](agents.md) | Subagents and flows. | Subagent, Flow |
| [Workspace](workspace.md) | Notes, bookmarks and scheduled tasks. | Note, Bookmark, Bookmark folder, Scheduled task |
| [Learning](learning.md) | Flashcard decks and cards. | Flashcard deck, Flashcard |
| [Semantic](semantic.md) | A dbt project's semantic layer: semantic models, metrics and saved queries. | Semantic model, Metric, Saved query |

<!-- /standard -->

Prompt templates were MonoRail's own until OpenMetadata 2.1 added a
[Prompt Template](../data-assets/ai/prompt-template.md) entity for the same
thing. MonoRail now uses that one.
