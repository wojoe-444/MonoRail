---
audience: human, ai
folder: Collaboration
summary: Tasks, announcements, knowledge pages and learning resources.
---

# Collaboration

Tasks, announcements, knowledge pages and learning resources. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

## Entity types

<!-- standard:entities collaboration -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Task](task.md) | `task` | A work item, such as an access request or a glossary approval, assigned to people. | `/v1/tasks` |
| [Task Form Schema](task-form-schema.md) | `taskFormSchema` | The form used to create or resolve one kind of task. | `/v1/taskFormSchemas` |
| [Announcement](announcement.md) | `announcement` | A notice on a data asset, shown between a start and an end time. | `/v1/announcements` |
| [Page](page.md) | `page` | A knowledge page: an article or note in the knowledge center. | `/v1/contextCenter/pages` |
| [Learning Resource](learning-resource.md) | `learningResource` | A tutorial, video or link to guidance, shown where it helps in the product. | `/v1/learning/resources` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
