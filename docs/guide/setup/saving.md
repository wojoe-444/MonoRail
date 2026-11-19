---
audience: human, ai
summary: How the sticky Save bar confirms writes and tells you when it is safe to leave a settings card.
---

# Saving your changes

Forms that save several options together — [Backups](backups-and-updates.md#backups),
[Spending limit](spending-limit.md), your profile name in **Settings > General**,
and repo backups in [GitHub+](../workspace/browse-repos.md#backups) — display a
sticky **Save bar** at the bottom of the window whenever you have unsaved edits.

## What the bar says

- **Yellow dot ("N unsaved changes")**: click **Save** to write or **Discard**
  to revert (explains why if Save is disabled, e.g. *"Choose a folder first"*).
- **"Saving…"**: write in progress.
- **Green tick ("Saved. Safe to leave.")**: confirmed written to your
  [data folder](../private-data.md#where-your-data-lives); clears after a few
  seconds.
- **"Couldn't save."**: shows the error without losing your edits — fix and
  **Try again**, or **Discard**.

## Settings that save straight away

Instant controls — such as [Remote access](remote-access.md) toggles or
[Appearance](appearance.md) choices — write immediately without a Save bar.

## For developers

Use `SaveBar` (`src/components/ui/save-bar.tsx`) with `countChanges(saved, draft)`.
Place it last in the form container (outside any `overflow: hidden` ancestor),
update `savedAt` only after backend write confirmation, and pass errors via
`error`.
