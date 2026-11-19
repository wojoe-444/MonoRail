---
audience: human
summary: Read and edit Dataform .sqlx files with their config block as structured settings, column tables and checks.
---

# SQLX files

**Tools > SQLX** opens Dataform `.sqlx` files and splits them into structured
tabs so the SQL gets its own editor while the `config { ... }` block becomes
form fields, a column table and checks. Files are read and saved locally in
place ([private data stays local](../private-data.md)).

## Open a project

1. Click **Add project** and pick a Dataform project folder (containing
   `workflow_settings.yaml` or `dataform.json`).
2. Browse `.sqlx` files by folder on the left or filter with **Find a file**.
3. Click any file to open it.

To inspect a standalone file without adding a project, drop it onto the page or
click **Paste SQLX** (editable and copyable, not saved to disk). Removing a
project from the sidebar never touches files on disk.

## The page

The header shows the file's name, type, target (`project.dataset.name`) and
summary line.

- **Query**: SQL with `${ref("...")}` and `${ ... }` expressions rendered as
  chips; click referenced tables above the editor to jump to their files.
- **Settings**: structured form for Target, About, Run and BigQuery options
  (partitioning, clustering, labels). JavaScript values keep a `{ }` badge.
- **Columns**: editable table of column names and descriptions, with **Not
  null** and **Key** toggles.
- **Tests**: post-build assertions (not-null columns, unique key, custom row
  conditions; omitted on assertion files).
- **Pre / post ops**: collapsible `js`, `pre_operations` and `post_operations`
  blocks.
- **Raw file**: full source text (use this when preserving comments inside
  `config { }`; editing in other tabs warns before rewriting the block).

## Saving

Press **Save** (`Ctrl+S`) to write back to disk. If the file changed externally
(e.g. `git pull`), MonoRail refuses to overwrite and offers **Reload from
disk**. The undo arrow beside Save reverts unsaved edits.

## Related

- [Browse your repos](../workspace/browse-repos.md) · [BigQuery](bigquery.md) ·
  [Semantic (MetricFlow)](semantic.md) · [Data & catalog](README.md)
