---
audience: human
summary: Read-only dashboard for local Docker containers, live logs, CPU/memory stats, images, volumes and one-click lazydocker.
---

# Docker

**Tools > Docker** gives a read-only, lazydocker-inspired view of Docker on your
PC — containers, live logs, resource usage, images and volumes — and can launch
lazydocker in a terminal when installed.

## Docker is optional

Off until you add **Docker** on [Connections](../setup/connections.md)
([nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)).
MonoRail never installs Docker or lazydocker.

## Set it up

1. Start Docker Desktop (or Docker Engine inside WSL).
2. Open **Settings > Connections > Docker**, click **Set up**, choose whether to
   detect lazydocker, and click **Save and check**.

MonoRail checks your current Windows PATH, Docker Desktop's install folder and
WSL distros without needing a restart (expand the Docker row on Connections to
see every location checked, or click **Start Docker Desktop** if the engine is
stopped).

## What the page shows

- **Header strip & tiles**: engine version, allocated CPU/RAM, running/unhealthy
  containers, live CPU/RAM load and reclaimable disk space.
- **Containers** (grouped by Compose project):
  - **Logs**: last 500 lines with **Follow** and highlighted errors.
  - **Stats**: 5-second live CPU/memory chart (in memory only, never saved).
  - **Info**: command, ports, mounts, networks, labels and env-var *names* only
    (values stay hidden).
- **Images, Volumes & Networks**: sorted largest first, flagging dangling build
  images.

## It only looks

Never starts, stops or deletes anything. Use **Open lazydocker**, Docker Desktop
or `docker system prune` to make changes, and [Storage](storage.md) to track
overall drive usage.

## lazydocker

Uses your own `lazydocker` on `PATH` if enabled (shows **Get lazydocker**
otherwise; disable detection in the Docker connection).

## Related

- [Connections](../setup/connections.md) · [Private data](../private-data.md) ·
  [Your workspace](README.md) · [Developer reference](../../docker.md)
