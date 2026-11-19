---
audience: human, ai
summary: How MonoRail tells you a change is saved, and when it is safe to leave a page.
---

# Saving your changes

Some settings save as a group: you change a few things, then save them all
at once. On those cards a **Save bar** appears while there is something to
save. You'll find it on [Backups](backups-and-updates.md#backups),
[Spending limit](spending-limit.md), your profile name in **Settings >
General**, and a repository's **Backups** tab in
[GitHub+](../workspace/browse-repos.md#backups).

## What the bar says

- **A yellow dot and "2 unsaved changes"**: you changed something that
  isn't saved yet. **Save** saves it all, **Discard** puts the card back the
  way it was saved. If Save can't run yet, the bar says why, for example
  "Choose a folder first".
- **"Saving…"**: MonoRail is writing your changes.
- **A green tick and "Saved. Safe to leave."**: your changes are written to
  your [data folder](../private-data.md#where-your-data-lives) and you can go
  to another page. This only shows once the save has finished, never before.
  It goes away after a few seconds.
- **"Couldn't save."** with the reason: nothing was lost from the card.
  Fix what it says and press **Try again**, or **Discard** to go back to what
  was saved.

The bar stays at the bottom of the window while you scroll the card, so you
can always see it. When there is nothing to save, there is no bar.

## Settings that save straight away

Switches that take effect the moment you flip them, such as turning
[Remote access](remote-access.md) on or off or picking a
[color scheme](appearance.md), don't use the bar. They save the moment you
change them.

## For developers

The bar is `SaveBar` in `src/components/ui/save-bar.tsx`, with
`countChanges(saved, draft)` for the count. Use it for forms that keep a
draft and save as a unit. Put it last inside the form's container, outside
any element with `overflow: hidden`, so it can stick to the bottom of the
scrolling area. Set `savedAt` only after the backend confirms the write, and
pass save errors as `error` rather than showing them elsewhere.
