---
audience: human, ai
summary: A file explorer for your PC with tabs, split view, previews, pins and color tags.
---

# Files

**Files** (under Tools in the menu) is a file explorer for your PC. It does
what Windows File Explorer does for everyday work, and adds tabs, two panes
side by side, a preview panel, pinned folders and color tags. It sits next to
[Notes](notes.md) and the other [workspace pages](guide/workspace/README.md).

## Finding your way

The page fills the whole window under the top bar. The top bar holds the
page's name, your folder tabs and, on the right, the split, preview and
**New** buttons. Below it, one toolbar row has back, forward, up and refresh,
the path, the filter box, the file actions (cut, copy, paste, rename, tag,
Recycle Bin) and the view and sort buttons. A status line under the folder
counts the items and the selection, and names the git branch when the folder
is in a repository.

- **Tabs.** Press **+** (or Ctrl+T) for a new tab, Ctrl+W closes one, Ctrl+Tab
  moves between them. Middle-click a tab to close it. Your tabs are still there
  the next time you open the page.
- **Split view.** The split button in the top bar shows two folders side by
  side in one tab. The highlighted pane is the one the toolbar acts on. Drag
  items from one pane onto the other (or onto any folder) to move them; hold
  Ctrl while dropping to copy instead.
- **The path bar.** Click a part of the path to go there, or click an empty
  spot (Ctrl+L) to type a path. `~` means your home folder.
- **The sidebar** lists your usual folders (Desktop, Documents, Downloads, a
  `Repos` folder if you have one, OneDrive), your pinned folders, color tags,
  each drive with how full it is, and folders you opened recently. For a deeper
  look at what fills a drive, use [Storage](storage.md).
- **Filter and search.** Typing in the search box filters the open folder at
  once. Press Enter (or the **Subfolders** button) to also look in every folder
  below it. `*` and `?` work as wildcards, such as `*.pdf`. A search stops
  after 500 matches or a few seconds and says so; narrow it down if that
  happens.

## Three ways to look

- **Details**: a table you can sort by name, date, type and size (click a column
  heading).
- **Grid**: big tiles with real thumbnails for pictures, videos and PDFs, the
  same ones Windows shows.
- **Columns**: each folder you click opens in a new column to its right, so a
  deep folder tree is easy to walk through.

Hidden items (dot files, `desktop.ini` and Windows' own system files) are left
out unless you press the eye button.

## The preview panel

Select something to see it on the right without opening it: pictures, text and
code, Markdown rendered (or as source), and a thumbnail for videos, PDFs and
Office files. It also shows the size, dates and where the item is. For a folder
it counts what is inside, can **work out** its full size, and when the folder
is a git [repository](guide/glossary.md#repository) it shows the
[branch](guide/glossary.md#branch) and a button that opens it in
[GitHub+](guide/workspace/browse-repos.md).

## Pins and color tags

Right-click a folder and choose **Pin** to keep it in the sidebar. Give any file
or folder a color tag from the right-click menu, the toolbar's tag button or
the preview panel; click a color in the sidebar to see everything with that
tag in one list. Pins and tags are your own [profile](profiles.md)
preferences: they stay in MonoRail and are never written into the files.
Renaming or moving an item in Files keeps its pin and tag.

## Changing things

New folder, new text file, rename (F2), cut, copy and paste (Ctrl+X, Ctrl+C,
Ctrl+V) work as in Explorer. Pasting next to an item with the same name adds
" (2)" instead of replacing it, and nothing is ever overwritten.

**Deleting always goes to the Recycle Bin**, after you confirm, so you can bring
things back until the bin is emptied. Files has no permanent delete.

**Open** uses the program Windows normally uses for that file, the same as
double-clicking it in Explorer, so only open files you trust.

## Keyboard

| Keys | Does |
| --- | --- |
| Arrow keys, Home, End | Move through the list |
| Shift + arrows, Ctrl + click | Select several |
| Enter | Open |
| Backspace, Alt+Up | Up one folder |
| Alt+Left, Alt+Right | Back, forward |
| Typing letters | Jump to the first name that starts with them |
| F2 | Rename |
| Delete | Move to the Recycle Bin |
| Ctrl+A | Select all |
| Ctrl+Shift+C | Copy the path |
| Ctrl+Shift+N | New folder |
| Ctrl+F | Filter or search |
| F5 | Refresh |

## Privacy and limits

Files reads your folders only while the page is open and keeps nothing: no
listing, preview, thumbnail or search result is saved, as
[private data stays local](guide/private-data.md) promises. It never touches a
file unless you ask it to. It is not available from a phone through
[Remote access](guide/setup/remote-access.md): your PC's files stay on the PC.

## For developers

- Backend `electron/modules/files.cjs` (tests `files.test.cjs`); page
  `src/modules/files/`. Data folder scope `modules/files` (profile; keeps no
  files, declared in `NOT_CACHED`).
- Every path from the page is checked by `absPath` (absolute, no NUL,
  normalized); typed names by `checkName` (Windows' rules, reserved names).
- Bounds: 20,000 entries per listing, 256 KB text preview, 12 MB image preview,
  search 60,000 entries / 500 results / 8 s, folder size 400,000 entries / 20 s.
  Walks never follow links or junctions; a search skips `node_modules` and
  `.git` unless hidden items are shown.
- Writes: `createFolder`, `createFile` (`wx`, never overwrites), `rename`
  (refuses an existing target except a change of letter case), `paste`
  (copy or move; `uniqueTarget` picks "name (2)"; a move across drives copies,
  then removes the original), `trash` (`shell.trashItem` only). `open`,
  `reveal` and `trash` are `desktopOnly`; Remote access refuses the whole
  backend (`files: ['*']` in `REMOTE_DENY`).
- Thumbnails come from `nativeImage.createThumbnailFromPath` (Windows shell),
  cached in the page's memory only. The git branch is read from `.git/HEAD`;
  no git process runs.
- Pins, tags, tabs, recent folders and view options are prefs
  (`monorail.files.*`, `src/lib/prefs.ts`). The browser dev server shows the
  fictional folders in `sample.ts`.
