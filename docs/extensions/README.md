---
audience: human, ai
---

# Building MonoRail extensions

An extension adds pages and full-screen apps to MonoRail without rebuilding
MonoRail. You build and release it in your own repository, and users install it
from **Settings > Extensions**.

These pages are also built into MonoRail: **Help > Wiki** shows the version
that matches the installed app, offline.

## Start here

1. [Concepts](concepts.md): what an extension is made of, the words these docs
   use, and the two version numbers you set.
2. [Tutorial](tutorial.md): from the starter to a released extension, step by step.

## Reference

| Page | Read it for |
| --- | --- |
| [Manifest](manifest.md) | Every field of `monorail.json`: types, defaults, limits, the error you get |
| [Page API](page-api.md) | `monorail-sdk/client.js`: `invoke`, events, settings, folders, theme, errors |
| [Backend API](backend-api.md) | The backend module, `ctx`, hooks, error codes, events, secrets, settings |
| [Permissions and security](permissions.md) | What a page and a backend can and can't do, and how each permission is matched |
| [Running Python and other runtimes](non-node-runtimes.md) | Starting a non-Node program from a backend on Windows: finding or bundling it, its environment, cleanup, a helper HTTP server |
| [Lifecycle](lifecycle.md) | Install, update, reload, remove; when the backend starts and stops; what happens to data |
| [Testing](testing.md) | Testing a backend with `node --test`, and what still needs MonoRail |
| [Troubleshooting](troubleshooting.md) | Symptoms, causes and fixes |

[Roadmap](roadmap.md) lists what is planned. The reference pages describe only
what MonoRail does today, in extension API **1.2**.
