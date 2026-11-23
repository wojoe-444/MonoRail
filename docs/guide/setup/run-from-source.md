---
audience: human
summary: Run MonoRail from a copy of its code in your own browser, without installing the .exe.
---

# Run MonoRail without installing it

You can run MonoRail straight from a copy of its code instead of installing
the setup `.exe`. It then opens in your normal web browser, on your own PC
only, with all your real data: [connections](connections.md),
[Chat](../agents/chat.md), [backups](backups-and-updates.md) and the rest
work as they do in the installed app.

## What you need

- **Windows** with **Node.js 22 or newer** (from nodejs.org).
- **Git**, if you want to update with one command (a downloaded zip of the
  code works too).
- A copy of the code: `git clone https://github.com/wojoe-444/MonoRail.git`.

## Start it

1. Double-click **Start MonoRail.cmd** in the top folder of the copy. (From
   a terminal: `cd apps/command-hub`, `npm ci` once, then `npm start`.)
2. The first start installs MonoRail's packages and builds its pages. That
   takes a few minutes; later starts take seconds.
3. Your browser opens MonoRail. **Keep the black MonoRail window open**:
   closing it (or pressing Ctrl+C in it) stops MonoRail.

If you close the browser tab, open the link the MonoRail window shows again.
It changes every time MonoRail starts, and only that link opens it: nothing
else on the PC or the network can use MonoRail through the browser without it.

## Your data

MonoRail keeps your data in the same folder the installed app uses (see
[private data stays local](../private-data.md)), so you can switch between
the two and keep everything. **Run only one of them at a time**: the start
window refuses to start while the installed app is open, and a second start
just opens the copy that is already running.

To try it with a separate, empty data folder instead, start it with
`npm start -- --data <folder>`.

## Updates

This copy does not update itself, and **Settings > General** says so instead
of offering [updates](backups-and-updates.md#updates). To update, stop
MonoRail, run `git pull` in its folder, and start it again. It sees the new
code and rebuilds its pages by itself. If MonoRail says packages are
missing, Start MonoRail.cmd installs them; from a terminal, run `npm ci`.

## What works differently in the browser

Almost everything works as in the installed app, including system dialogs
for picking folders and opening folders in Explorer. A few things need
MonoRail's own window:

- The pages of [extensions](extensions.md) don't open. Their agent tools and
  background work still run.
- Folder pickers and other system dialogs may open behind your browser.
  Look for them on the taskbar.

[Developer Mode](developer-mode.md)'s New User profile works: switching
restarts MonoRail and the tab reloads once it is back.
[Use MonoRail from your phone](remote-access.md) also works, the same as in
the installed app.

## Options

Add these after `npm start --` (or after `Start MonoRail.cmd` in a terminal):

| Option | What it does |
| --- | --- |
| `--port 5181` | Use another port than 5180, e.g. when something else uses it. |
| `--rebuild` | Build the pages again even if the code did not change. |
| `--no-open` | Don't open the browser; use the link in the window. |
| `--data <folder>` | Use another data folder instead of the installed app's. |

How it works inside is in the
[developer reference](../../contributing/desktop-shell.md#self-hosted-mode).
