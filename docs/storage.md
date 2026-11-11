# Storage Manager

**Utilities > Storage** shows how full each drive is and what takes up the
space: MonoRail itself, your agents, developer caches and a few well-known
folders. It is there for the day the system drive runs out.

## It only looks

The page never deletes, moves, renames or copies anything, and it writes
nothing to disk. Its only actions open a folder in Explorer and open the
Windows storage settings. That is on purpose: an earlier version of MonoRail
renamed a data folder on its own and caused trouble, so nothing in MonoRail
touches your folders without you.

## What it shows

- **Drives**: free and used space for every drive, read when the page opens.
  The system drive gets a warning when it has less than 5 GB (or 5%) free.
- **What takes up space**: measured when you press **Scan folders**, because
  walking big folders takes a while. Each folder may take 45 seconds; a size
  shown as "≥" stopped there, so the real size is larger. The result stays in
  memory while MonoRail runs and is gone when it closes.

Each folder is marked:

| Mark | Meaning |
| --- | --- |
| Safe to clear | A cache its tool downloads again. The row names the tool's own cleanup command (for example `npm cache clean --force`). |
| Check first | May hold things you want: your Downloads, repos, agent logs. |
| In use | Needed as it is: MonoRail's data folder, the installed app, the page file. |

Older MonoRail data folders (from the MonoHub and Command Hub names) are listed
when they exist. MonoRail is not using them, and it never removes them; look
inside before you do.

## How it measures

Sizes add up the size of every file. Links and junctions are listed but never
followed, so a folder is not counted twice. Files that OneDrive keeps only in
the cloud are counted at their full size even though they take no space on
the drive. Folders it cannot read are skipped and counted in the row's
details.

The backend is `electron/modules/storage.cjs`; a test checks it contains no
call that writes, moves or deletes.
