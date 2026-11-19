---
audience: human
summary: Read and edit Dataform .sqlx files with the config block as a form, so the SQL has the page to itself.
---

# SQLX files

**SQLX**, under **Tools**, opens the `.sqlx` files of a Dataform project. A
`.sqlx` file starts with a `config { ... }` block that says what the file
makes (a table, a view, an incremental table, an assertion), where it goes and
how. SQLX turns that block into a form on the right, so the SQL in the middle
of the page gets the room.

Like the rest of your [workspace](README.md), it works on your computer only:
files are read where they are and saved back in place, as
[private data stays local](../private-data.md) promises.

## Open a project

1. Select **Add project** and pick the folder of a Dataform project (the one
   with `workflow_settings.yaml` or `dataform.json`).
2. Its `.sqlx` files are listed on the left, grouped by folder. Type in
   **Find a file** to narrow the list.
3. Select a file to open it.

To look at a single file without adding its project, drag it onto the page or
select **Paste SQLX** after copying its text. Those files can be changed and
copied, but not saved. Removing a project from the list (the **...** menu next
to it) never touches its files.

## The page

- **Config (right).** Each field of the config block, in sections: Target
  (type, name, dataset, project), About (description, tags), Run (dependencies,
  disabled, unique key), BigQuery (partitioning, clustering, labels), Data
  quality (assertions) and Columns. Tags and column lists are chips: type a
  name and press Enter. **Add field** offers the fields that fit the file's
  type. A value written as JavaScript (a variable, a function call) is kept as
  code and marked with a `{ }` sign.
- **Query (middle).** The SQL, with `${ref("...")}` and other JavaScript
  inside `${ }` drawn as soft chips. Above it, every table the query reads with
  `ref()`; select one to open its file.
- **Blocks.** `js`, `pre_operations` and `post_operations` show as folding
  panels above and below the query. **+ Block** adds one.
- **Source.** Switch to **Source** to see and edit the whole file as text.
  Use it for anything the form cannot show, such as comments inside the
  config: changing a field rewrites the block without them, and the page warns
  you first.

## Saving

**Save** (or Ctrl+S) writes the file back. If the file changed on disk since
you opened it (another editor, a `git pull`), MonoRail refuses to overwrite it
and offers **Reload from disk**; copy your changes first if you want to keep
them. Undo all changes with the arrow button next to Save.

## Related

- [Browse your repos](browse-repos.md) to see the project's history and
  changes in GitHub+.
- [BigQuery](bigquery.md) to run the SQL against your data.
- The [semantic project](../setup/semantic.md) page covers dbt and MetricFlow,
  the other common way to model warehouse data.
