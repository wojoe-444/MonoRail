---
audience: human, ai
folder: Extensions
summary: Build, test and ship custom pages, full-screen apps and agent tools for MonoRail (extension API 1.2).
---

# Building MonoRail extensions

Extensions add pages, full-screen apps and agent tools to MonoRail without
rebuilding the app. Build and release in your own repo; users install from
**Settings > Extensions** ([user guide](../guide/setup/extensions.md)).

## Start here

1. **[Concepts](concepts.md)** — anatomy of an extension, core terms and
   versioning.
2. **[Tutorial](tutorial.md)** — step-by-step from starter template to release.

## Reference

| Page | Covers |
| --- | --- |
| [Manifest](manifest.md) | `monorail.json` fields, defaults, limits and validation errors |
| [Page API](page-api.md) | `monorail-sdk/client.js`: `invoke`, events, settings, folders, theme |
| [Backend API](backend-api.md) | Backend module, `ctx`, hooks, errors, events, secrets, settings |
| [Permissions & security](permissions.md) | UI sandbox, backend limits and permission matching |
| [Non-Node runtimes](non-node-runtimes.md) | Running Python or other binaries on Windows with clean lifecycle |
| [Lifecycle](lifecycle.md) | Install, update, reload, remove, startup/shutdown and data rules |
| [Testing](testing.md) | Backend unit tests with `node --test` and in-app checks |
| [Troubleshooting](troubleshooting.md) | Common symptoms, causes and fixes |

See [Roadmap](roadmap.md) for planned capabilities. Reference pages describe
extension API **1.2** as implemented today.
