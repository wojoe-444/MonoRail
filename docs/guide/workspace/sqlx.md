---
audience: human
summary: Read and edit Dataform .sqlx files in tabs, with the config block as settings, a column table and checks instead of code.
---

# SQLX files

**SQLX**, under **Tools**, opens the `.sqlx` files of a Dataform project. A
`.sqlx` file starts with a `config { ... }` block that says what the file
makes (a table, a view, an incremental table, an assertion), where it goes and
how. SQLX splits the file into tabs: the SQL gets one to itself, and the
config block becomes settings, a column table and checks, so you never have to
edit it as code.

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

Above the tabs are the file's name, its type and where it goes (project,
dataset and name), with the first line of its description.

- **Query.** The SQL, with `${ref("...")}` and other JavaScript inside `${ }`
  drawn as soft chips. Above it, every table the query reads with `ref()`;
  select one to open its file.
- **Settings.** The config's fields as a form, in sections: Target (type, name,
  dataset, project), About (description, tags), Run (dependencies, disabled,
  unique key) and BigQuery (partitioning, clustering, labels). Tags and column
  lists are chips: type a name and press Enter. **Add field** offers the fields
  that fit the file's type. A value written as JavaScript (a variable, a
  function call) is kept as code and marked with a `{ }` sign.
- **Columns.** One row per described column: its name and description, both
  editable in place. **Not null** turns on a check that the column is never
  empty; **Key** marks columns in the unique key. **Add column** adds a row.
- **Tests.** The checks Dataform runs after the table is built: not-null
  columns, a unique key and row conditions (SQL every row must satisfy).
  **Add check** adds one. An assertion file is a test itself, so it has none.
- **Pre / post ops.** The `js`, `pre_operations` and `post_operations` blocks
  as folding panels, with a button to add each one the file lacks.
- **Raw file.** The whole file as text, config included. Use it for anything
  the other tabs cannot show, such as comments inside the config: changing a
  value elsewhere rewrites the block without them, and the page warns you
  first.

The numbers on the tabs count the columns, checks and extra blocks.

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
