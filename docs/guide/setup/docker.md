---
audience: human
summary: See what Docker is running on your computer (containers, logs, load, images and volumes), and open lazydocker in one click.
---

# Docker

If you use [Docker](https://www.docker.com/), **Utilities > Docker** shows what
it is running on this computer: your containers and their logs, how much CPU
and memory they use right now, and the images and volumes taking up disk
space. It is inspired by lazydocker, a popular terminal dashboard for Docker,
and can open lazydocker for you when you have it.

## Docker is optional

Many people never use Docker, and that is fine. MonoRail does nothing about
Docker until you add the **Docker** connection on
[Connections](connections.md). Until then the page only says it is not set up:
MonoRail does not look for Docker or lazydocker, and it never downloads or
installs either of them. This is MonoRail's
[nothing runs until you ask](../private-data.md#nothing-runs-until-you-ask)
rule.

## Set it up

1. Install Docker Desktop yourself, if you have not already, and start it.
2. Open **Settings > Connections**, find **Docker** and press **Set up**.
3. Choose whether MonoRail should use lazydocker when it is installed, then
   press **Save and check**.

MonoRail finds Docker even if you installed it while MonoRail was already
open: it reads the current PATH from Windows and looks in Docker Desktop's
usual folder, so you do not need to restart.

The check shows your Docker version, whether its engine is running and
whether lazydocker was found. If the engine is not running, the connection
offers **Start Docker Desktop**; wait until Docker Desktop says "Engine
running" and press **Check**.

## What the page shows

- **The top strip**: which Docker you run, its version, and how many CPUs and
  how much memory Docker may use.
- **Four tiles**: running containers (and any that keep restarting or are
  unhealthy), CPU and memory in use right now, and how much disk Docker takes
  up, with what it could free.
- **Containers**, grouped by their compose project. Pick one to see:
  - **Logs**: the last 500 lines. **Follow** keeps the newest line in view;
    errors are shown in red.
  - **Stats**: CPU and memory over the last few minutes, with a table view.
    A reading is taken every 5 seconds while the page is open and is never
    saved.
  - **Info**: command, ports, mounts, networks and labels. Environment
    variables are listed by name only, because their values often hold
    passwords.
- **Images**, **Volumes** and **Networks**, biggest first. Leftover untagged
  images from old builds are flagged.

## It only looks

The page never starts, stops or removes a container, image or volume. When
you want to act, press **Open lazydocker** (it opens in a terminal window) or
use Docker Desktop. To free disk space, Docker's own `docker system prune`
says what it removes before it does; the [Storage](../../storage.md) page
shows how full your drives are.

## lazydocker

lazydocker is a free terminal dashboard for Docker by Jesse Duffield. MonoRail
uses it only if you installed it yourself and it is on your PATH. If it is
not, the page shows **Get lazydocker**, which opens its project page so you
can decide. You can turn the lazydocker lookup off in the Docker connection.

## Related

- [Connect your accounts](connections.md): every connection, and how they stay
  opt-in.
- [Private data stays local](../private-data.md): logs and stats are read on
  demand and never saved.
- The rest of [setup](README.md).
- For developers and agents: the [Docker reference](../../docker.md).
