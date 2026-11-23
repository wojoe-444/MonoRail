---
audience: human
folder: Setup
summary: Configure MonoRail: accounts, appearance, backups, updates, spending limits, phone access, extensions and Developer Mode.
---

# Set up and look after MonoRail

MonoRail works immediately after install and turns nothing on without asking
([private data stays local](../private-data.md)). Configure what you use here:

- **[Connect your accounts](connections.md)** — Claude, GitHub, Atlassian,
  Google Cloud, pi, Docker, OpenMetadata and more.
- **[Run it without installing](run-from-source.md)** — start MonoRail from a
  copy of its code in your own browser, no setup `.exe` needed.
- **[Make it look right](appearance.md)** — color schemes, frosted backdrops,
  light/dark mode and full screen.
- **[Backups and updates](backups-and-updates.md)** — scheduled local backups,
  restore steps and automatic app updates.
- **[Spending limit](spending-limit.md)** — daily or monthly USD caps for
  MonoRail-run agent turns.
- **[Use MonoRail from your phone](remote-access.md)** — opt-in private
  Tailscale access.
- **[Add extensions](extensions.md)** — install community pages, apps and agent
  tools safely.
- **[Saving your changes](saving.md)** — how the sticky Save bar confirms
  writes.
- **[Developer Mode](developer-mode.md)** — element inspector, DevTools and the
  blank **New User** test profile.

Looking for data connections and pipelines? See
[Data & catalog](../data/README.md). For drive usage, see
[Storage](../workspace/storage.md).

## Finding your way around Settings

Click **Settings** at the bottom of the sidebar to open its sub-navigation:

- **App**: **General** (version, updates, profile, spending limit,
  [Developer Mode](developer-mode.md)), **Appearance** and **Backups**. When
  something needs action (expired [connection](connections.md), failed
  [backup](backups-and-updates.md), ready
  [update](backups-and-updates.md#updates) or pending
  [extension](extensions.md)), a **Needs attention** card appears at the top of
  General and badges the Settings button.
- **Accounts & access**: **Connections**,
  [Agent access](../agents/agent-access.md), **Remote access** and
  **Extensions**.
- **Data**: [Services](../data/services.md).

Use the search box above the Settings menu (or **Ctrl+K** for app-wide
[search](../search.md)) to jump straight to any option.

See the [desktop shell reference](../../contributing/desktop-shell.md#settings-and-search)
for how Settings pages, alerts and search are wired.
