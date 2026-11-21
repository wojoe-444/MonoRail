---
audience: ai
summary: How navigation, development, Settings, scheduling and releases fit together.
---

# Desktop shell and lifecycle

The [developer reference](README.md) covers the feature backends. The
[repository guide](../../CLAUDE.md) has the module registration steps and commands.

## Routing and the renderer bridge

`src/components/layout/nav.ts` assembles the rail and its one level of child
destinations. A module sets `nav.parent` to join a parent such as `/tools`.
`NavFlyout` in `SideNav.tsx` lists the parent's destination first, followed
by its children. Rail width stays fixed when the flyout opens. `ToolsPage.tsx`
uses the same destinations. Match a nested app route to its child item to keep
the rail and breadcrumb current, and preserve existing URLs.

`electron/preload.cjs` exposes `window.commandHub`: module invocations, the
extension push events and `window:fullscreen`, and full-screen helpers.
`electron/window-fullscreen.cjs` supports F11 and the top bar button. The
Vite-only browser preview uses fictional data. `npm run dev:browser` uses
a windowless Electron process (`electron/dev-bridge.cjs`), its own
`%APPDATA%\MonoRail Dev` folder and the shared bridge in `electron/bridge/`:
loopback, token and origin checks, JSON requests and server-sent events.
The `monorail-ext://` scheme needs Electron. See [Remote access](../remote-access.md)
for the separately enabled tailnet bridge and method policy.

## Workspace and full-screen apps

Workspace apps (`placement: 'workspace'`) appear under Tools. The rail and
top bar stay visible. `AppBody` in `App.tsx` gives the app its own scrollable
page body. `RouteErrorBoundary` keeps navigation available on route errors.
`src/apps/session.ts` remembers nested routes when leaving and returning.
Clicking an app's own nav item while inside it returns to its start page.

Full-screen apps (the default placement, including all extension apps)
appear on `src/pages/AppsPage.tsx`. Its rail item appears only when an app
is available. `src/apps/AppFrame.tsx` owns the 48px hub bar and its **Back
to MonoRail** button, which returns to the originating page. Preserve that
exit and the error boundary even if the app takes over the whole window.
Reopening the app resumes its route.

An app root receives `basePath` and may host its own hash router under that
prefix. Scope styles to the app root (GitHub+ uses `.ghp`) and avoid class
names that collide with Tailwind utilities. Restore any defaults the app
needs within that scope. See [GitHub+ and Tasks](git-workspace.md) and
[extension concepts](../extensions/concepts.md).

## Settings and search

Modules with `nav.section: 'Settings'` are wrapped in
`src/modules/settings/SettingsLayout.tsx`. `nav.group` labels their group.
General (`/settings`) opens from the pinned Settings button. Its
`SettingsAlerts` card reads connection summaries, the updater, the last
[backup](../backups.md) results and extension health from the shared
`alerts.ts` store. Alerts refresh on focus (throttled), every five minutes
and on `refreshSettingsAlerts()`. They read existing state and start no
checks. Add each new card or option and its element id to
`SEARCH_ENTRIES` in `src/modules/settings/search.ts`.

`src/components/search/store.ts` opens the palette with
`openSearch({ scope, section, query })`. The body loads on open. Sources
are Pages, Catalog types, non-archived Chats, Settings and Wiki.
`page-index.ts` also powers Home's page and Settings search. Ctrl+K defaults
to the Settings scope on a Settings page and is reserved for the hub outside
full-screen apps. Empty search shows up to five targets from
`monorail.search.recent` in `prefs` and categories from the
[MonoRail standard](../standard/README.md). Keep paths out of recents. Catalog
handoff is in memory via `openInExplore`. See the [search guide](../guide/search.md).

## Tour and Developer Mode

The [tour](../guide/first-ten-minutes.md#take-the-tour) is in
`src/components/tour/`. `TourHost` points step definitions at
`data-tour="<target>"` elements (`nav:<path>` for rail items). Center the
card when a target is missing. It opens once per profile at widths of at
least 768px and writes `commandHub.tour.seen` on close. Home and Settings
can reopen it.

[Developer Mode](../guide/setup/developer-mode.md) is off by default and
machine-wide (`commandHub.devMode`). `DeveloperModeCard.tsx` owns its
Settings card. The inspector in `src/components/dev/` walks React fibers
to name components, and Vite preserves those names with Rolldown
`output.keepNames`. `electron/modules/developer.cjs` handles DevTools.
[New User](../profiles.md#new-user-developer-modes-test-profile) uses a
separate test profile and shows a way back in the top bar.

## Scheduled jobs

The Scheduled page shows Windows Task Scheduler via `scheduled.ps1` and
MonoRail's own jobs in **In-App**. New timers register from `start(ctx)` with
`registerProvider({ id, list, run? })` in `electron/scheduled/in-app.cjs`.
`list()` reports title, schedule, state, last/next run, result and owning
page from existing job state, and starts no work. The registry stores no
files. Expose `run` only for safe manual jobs, and keep `runInApp` blocked
on the phone. See [caching](../caching.md) and [backups](../backups.md).

## Updates and release notes

Keep the package name and installer app ID stable so Windows upgrades
in place. `latest.yml` tells `electron-updater` which installer asset to
fetch. The settings backend checks after startup and every four hours.
`src/modules/settings/UpdateToast.tsx` shows the update prompt. Ignore
snoozes it for six hours (`commandHub.updateSnoozeUntil`), and closing
it hides it until the next check. [Pre-update backups](../backups.md#back-up-before-updating)
use the settings backend before launching the installer.

`scripts/release-notes.cjs` builds public release notes from PRs merged
since the previous release. `electron/release-notes.cjs` parses the
`## What's new` bullets and supports PR-title fallbacks. Follow the
[PR template](../../.github/pull_request_template.md). The settings backend
fetches the public releases between the installed and available versions.
`WhatsNew.tsx` renders them in Settings and in the update pop-up.
The manual **Release notes** workflow can rewrite older releases.
