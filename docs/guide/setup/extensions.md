---
audience: human
summary: Install community pages, full-screen apps and agent tools safely with explicit permission prompts.
---

# Add extensions

An [extension](../glossary.md#extension) adds pages, full-screen apps or agent
tools to MonoRail without rebuilding the app.

## Install one

Open **Settings > Extensions** and install from a GitHub repository (latest
release), a `.zip` archive, or a local folder. Before anything runs, MonoRail
lists every requested permission (hosts, folders, executables) for your
approval.

## What an extension can and can't do

- **Sandboxed UI**: extension pages can only talk to their own backend, never
  directly to the internet or the rest of MonoRail.
- **Scoped backend**: runs in its own process limited to approved hosts, folders
  and programs (process-spawning extensions show an explicit full-trust warning).
- **Safe updates**: any update requesting new permissions disables the extension
  until you re-approve.
- **Agent tools**: require separate per-agent approval on
  [Agent access](../agents/agent-access.md#extensions-add-tools).

Developer security details: [Permissions and security](../../extensions/permissions.md).

## Remove one

Remove any extension from **Settings > Extensions**; its stored data stays
unless you check **Also delete its data**.

## Build your own

Start at [Building MonoRail extensions](../../extensions/README.md)
([Concepts](../../extensions/concepts.md) and
[Tutorial](../../extensions/tutorial.md) are beginner-friendly; see
[Troubleshooting](../../extensions/troubleshooting.md) if stuck).

## Related

- [Setup overview](README.md) · [Private data stays local](../private-data.md)
