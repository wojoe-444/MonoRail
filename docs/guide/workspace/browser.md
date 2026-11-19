---
audience: human
summary: An isolated, tabbed in-app web browser with persistent per-profile sign-ins that never touches Chrome.
---

# Browser

**Tools > Browser** is a tabbed web browser built into MonoRail — enter a URL or
search term in the address bar.

## Sign-ins

Sign in once and stay signed in across restarts, completely separate from Chrome:

- **Isolated from Chrome**: Chrome locks its credentials and MonoRail never
  reads them.
- **Per [profile](../glossary.md#profile)**: the blank **New User** test profile
  always starts signed out.
- **Sign out of all sites** (eraser button): wipes cookies, sessions and cache
  for the active profile without touching Chrome.
- Session state stays locally on disk
  ([private data stays local](../private-data.md)).

## Tabs and buttons

`Ctrl+T` / **+** opens a tab, `Ctrl+W` or middle-click closes it, `Ctrl+L`
focuses the address bar, `Ctrl+R` / `F5` reloads, and open tabs restore next
time. Use **Open in your browser** (arrow button) to hand a page off to your
default browser.

## What it won't do

Sites cannot access your camera, microphone, location or notifications, and the
Browser is desktop-only (unavailable over phone
[Remote access](../setup/remote-access.md)).

Keep saved links in Bookmarks or jot excerpts in [Notes](notes.md)
([your workspace](README.md)).
