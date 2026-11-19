---
audience: human
summary: Schedule automatic local backups to a synced folder, restore any item, and keep MonoRail up to date safely.
---

# Backups and updates

## Backups

Copy your local MonoRail data into a folder on a schedule (for example, a folder
synced by OneDrive). MonoRail writes only to the folder you pick and never
uploads anything itself.

1. Open **Settings > Backups**.
2. Pick a folder, frequency (e.g. *3 times a day*) and how many copies to keep.
3. Enable backups and press **Save** on the [Save bar](saving.md).

Each feature writes into its own subfolder, and **Back up now** runs
immediately:

- [GitHub+](../workspace/browse-repos.md#backups) repos (with
  [local issues](../workspace/local-issues.md)) — per-repo settings override the
  global folder/schedule;
- [Tasks](../workspace/tasks.md#private-projects) private projects;
- [Flashcards](../workspace/flashcards.md) decks;
- [Notes](../workspace/notes.md);
- [Flows](../agents/flows.md#versions) with full version history;
- [OpenMetadata](../data/openmetadata.md) local catalog,
  [Tracker](../workspace/tracker.md) and [pipelines](../data/services.md) (the
  local database).

Missed backups catch up when MonoRail opens. Changing the backup folder applies
only to future backups — old copies are never moved or deleted
([private data stays local](../private-data.md#what-monorail-reads-and-leaves-alone)).

## Restoring from a backup

Close MonoRail first, then restore the file from your backup subfolder:

| Item | Backup format | How to restore |
| --- | --- | --- |
| GitHub+ repo | `github-plus\<repo>\*.bundle` | `git clone "<file>" <name>` |
| Tasks private projects | `jira-plus\*.bundle` | `git clone "<file>"` and replace `apps\jira-plus\local-repo` in your data folder |
| Flashcards | `flashcards\*.json` | Copy over `modules\flashcards\decks.json` |
| Notes | `notes\*.bundle` | `git clone "<file>" repo` and replace `modules\notes\repo` |
| Flows | `flows\*.bundle` | `git clone "<file>" repo` and replace `modules\flows\repo` |
| Local database | `local-database\*.sqlite3` | Replace `databases\local.sqlite3` and remove any `local.sqlite3-wal` / `-shm` next to it |

## Updates

Updates never reset your data. Before any local-database schema migration,
MonoRail writes a full copy beside the original and aborts if copying fails
([local database details](../../local-database.md#updates-keep-your-data)).

MonoRail checks for releases 30 seconds after launch and every 4 hours (or via
**Settings > General > Check for updates**). When an update is available, a
pop-up shows **what's new** (full version-grouped history lives in **Settings >
General**) with **Download and Restart**, **Ignore for six hours** or **×**.

**Automatic pre-update backup:** when a backup folder is configured, MonoRail
backs up Tasks private projects, Notes, Flashcards, Flows and the local database
into `before-update\` (keeping the last 5 of each) right before installing. If
a pre-update backup fails, installation pauses so you can **Try again** or
**Update without a backup**. Disable via **Back up before updating** in
**Settings > Backups**.

If the installer reports locked files, see the
[installer FAQ](../faq.md#the-installer-says-failed-to-uninstall-old-application-files).

## Related

- [Setup overview](README.md) · [Storage](../workspace/storage.md) ·
  [Backups reference](../../backups.md) (for developers)
