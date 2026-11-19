---
audience: human
summary: Inspect UI component names for feedback, open Chromium DevTools, and test MonoRail in a clean New User profile.
---

# Developer Mode

Turn on **Settings > General > Developer Mode** to unlock testing and feedback
tools without affecting anything else in MonoRail.

## Name what you see: the element inspector

Identify the exact React component behind any part of the screen when giving
feedback:

1. Press `Ctrl+Shift+C`, click the pointer icon in the top bar, or click
   **Inspect** on the Developer Mode card.
2. Hover any element to see its component name (e.g. `Card`, `PageHeader`,
   `StatTile`) and dimensions.
3. Click to pin and auto-copy the component, parent hierarchy, text and page —
   ready to paste into [Chat](../agents/chat.md).

Press **Esc** to exit; press **F12** for full Chromium DevTools. See the
[glossary](../glossary.md) for MonoRail's user-facing terms.

## Try MonoRail as a new user

Switch into a hidden, blank **New User** profile to verify the first-run
experience (such as [your first ten minutes](../first-ten-minutes.md)):

- **Switch to New User** wipes and restarts into a clean profile.
- An amber **New User · test profile** chip stays in the top bar (even if
  Developer Mode is turned off) with a **Back to** button to return.
- **Start over blank** resets New User again in place.

Your real profile ([connections](connections.md),
[backups](backups-and-updates.md), data) is never touched. Machine-shared items
(installed [extensions](extensions.md), Claude Stats, Storage) still appear. See
[Profiles](../../profiles.md#new-user-developer-modes-test-profile) and
[private data stays local](../private-data.md).
