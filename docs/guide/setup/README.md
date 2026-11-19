---
audience: human
folder: Setup
summary: Make MonoRail yours and keep it healthy: accounts, look, backups, updates and extensions.
---

# Set up and look after MonoRail

MonoRail works the moment it is installed, and does nothing it was not asked
to. These pages cover what you can turn on, in roughly the order people get
to them:

- [Connect your accounts](connections.md): Claude, GitHub, Jira, Google
  Cloud, pi and more, each one only once you add it.
- [Make it look right](appearance.md): color schemes, light and dark.
- [Backups and updates](backups-and-updates.md): copy your work to a safe
  folder on a schedule, and keep the app current.
- [Add extensions](extensions.md): pages, apps and agent tools built
  by others.
- [Spending limit](spending-limit.md): cap what agents started from
  MonoRail can spend each day or month. Off until you turn it on.
- [Saving your changes](saving.md): the Save bar, and how to tell a
  change is saved and it is safe to leave the page.
- [Developer Mode](developer-mode.md): name any part of the screen in
  feedback, and try MonoRail as a brand new user.
- [Use MonoRail from your phone](remote-access.md): reach MonoRail on
  your PC from your phone over your own private Tailscale network. Off
  until you turn it on.
- [Docker](docker.md): if you use Docker, see your containers, logs and
  images under **Tools > Docker**, and open lazydocker in one click.
- [Services and ingestion pipelines](services.md): read SQLite databases,
  dbt projects and your OpenMetadata server's sources into a catalog on a
  schedule, under **Settings > Services**.
- [Semantic (MetricFlow)](semantic.md): connect your dbt project's metrics
  and MetricFlow, for Explore, Services and your agents.

Two pages are worth knowing before you change anything:

- [Private data stays local](../private-data.md): where everything is kept,
  and what never leaves your computer.
- [Storage](../../storage.md): how much space MonoRail, your agents and their
  caches take up, under **Tools > Storage**.

## Finding your way around Settings

Everything on these pages lives behind the **Settings** button at the bottom
of the left-hand menu. Settings has its own menu beside the page:

- **App**: **General** opens first (version, updates, your profile and
  [Developer Mode](developer-mode.md)), then **Appearance** and **Backups**.
  When something needs you right now, such as a [connection](connections.md)
  whose sign-in expired, a [backup](backups-and-updates.md) that failed, an
  [update](backups-and-updates.md#updates) that is ready, or an
  [extension](extensions.md) waiting for your approval, a **Needs attention**
  card appears at the top of General and the Settings button shows how many.
- **Accounts & access**: **Connections**, [Agent access](../agents/agent-access.md)
  and **Extensions**.

The search box above that menu finds any page or option by name, for example
"token", "dark mode" or "backup folder". Use the arrow keys and Enter to open a
result, and MonoRail scrolls to the part of the page you picked. **Ctrl+K**
opens the app-wide [search](../search.md) on its Settings results, which
finds the same options plus pages, chats and the catalog.
