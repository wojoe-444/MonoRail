// Claude Playwright connector, a subconnector of Claude (`parent: 'claude'`).
//
// Lets the `claude` the user runs in a terminal drive their own Chrome or
// Edge tabs (with their logins) through the Playwright Extension, the same
// extension pi's Playwright browser uses (see pi-playwright.cjs for how the
// extension and its connect page work).
//
//   Claude Code ── MCP server `playwright-extension` in the user config,
//                  `npx -y @playwright/mcp@latest --extension`
//                  (`cmd /c npx ...` on Windows, which Claude Code needs to
//                  start npx there)
//              └─ the server talks to the Playwright Extension in the chosen
//                 browser; the extension asks which tab to share, unless
//                 PLAYWRIGHT_MCP_EXTENSION_TOKEN is set.
//
// What it writes: on save, one entry in Claude Code's user config, through
// `claude mcp add --scope user` (never by editing ~/.claude.json). The entry
// carries MONORAIL_MANAGED=1 so MonoRail knows it is its own: it only ever
// replaces or removes an entry with that mark, and refuses when someone else
// added a `playwright-extension` server. Removing the connection removes the
// entry.
//
// What it reads: Claude Code's user config (~/.claude.json, or
// CLAUDE_CONFIG_DIR) for that one entry only, and the browser's profile
// folders the way pi's Playwright browser does.
//
// The optional extension token is a secret field: encrypted by Connections,
// checked before it is stored, passed to Claude Code as an `--env` value, and
// hidden from every status line, error and job note, because Claude Code
// keeps env values in plain text and `claude mcp get` prints them.
//
// MonoRail's own Chat runs Claude without user MCP servers, so this only
// affects `claude` in a terminal (and other tools that load the user config).

const fs = require('node:fs/promises')

const { runTool, quoteArg } = require('../run.cjs')
const { locations } = require('./claude.cjs')._internal
const pw = require('./pi-playwright.cjs')._internal

const SERVER = 'playwright-extension'
const PACKAGE = '@playwright/mcp@latest'
const MARK = 'MONORAIL_MANAGED'
const TOKEN_ENV = 'PLAYWRIGHT_MCP_EXTENSION_TOKEN'
const PROFILE_ENV = 'PLAYWRIGHT_MCP_PROFILE_DIR_NAME'
const TOKEN = /^[\w./+=-]{8,512}$/
const HIDDEN = '(hidden)'

function channelOf(conn) {
  const c = conn?.values?.browser
  return pw.CHANNELS[c] ? c : 'chrome'
}

function profileOf(conn) {
  return conn?.values?.profile?.trim() || ''
}

function tokenOf(conn) {
  const t = conn?.secrets?.token
  return typeof t === 'string' && t.trim() ? t.trim() : ''
}

/** The server entry this connection wants in Claude Code's user config. */
function desiredEntry(conn, { platform = process.platform } = {}) {
  const channel = channelOf(conn)
  const serverArgs = ['-y', PACKAGE, '--extension', ...(channel === 'chrome' ? [] : ['--browser', channel])]
  const env = { [MARK]: '1' }
  if (profileOf(conn)) env[PROFILE_ENV] = profileOf(conn)
  if (tokenOf(conn)) env[TOKEN_ENV] = tokenOf(conn)
  return platform === 'win32' ? { command: 'cmd', args: ['/c', 'npx', ...serverArgs], env } : { command: 'npx', args: serverArgs, env }
}

/** `claude mcp add` arguments for an entry. Env values may hold a space (Profile 1), so they are quoted. */
function addArgs(entry) {
  return ['mcp', 'add', SERVER, '--scope', 'user', ...Object.entries(entry.env).flatMap(([k, v]) => ['-e', quoteArg(`${k}=${v}`)]), '--', entry.command, ...entry.args]
}

/** Replace every secret value in text before it goes anywhere the page can see. */
function redact(text, secrets) {
  let out = String(text ?? '')
  for (const s of secrets) if (s) out = out.split(s).join(HIDDEN)
  // Belt and braces: an env line Claude Code printed for the token.
  return out.replace(new RegExp(`(${TOKEN_ENV}=)\\S+`, 'g'), `$1${HIDDEN}`)
}

/**
 * The `playwright-extension` entry in Claude Code's user config:
 * { state: 'missing' | 'ours' | 'foreign', matches?, error? }. Only that one
 * entry is looked at; nothing of it is returned but these flags.
 */
async function readEntry(conn, deps = {}) {
  const file = deps.claudeConfigFile ?? locations(deps.env ?? process.env).globalConfig
  let config
  try {
    config = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^﻿/, ''))
  } catch (e) {
    if (e.code === 'ENOENT') return { state: 'missing' }
    return { state: 'missing', error: "Claude Code's settings file could not be read." }
  }
  const entry = config?.mcpServers?.[SERVER]
  if (!entry || typeof entry !== 'object') return { state: 'missing' }
  if (entry.env?.[MARK] !== '1') return { state: 'foreign' }
  const want = desiredEntry(conn, deps)
  const env = entry.env ?? {}
  const matches =
    entry.command === want.command &&
    JSON.stringify(entry.args ?? []) === JSON.stringify(want.args) &&
    Object.keys(env).length === Object.keys(want.env).length &&
    Object.entries(want.env).every(([k, v]) => env[k] === v)
  return { state: 'ours', matches }
}

const FOREIGN = `Claude Code already has a ${SERVER} server that MonoRail did not add, so MonoRail leaves it alone. To let MonoRail manage it, run: claude mcp remove ${SERVER} --scope user`

async function claudeCli(deps) {
  const r = await (deps.runTool ?? runTool)('claude', ['--version'], { timeoutMs: 20_000 })
  return r.code === 0 ? r.stdout.trim().split(/\r?\n/)[0] : undefined
}

async function runClaude(args, conn, deps, timeoutMs = 60_000) {
  const r = await (deps.runTool ?? runTool)('claude', args, { timeoutMs })
  const secrets = [tokenOf(conn)]
  if (r.notFound) throw new Error('The Claude Code CLI was not found. Set up Claude above first.')
  if (r.timedOut) throw new Error('Claude Code did not answer in time.')
  return { ...r, stdout: redact(r.stdout, secrets), stderr: redact(r.stderr, secrets) }
}

/** Add, refresh or leave the entry so it matches the connection. Never touches a foreign entry. */
async function syncEntry(conn, deps = {}) {
  const now = await readEntry(conn, deps)
  if (now.error) throw new Error(now.error)
  if (now.state === 'foreign') throw new Error(FOREIGN)
  if (now.state === 'ours' && now.matches) return 'unchanged'
  if (now.state === 'ours') {
    const removed = await runClaude(['mcp', 'remove', SERVER, '--scope', 'user'], conn, deps)
    if (removed.code !== 0) throw new Error(`Claude Code could not update the ${SERVER} server: ${firstLine(removed)}`)
  }
  const added = await runClaude(addArgs(desiredEntry(conn, deps)), conn, deps)
  if (added.code !== 0) throw new Error(`Claude Code could not add the ${SERVER} server: ${firstLine(added)}`)
  return now.state === 'ours' ? 'updated' : 'added'
}

function firstLine(r) {
  return (r.stderr.trim() || r.stdout.trim() || `exit code ${r.code}`).split(/\r?\n/)[0]
}

// ---------- status ----------

/** Fold what was found into a status. Exported for tests. */
function summarize({ cli, entry, channel, profile, browser, tokenSaved }) {
  const label = pw.CHANNELS[channel].label
  const details = []
  details.push({ label: 'Claude Code CLI', value: cli ?? 'Not found', ok: !!cli })
  details.push({
    label: `${SERVER} server`,
    value:
      entry.error ??
      (entry.state === 'foreign'
        ? 'Added by someone else, left alone'
        : entry.state === 'ours'
          ? entry.matches
            ? 'In Claude Code (user config)'
            : 'Out of date: Add to Claude Code refreshes it'
          : 'Not in Claude Code yet'),
    ok: entry.state === 'ours' && entry.matches,
  })
  details.push({ label, value: browser.found ? 'Found' : 'Not found', ok: browser.found })
  if (browser.found) {
    const using = profile ? (browser.withExtension.includes(profile) ? profile : undefined) : browser.withExtension[0]
    details.push({
      label: 'Playwright Extension',
      value: using
        ? `Installed in ${using}`
        : profile
          ? `Not in ${profile}${browser.withExtension.length ? ` (found in ${browser.withExtension.join(', ')})` : ''}`
          : 'Not installed',
      ok: !!using,
    })
  }
  details.push({ label: 'Tab prompt', value: tokenSaved ? 'Skipped (extension token saved)' : `${label} asks which tab to share` })

  if (!cli) return { state: 'unavailable', summary: 'Set up Claude first: the Claude Code CLI was not found.', hint: 'See the Claude connection above.', details, actions: [] }
  if (entry.error) return { state: 'error', summary: entry.error, details, actions: [] }
  if (entry.state === 'foreign') return { state: 'error', summary: `Claude Code already has a ${SERVER} server that MonoRail did not add.`, hint: `MonoRail never replaces it. To let MonoRail manage it, run claude mcp remove ${SERVER} --scope user in a terminal, then Add to Claude Code.`, details, actions: ['register'] }
  if (!browser.found) return { state: 'unavailable', summary: `${label} was not found on this PC.`, hint: 'Install it, or pick the other browser in Edit.', details, actions: [] }
  const using = profile ? browser.withExtension.includes(profile) : browser.withExtension.length > 0
  if (!using) {
    return {
      state: 'needs-setup',
      summary: profile ? `The Playwright Extension is not installed in the ${label} profile ${profile}.` : `The Playwright Extension is not installed in ${label}.`,
      hint: `Get the extension opens its Chrome Web Store page in ${label}${profile ? ` (${profile})` : ''}. Add it, then come back.`,
      details,
      actions: ['open-extension-page', ...(entry.state === 'ours' && entry.matches ? [] : ['register'])],
    }
  }
  if (!(entry.state === 'ours' && entry.matches)) {
    return { state: 'needs-setup', summary: `Claude Code does not have the ${SERVER} server${entry.state === 'ours' ? ' as set here' : ''} yet.`, hint: 'Add to Claude Code runs claude mcp add for you.', details, actions: ['register'] }
  }
  return {
    state: 'ok',
    summary: `Claude Code can use your ${label} tabs.`,
    hint: 'Start claude in a terminal and ask it to use your browser. Chat inside MonoRail does not load this server.',
    details,
    actions: ['test-server'],
  }
}

async function status(conn, deps = {}) {
  const env = deps.env ?? process.env
  const channel = channelOf(conn)
  const profile = profileOf(conn)
  const dataDir = deps.browserDataDir?.(channel) ?? pw.userDataDir(channel, { env })
  const [cli, entry, browser] = await Promise.all([
    claudeCli(deps),
    readEntry(conn, deps),
    dataDir ? pw.findExtensionProfiles(dataDir) : { found: false, profiles: [], withExtension: [] },
  ])
  return summarize({ cli, entry, channel, profile, browser, tokenSaved: !!tokenOf(conn) })
}

// ---------- actions ----------

/** Ask Claude Code to start the server (`claude mcp get` does a health check). No browser window opens. */
async function testServer(conn, job, deps = {}) {
  const entry = await readEntry(conn, deps)
  if (entry.state === 'foreign') throw new Error(FOREIGN)
  if (entry.state !== 'ours') throw new Error(`Add the ${SERVER} server to Claude Code first.`)
  job.stepLabel = 'Claude Code is starting the server'
  job.note = 'The first start downloads @playwright/mcp with npx, which can take a minute.'
  const r = await runClaude(['mcp', 'get', SERVER], conn, deps, deps.testTimeoutMs ?? 120_000)
  job.note = undefined
  const line = /Status:\s*(.+)/.exec(r.stdout)?.[1]?.trim()
  // The output lists env values, so only the status line is kept.
  if (r.code === 0 && line && /connected/i.test(line) && !/fail|not connected/i.test(line)) {
    job.note = 'Claude Code started the server. Ask claude in a terminal to use your browser to try it.'
    return
  }
  throw new Error(line ? `Claude Code could not start the server: ${line.replace(/^[^\w]+/, '')}` : `Claude Code could not check the server: ${firstLine(r)}`)
}

module.exports = {
  kind: 'claude-playwright',
  parent: 'claude',
  title: 'Playwright browser',
  description: 'Claude Code working in your own Chrome or Edge tabs (with your logins) through the Playwright Extension.',
  icon: 'globe',
  fields: [
    {
      key: 'browser',
      label: 'Browser',
      type: 'select',
      defaultValue: 'chrome',
      options: Object.entries(pw.CHANNELS).map(([value, c]) => ({ value, label: c.label })),
      help: 'The browser that has the Playwright Extension. Claude Code works in its open tabs.',
    },
    {
      key: 'profile',
      label: 'Browser profile folder (optional)',
      type: 'text',
      placeholder: 'Default, Profile 1, ...',
      help: 'Leave empty to use the last profile you used that has the extension. A folder name from chrome://version (Profile Path), not your profile name.',
    },
    {
      key: 'token',
      label: 'Extension token (optional)',
      type: 'secret',
      placeholder: 'Shown in the Playwright Extension',
      help: 'Skips the "which tab" prompt. Saved encrypted here; Claude Code keeps its own copy in its settings.',
    },
  ],
  validate({ values, secrets = {} }) {
    if (values.browser && !pw.CHANNELS[values.browser]) throw new Error('Pick Google Chrome or Microsoft Edge.')
    if (values.profile && !pw.PROFILE.test(values.profile)) throw new Error('The profile folder is a name like Default or Profile 1.')
    const t = typeof secrets.token === 'string' ? secrets.token.trim() : ''
    if (t && !TOKEN.test(t)) throw new Error('That does not look like the token the Playwright Extension shows. Copy it again from the extension.')
  },
  /** After a save: add or refresh MonoRail's server entry in Claude Code. */
  async afterSave(conn, deps = {}) {
    await syncEntry(conn, deps)
  },
  /** When the connection is removed, MonoRail's entry goes too (never someone else's). */
  async afterRemove(deps = {}) {
    if ((await readEntry(undefined, deps)).state !== 'ours') return
    await runClaude(['mcp', 'remove', SERVER, '--scope', 'user'], undefined, deps)
  },
  actions: [
    {
      id: 'register',
      label: 'Add to Claude Code',
      description: `Runs claude mcp add to put the ${SERVER} server in your Claude Code user settings (or refresh MonoRail's own entry).`,
      showWhen: ['needs-setup', 'error'],
      run: async (conn, job, deps = {}) => {
        const done = await syncEntry(conn, deps)
        job.note = done === 'unchanged' ? 'Claude Code already had it.' : `Claude Code now has the ${SERVER} server.`
      },
    },
    {
      id: 'open-extension-page',
      label: 'Get the extension',
      description: 'Opens the Playwright Extension in the Chrome Web Store, in the chosen browser and profile.',
      showWhen: ['needs-setup'],
      run: pw.openExtensionPage,
    },
    {
      id: 'test-server',
      label: 'Test connection',
      description: 'Asks Claude Code to start the server. It does not open a browser window.',
      showWhen: ['ok'],
      run: testServer,
    },
  ],
  status,
  _internal: { summarize, desiredEntry, addArgs, readEntry, syncEntry, redact, SERVER, MARK, TOKEN_ENV },
}
