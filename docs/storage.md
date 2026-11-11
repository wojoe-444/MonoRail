---
audience: human
---

# Storage Manager

**Utilities > Storage** shows how full each drive is and what takes up the
space: MonoRail itself, your agents, developer caches and a few well-known
folders. It is there for the day the system drive runs out.

New to MonoRail? [Private data stays local](guide/private-data.md) explains what it keeps and why it never touches your folders on its own.

## It only looks

The page never deletes, moves, renames or copies anything it measures. The only
files it writes are its own history (below) and your free-space goals, both in MonoRail's data folder. Its only actions open a folder in Explorer and open the
Windows storage settings. That is on purpose: an earlier version of MonoRail
renamed a data folder on its own and caused trouble, so nothing in MonoRail
touches your folders without you.

## What it shows

- **Drives**: free and used space for every drive, read when the page opens.
  The system drive gets a warning when it has less than 5 GB (or 5%) free.
- **What takes up space**: measured when you press **Scan folders**, because
  walking big folders takes a while. Each folder may take 45 seconds; a size
  shown as "≥" stopped there, so the real size is larger. Each row shows how
  much it grew or shrank since the scan before.
- **Over time**: drive free space and folder sizes as a chart or a table.
  Pick one drive to zoom in on it; your goal shows as a dashed line.

## Free-space goal

Each drive card has **Set a free-space goal**: how many GB you want to keep
free on that drive (for example 50 GB on C:). The card then shows how close
you are, how much more to free, or "Goal met" with what is to spare, and the
[Over time](#what-it-shows) chart draws the goal as a dashed line in the
drive's color. **Change** edits or removes it.

A goal is only a target to aim for: setting one never deletes or moves
anything. Use the rows marked [Safe to clear](#history) and each tool's own
cleanup to get there. Goals belong to the computer, like the drives, so they
are the same in every [profile](profiles.md). They are kept in `goals.json` in
the Storage data folder (drive letters and numbers only), so an agent reading
the Storage history can find them there too.

## History

Every finished scan is saved to `history.json` in the Storage data folder
(`modules\storage` under MonoRail's data folder): free space per drive and, per
folder, its size, file count, path and largest items. While MonoRail runs it
also saves a drive-space sample every 6 hours, which is one cheap free-space
reading per drive; folders are only measured when you press Scan. The newest
500 snapshots are kept. After a restart the page shows the last saved scan.
Nothing leaves the computer.

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
