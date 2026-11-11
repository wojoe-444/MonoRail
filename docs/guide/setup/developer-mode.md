---
audience: human
summary: Turn on Developer Mode to name any part of the screen in feedback, open DevTools, and try MonoRail as a brand new user.
---

# Developer Mode

Developer Mode adds tools for testing MonoRail and giving feedback on it. It
is off until you turn it on in **Settings > Developer mode**, and turning it
off hides the tools again. Nothing else in MonoRail changes.

## Name what you see: the element inspector

When you describe something in MonoRail, it helps to use the name the code
uses for it. The inspector shows you that name.

1. Press **Ctrl+Shift+C**, click the pointer icon at the top of the window,
   or press **Inspect** on the Developer mode card.
2. Hover over anything. A label shows the component that draws it, for
   example `Card`, `PageHeader` or `StatTile`, and its size.
3. Click it. A small panel pins the details and copies them for you: the
   component, the part it sits in, its text and the page. Paste that into
   your feedback, for example to [an agent in Chat](../agents/chat.md).

Press **Esc** to stop inspecting. **F12** opens the full Chromium DevTools,
the same tools a web browser has, if you want to look deeper. The
[glossary](../glossary.md) explains the words MonoRail itself uses.

## Try MonoRail as a new user

The **New User** profile is a hidden, empty profile for seeing MonoRail the
way a first-time user does, for example to check the
[first ten minutes](../first-ten-minutes.md) still make sense.

- **Switch to New User** restarts MonoRail into it. Anything you made there
  last time is wiped first, so it is always a blank slate.
- While it is open, an amber **New User · test profile** chip sits at the top
  of the window. **Back to** your name restarts into your own profile. The
  chip stays even if you turn Developer Mode off.
- **Start over blank** wipes New User again without leaving it.

Your own profile, its [connections](connections.md),
[backups](backups-and-updates.md) and everything else are never touched.
What this computer shares between profiles, such as installed
[extensions](extensions.md), Claude Stats and Storage, still shows in New
User. The developer details are in [Profiles](../../profiles.md#new-user-developer-modes-test-profile),
and where your data lives is in [private data stays local](../private-data.md).
