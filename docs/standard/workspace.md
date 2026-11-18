---
audience: human, ai
summary: MonoRail's own entity types for the workspace: notes, bookmarks, bookmark folders and scheduled tasks.
---

# Workspace

Entity types of MonoRail's own for everyday work. OpenMetadata has no words
for these, so the [MonoRail standard](README.md) defines them in its style
(see the [rules](README.md#rules)). All of them are listed on
[Explore](../guide/explore.md) under **Workspace**, next to the rest of
[your workspace](../guide/workspace/README.md).

<!-- standard:entities workspace -->

| Entity | Type | What it is | In MonoRail |
| --- | --- | --- | --- |
| [Note](workspace.md#note) | `note` | A Markdown note in Notes' local git repo. Explore shows its summary, not its text. | Home > Notes |
| [Bookmark](workspace.md#bookmark) | `bookmark` | A saved web address or local path. | Tools > Bookmarks |
| [Bookmark folder](workspace.md#bookmark-folder) | `bookmarkFolder` | A folder that groups bookmarks. Same record as a bookmark, with no target. | Tools > Bookmarks |
| [Scheduled task](workspace.md#scheduled-task) | `scheduledTask` | A task in Windows Task Scheduler. | Workspace > Scheduled |

<!-- /standard -->

## Note

A Markdown note kept in Notes' own local git repo ([Notes](../notes.md)).
Explore shows its summary (title, excerpt, word count), never the whole text.

<!-- standard:fields note -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | The file's name without `.md`. |
| `title` | `string` | Yes | The first line. |
| `excerpt` | `string` | Yes | The start of the text. |
| `updated` | `timestamp` | Yes | Last change to the file, ms since epoch. |
| `words` | `number` | Yes | Word count. |

<!-- /standard -->

## Bookmark

A saved web address or local path on the Bookmarks page.

<!-- standard:fields bookmark -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The bookmark's id. |
| `name` | `string` | Yes | Its name, up to 120 characters. |
| `description` | `string` | Yes | A note about it, up to 500 characters. |
| `target` | `string` | Yes | An http(s) address or an absolute local path. |
| `kind` | `enum` | Yes | Always `bookmark`. |
| `parentId` | `uuid` |  | The bookmark folder it is in; `null` at the top. |
| `color` | `string` |  | A `#rrggbb` color, or empty. |

<!-- /standard -->

## Bookmark folder

A folder that groups [bookmarks](#bookmark). It is the same record with `kind`
set to `folder` and no target.

<!-- standard:fields bookmarkFolder -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | The folder's id. |
| `name` | `string` | Yes | Its name, up to 120 characters. |
| `description` | `string` | Yes | A note about it, up to 500 characters. |
| `target` | `string` | Yes | Always empty. |
| `kind` | `enum` | Yes | Always `folder`. |
| `parentId` | `uuid` |  | The folder it is in; `null` at the top. |
| `color` | `string` |  | A `#rrggbb` color, or empty. |

<!-- /standard -->

## Scheduled task

A task in Windows Task Scheduler, as the Scheduled page reads it. MonoRail's
own in-app timers are not entities.

<!-- standard:fields scheduledTask -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | The task's name. |
| `path` | `string` | Yes | Its folder in Task Scheduler. |
| `description` | `string` | Yes | Its description. |
| `command` | `string` | Yes | What it runs. |
| `schedule` | `string` | Yes | When it runs, in words. |
| `state` | `string` | Yes | Ready, Running, Disabled and so on. |
| `lastRun` | `string` |  | When it last ran, or `null`. |
| `nextRun` | `string` |  | When it runs next, or `null`. |
| `result` | `number` |  | The last run's result code, or `null`. |
| `writable` | `boolean` | Yes | Whether MonoRail may change it. |

<!-- /standard -->
