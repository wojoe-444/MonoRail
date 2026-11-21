---
audience: ai
summary: Connector opt-in, credential handling, CLI integrations and browser add-on ownership.
---

# Connections backend

See the [Connections guide](../guide/setup/connections.md), the
[developer reference](README.md) and [Desktop shell](desktop-shell.md#settings-and-search).

## Connector contract

`electron/connections/index.cjs` defines fields, `status()` returning
`ok | expired | needs-setup | error | unavailable`, polled action jobs and
optional `credentials()`, `afterSave` and `afterRemove`. Keep connector
work inside those hooks. `createConnections` returns not set up for a check
of an unconfigured connector and refuses actions and credential reads.
`hasConnection(kind)` checks configuration without running anything. The
page checks only added connections, on open, on explicit checks and on focus
after a sign-in launched there. There is no startup check.

Backends call `getCredentials(kind)` in the main process. Keep secrets out of
the renderer and logs. Save secret fields with safeStorage in the
[profile's](../profiles.md) `modules/connections` folder. Refuse writes when
encryption is unavailable. Use fixed arguments for CLI calls through
`run.cjs`. Tests are in `electron/connections/connections.test.cjs`.

## Accounts and local tooling

- Google Cloud detects CLI and Application Default Credentials. Sign-in
  runs `gcloud auth login` and then `gcloud auth application-default login`.
  [BigQuery](workspace-tools.md#bigquery) and [Malloy](../malloy.md) use its
  access token. BigQuery metadata is a [subconnector](../bigquery-metadata.md#the-connection).
- Atlassian uses a site, email and API token for [Tasks](git-workspace.md#tasks).
  The token can come from a named generic credential in Windows Credential
  Manager. Read it on demand via PowerShell CredRead and leave it there.
- Claude uses the user's CLI login and opens a terminal for
  `claude auth login`. `claude auth status --json`, the credentials file
  and presence of auth environment variables determine Subscription,
  API, Enterprise or Unknown. Never expose credential values.
  Enterprise can bill at API rates even with a claude.ai login. User
  override `accountType` wins. Cost displays share `claudeAccount()`,
  `useClaudeAccount()` and `ClaudeAccountBadge`. Home reads the summary.
- pi uses Chat's `findPiSdk` to find either SDK package. Parse provider names
  and auth kinds from `auth.json` without returning credentials. Saving or
  applying scoped models writes only `enabledModels` in pi's settings file
  under its `settings.json.lock`, with the same meaning as `/scoped-models`.
  Its status flags drift.
- OpenAI supports an `OPENAI_API_KEY` environment variable, encrypted pasted
  key or Credential Manager entry, and detects Codex CLI. Status checks
  the PATH shim and npm manifest, plus the login mode and plan claim in
  `auth.json` under `CODEX_HOME` or `~/.codex`. It reports keyring logins
  without reading them. Only the explicit Test API key action requests
  `GET /v1/models`. Results stay in memory keyed by the key's hash.
- GitHub uses a GitHub CLI login by default. `github-api.cjs` runs `gh api`
  with fixed arguments and sends request bodies on stdin. For a pasted or
  Credential Manager token, call only `api.github.com`. Credentials are
  `{ via: 'gh' }` or `{ via: 'token', token }`.
- git checks version, global author name/email and credential helper name.
  It stores no secret and never invokes `git credential`.
  See also [Docker](../docker.md), [OpenMetadata](openmetadata.md) and
  [ingestion](../ingestion.md) for data-service connectors.

## Browser add-ons

A connector with `parent: '<kind>'` is shown as an add-on. The pi Playwright
add-on checks the user's installed package and reads only the last-used
browser profile name and which profiles carry the Playwright Extension. The
extension id is `mmlmfjhmonkocbjadbfplnigmagldckm`. The user chooses a tab
through Playwright's attach flow. Status reports token presence only.
"Teach pi" owns a MonoRail-marked `use-my-browser` skill, leaves a
foreign one in place and removes only its own when disabled or removed.
Test connection attaches and detaches using MonoRail's executable in Node
mode without a shell.

The Claude add-on configures the terminal CLI with
`claude mcp add playwright-extension --scope user`. It uses
`npx -y @playwright/mcp@latest --extension` via `cmd /c npx` on Windows and
adds `--browser msedge` for Edge. Scope edits/removal to entries marked
`MONORAIL_MANAGED=1`, and leave foreign entries and `~/.claude.json` under
the CLI's ownership. A selected profile and optional extension token go
through `-e`; `quoteArg()` keeps values with spaces intact. Treat the token
as a secret and redact it from every status, error and job note.
`claude mcp get` can print env values. Test connection keeps only its
Status line. In-app [Chat](agent-chat.md#turn-workers) does not load user
MCP servers.
