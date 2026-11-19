---
audience: human
summary: Inspect drive usage, track MonoRail and developer cache sizes over time, and set free-space goals — strictly read-only.
---

# Storage Manager

**Tools > Storage** tracks drive fullness and the size of MonoRail, agent logs,
developer caches and common folders. To browse or move files yourself, use
[Files](files.md); for Docker disk usage, see [Docker](docker.md). For a ranked
cleanup plan, add **Storage Detective** from the
[Template Catalog](../agents/catalog.md) (reads the last scan via MCP
`storage_scan` without deleting anything).

## It only looks

Strictly read-only: never deletes, moves or renames any measured folder (only
opens Explorer or Windows Storage Settings, and writes its own scan history and
goals in your [data folder](../private-data.md#where-your-data-lives)).

## What it shows

- **Drives**: live free/used space per drive (warns under 5 GB or 5% on the
  system drive).
- **Scan insights**: largest measured folders and growth vs. an earlier scan
  (timed-out folders excluded from growth comparisons).
- **What takes up space**: measured on demand via **Scan folders** (45 s cap per
  folder; `≥` marks capped sizes) with delta from the prior scan.
- **Over time**: chart/table of drive free space and folder history with your
  goal line.

## Free-space goal

Click **Set a free-space goal** on any drive card (e.g. 50 GB free on `C:`) to
track distance to goal on the card and [Over time](#what-it-shows) chart. Goals
are targets only, shared across [profiles](../../profiles.md) in `goals.json`.

## History

Completed scans and 6-hourly drive-space samples save to `modules\storage\history.json`
(newest 500 snapshots, local only). Each folder is labeled:

| Mark | Meaning |
| --- | --- |
| **Safe to clear** | Rebuildable cache; shows the tool's cleanup command (e.g. `npm cache clean --force`) |
| **Check first** | May contain personal work (Downloads, repos, agent logs) |
| **In use** | Active system or MonoRail folders |

Legacy MonoRail data folders (MonoHub / Command Hub) are listed when present and
never touched automatically.

## How it measures

Sums file sizes without following symlinks/junctions; unreadable folders are
skipped and counted; OneDrive cloud-only files report logical size. Backend:
`electron/modules/storage.cjs` (verified write-free by tests).
