---
audience: human, ai
summary: A local file explorer with tabs, split view, previews, pinned folders, color tags and Recycle Bin safety.
---

# Files

**Tools > Files** is a local file explorer for Windows with tabs, dual-pane
split view, live previews, pinned folders and color tags — sitting alongside
[Notes](notes.md) in [your workspace](README.md).

## Finding your way

- **Tabs**: **+** (`Ctrl+T`) opens a tab, `Ctrl+W` or middle-click closes it,
  `Ctrl+Tab` switches; tabs restore on reopen.
- **Split view**: open two folders side by side in one tab. Drag between panes
  to move (hold **Ctrl** to copy).
- **Path bar**: click segments to jump up, or press `Ctrl+L` to type a path
  (`~` expands to your home folder).
- **Sidebar**: quick folders (Desktop, Documents, Downloads, Repos, OneDrive),
  pins, color tags, drive fullness (see [Storage](storage.md) for deep scans)
  and recent folders.
- **Filter & search**: typing filters the current folder immediately; press
  **Enter** (or **Subfolders**) to search recursively with `*`/`?` wildcards
  (capped at 500 matches / 8 s).

## Three ways to look

- **Details**: sortable table (name, date, type, size).
- **Grid**: tile thumbnails (images, videos, PDFs via Windows shell).
- **Columns**: Miller-column tree navigation.

Hidden/system files stay hidden unless you toggle the eye icon.

## The preview panel

Preview images, text/code, rendered or raw Markdown, and thumbnails for videos,
PDFs and Office files without opening them. Folders show item counts, optional
on-demand size calculation, and for git [repositories](../glossary.md#repository)
their [branch](../glossary.md#branch) plus an **Open in GitHub+** button
([GitHub+](browse-repos.md)).

## Pins and color tags

Right-click a folder to **Pin** it, or tag any file/folder with a color (click a
color in the sidebar to list all tagged items). Pins and tags live in your
[profile](../../profiles.md) preferences — never written into the files — and
follow items renamed or moved inside Files.

## Changing things

Supports new folder/file, rename (`F2`), cut/copy/paste (never overwrites; adds
`" (2)"`). **Delete always moves to the Recycle Bin** after confirmation — there
is no permanent delete. **Open** launches Windows' default app.

## Keyboard

| Keys | Action |
| --- | --- |
| Arrows / `Home` / `End` | Navigate (`Shift`/`Ctrl` for multi-select) |
| `Enter` / `Backspace` / `Alt+Up` | Open / up one folder |
| `Alt+Left` / `Alt+Right` | Back / forward |
| `F2` / `Delete` | Rename / move to Recycle Bin |
| `Ctrl+A` / `Ctrl+Shift+C` / `Ctrl+Shift+N` | Select all / copy path / new folder |
| `Ctrl+F` / `F5` | Filter or search / refresh |

## Privacy and limits

Listings, thumbnails and previews stay strictly in memory
([private data stays local](../private-data.md)). Unavailable over phone
[Remote access](../setup/remote-access.md).

## For developers

Backend `electron/modules/files.cjs` (`files.test.cjs`, declared `NOT_CACHED`);
UI `src/modules/files/` (`sample.ts` for browser preview). Paths validated via
`absPath`/`checkName`; limits: 20k entries/dir, 256 KB text / 12 MB image
preview, 60k entries / 500 hits / 8 s search, 400k entries / 20 s folder size;
symlinks/junctions never followed; `trash` uses `shell.trashItem` only;
the [Remote access policy](../../remote-access.md#phone-coverage). Prefs under `monorail.files.*`.
