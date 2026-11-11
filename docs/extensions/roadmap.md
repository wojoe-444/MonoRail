---
audience: human
---

# Extensions roadmap

What's planned for extensions, and what's done. The reference pages describe
only what exists today.

## Done

| Step | What | PR |
| --- | --- | --- |
| 1 | Runtime: manifest and versioned API, install/update/remove, sandboxed pages and backends, Settings > Extensions | [#13](https://github.com/wojoe-444/MonoRail/pull/13) |
| 2 | SDK (`packages/extension-sdk`), starter (`extensions/hello-monorail`), packer, release workflow, CI | [#17](https://github.com/wojoe-444/MonoRail/pull/17) |
| 3 | API 1.1: `ctx.secrets`, error codes, `migrate`, defined event behavior, backend test helper, `.exe` matching fix, Windows CI | [#32](https://github.com/wojoe-444/MonoRail/pull/32) |
| 4 | Settings declared in the manifest, with a generated form | [#37](https://github.com/wojoe-444/MonoRail/pull/37) |
| 5 | Docs split into concepts, reference, tutorial, testing and troubleshooting; this roadmap | this set of pages |
| 6 | In-app wiki (Help > Wiki) built from these pages | |
| 7 | API 1.2: `contributes.mcpTools` (tools for agents through MonoRail's MCP server, each off until allowed per agent) and `ctx.runningIn` | |

## Next

- **Minecraft bot as an extension**, in its own repository, started from the
  starter. It's the first real extension, and it tests the docs end to end.

## Proposed

These came out of reviewing the docs as an extension author. None of them is
decided.

### One capability model (would be manifest version 2)

Today network, programs and files are three differently shaped permissions,
and user-picked folders (`ctx.folders`) and the data folder (`ctx.dataDir`)
are separate concepts. A future manifest could describe all access the same
way:

```json
"capabilities": [
  { "kind": "network", "target": "api.example.com:443" },
  { "kind": "process", "target": "git" },
  { "kind": "files", "target": "~/.minecraft", "access": "read" },
  { "kind": "files", "target": "user-picked", "access": "write" }
]
```

There would be one consent line per entry, and the backend would see one list
of what it holds. This changes the manifest, so it would come with
`manifestVersion: 2` and a major API version, with version 1 manifests still
loading.

### Fewer version numbers

`manifestVersion` already only changes with a major API version, and the SDK
version now equals the API version. That leaves an extension's own version
and `engines.monorail`. A later step could derive `engines.monorail` from the
SDK copy when packing, so authors set only their own version.

### Ideas

- A catalog of known extensions in Settings, so users don't type a repo name.
- Signed packages, or a check of the publisher.
- Letting extensions read selected MonoRail data (e.g. agents) through
  explicit, permissioned host APIs.
- Native addons behind their own permission.
- Resource limits (CPU, memory) for backends.
- A real-sandbox test runner, so permission errors also show up in
  `node --test`.
