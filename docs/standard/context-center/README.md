---
audience: human, ai
folder: Context center
summary: Files, folders and reusable context memory for AI-assisted work.
---

# Context center

Files, folders and reusable context memory for AI-assisted work. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

## Entity types

<!-- standard:entities contextCenter -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Folder](folder.md) | `folder` | A folder in the context center drive; folders can hold folders. | `/v1/contextCenter/drive/folders` |
| [Context File](context-file.md) | `contextFile` | A file uploaded to the context center drive, such as a PDF or spreadsheet. | `/v1/contextCenter/drive/files` |
| [Context File Content](context-file-content.md) | `contextFileContent` | A stored snapshot of a context file's content. | none of its own |
| [Context Memory](context-memory.md) | `contextMemory` | Reusable context for AI-assisted search and answers. | `/v1/contextCenter/memories` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
