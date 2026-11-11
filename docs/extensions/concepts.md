# Concepts

## The three building blocks

MonoRail has three kinds of features:

| | Built-in module | Built-in app | Extension |
| --- | --- | --- | --- |
| What it is | One page inside the hub | A full-screen experience under the hub bar | Modules and/or apps from another repository |
| Lives in | MonoRail's repo | MonoRail's repo | Its own repo |
| Ships with | Every MonoRail release | Every MonoRail release | Its own GitHub releases |
| UI | React in MonoRail's window | React in MonoRail's window | Static files in a sandboxed frame |
| Backend | MonoRail's main process | MonoRail's main process | Its own process, with only what the user approved |

These docs cover extensions. Anything specific to one user or one situation
should be an extension.

## Words used in these docs

| Word | Meaning |
| --- | --- |
| **Extension** | A folder or `.zip` with a `monorail.json` at its root. It has an **id** such as `minecraft-bot`. |
| **Manifest** | The `monorail.json` file. See [Manifest](manifest.md). |
| **Contribution** | One module or one app that an extension adds. It is listed under `contributes.modules` or `contributes.apps`, and its id is unique within the extension. |
| **Module** | A contribution that is a page inside the hub, under MonoRail's page header, with a menu entry. |
| **App** | A contribution that fills the window under the hub bar and opens from the Apps page. |
| **Entry** | The HTML file (plus an optional `#hash`) that a contribution opens, relative to the `ui` folder. |
| **Page** | Your HTML running in the frame for a module or an app. It talks to MonoRail through the [Page API](page-api.md). |
| **Backend** | Optional Node code that runs in its own process. Pages call its **methods**, and it can push **events** to pages. See [Backend API](backend-api.md). |
| **ctx** | The object MonoRail passes to every backend method and hook: data folder, logging, events, secrets, settings. |
| **Permissions** | What the backend may reach beyond its own folders: network hosts, programs, folders. The user approves them. See [Permissions](permissions.md). |
| **Data folder** | `ctx.dataDir`: the extension's private, writable folder. It is kept across updates. |

## Where things show up

| Contribution | Route | Where users find it |
| --- | --- | --- |
| Module `status` of extension `minecraft-bot` | `#/x/minecraft-bot/status` | In the menu, under `nav.section` (default "Extensions") |
| App `console` of extension `minecraft-bot` | `#/apps/minecraft-bot.console` | On the Apps page, as a card |

The two route shapes differ on purpose. Apps share the `/apps/<id>`
namespace with built-in apps, so an extension app's id is
`<extension>.<app>`. Ids can't contain dots, so this can never clash with a
built-in app. Modules get their own `/x/` prefix. Routes are only useful for
links between your own pages. MonoRail builds them and you never configure them.

## How the pieces talk

```
 your page (iframe, monorail-ext://<id>/)                your backend (own process)
   monorail.invoke('getStatus', args)  ─── MonoRail ───▶  methods.getStatus(ctx, args)
   monorail.on('chat', cb)            ◀─── MonoRail ───   ctx.emit('chat', payload)
   monorail.getSettings()             ◀─── MonoRail       ctx.settings.get()
```

The page and the backend never talk directly, and the page has no network.
Everything goes through MonoRail, which checks that a page only reaches its
own extension's backend.

## Version numbers

There are two numbers you choose:

| Number | Where | Meaning |
| --- | --- | --- |
| Your extension's `version` | `monorail.json` (and your `package.json`) | Your release. Semver. Updates compare it. |
| `engines.monorail` | `monorail.json` | The extension API range you need, e.g. `"^1.1.0"`. |

Two more exist, and you don't manage them:

- `manifestVersion` is always `1`. It only changes if the manifest format
  ever changes incompatibly, together with a new major API version.
- The SDK in `monorail-sdk/` *is* the API version: `SDK_VERSION` in
  `client.js` equals the API version it was written for. Set
  `engines.monorail` to `^` plus that version. `pack.mjs` warns when they
  disagree.

The **extension API** is semver. A new minor version (1.0 to 1.1) only adds
things, so an extension built for `^1.0.0` keeps working. A new major version
may break extensions. Those stay installed but are not loaded until they are
updated. MonoRail shows its API version on the Extensions page.

| API | Added |
| --- | --- |
| 1.0 | Manifest, modules and apps, backend with `ctx`, permissions, events, folders |
| 1.1 | `ctx.secrets`, `ctx.settings` and manifest `settings`, `migrate` and `settingsChanged` hooks, error codes (`ctx.fail`, `MonoRailError`), `monorail.getSettings/onSettings/openSettings`, the SDK's `testing.mjs` |

## The SDK folder

Every extension carries its own copy of `monorail-sdk/` (copied, not
installed from npm). Its source is
[`packages/extension-sdk`](../../packages/extension-sdk) in MonoRail's repo.

| File | What it is |
| --- | --- |
| `client.js`, `client.d.ts` | The page side: the [Page API](page-api.md) |
| `backend.d.ts` | Types for your backend and `ctx` |
| `testing.mjs`, `testing.d.ts` | [Testing](testing.md) a backend without MonoRail |
| `theme.css` | MonoRail's design tokens for Tailwind CSS v4, so your pages match every color scheme and dark mode |
| `pack.mjs` | Packs the extension into `<id>-<version>.monorail.zip` |

`theme.css` is generated from MonoRail's own `src/index.css`, so the copy
in your extension is a snapshot of MonoRail's design tokens from when you
copied it. To pick up a newer SDK or newer tokens, refresh the folder:

```bash
npx degit wojoe-444/MonoRail/packages/extension-sdk monorail-sdk --force
```

Your extension keeps working without a refresh. Refresh when you want a
feature from a newer API version (and raise `engines.monorail` with it), or
MonoRail's latest colors.
