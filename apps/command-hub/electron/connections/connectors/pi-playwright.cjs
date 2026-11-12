// pi Playwright connector, a subconnector of pi (`parent: 'pi'`).
//
// How the pieces connect (researched against pi-playwright 0.1.2 and
// @playwright/cli 0.1.20+):
//
//   pi ── skill `playwright-browser` (npm package pi-playwright, installed with
//   │     `pi install npm:pi-playwright` into <agent dir>/npm/node_modules)
//   │     runs `node <skill>/scripts/pw.js <command>`, a thin wrapper around
//   │     the package's own @playwright/cli
//   └─ `pw.js attach --extension=chrome` starts a session daemon with a relay
//      on a random localhost port and opens
//      chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/connect.html in the
//      user's own browser. That page belongs to the Playwright Extension
//      (Chrome Web Store, formerly "Playwright MCP Bridge"); it asks the user
//      which tab to share, then connects back to the relay, and from there
//      pi drives the user's real tabs with their logins and cookies.
//      `detach` ends the session and leaves the browser alone.
//
// Playwright picks the browser profile the same way this connector checks
// it: the last used profile that has the extension, or the one named in
// PLAYWRIGHT_MCP_PROFILE_DIR_NAME. The extension shows a token that, set as
// PLAYWRIGHT_MCP_EXTENSION_TOKEN, skips the tab prompt. MonoRail never reads
// or stores that token: the check only says whether the variable is set, and
// the test passes the environment through as it is.
//
// What this connector reads: pi's settings.json (the `packages` list), the
// installed package.json files, and in the browser's user data folder the
// `Local State` last-used profile name and whether each profile has the
// extension (its Extensions folder, or its entry in Preferences). Everything
// else in those files is dropped as soon as it is parsed. Profile folder
// names (Default, Profile 1) are shown, never profile or account names.
//
// What it writes: when "Teach pi" is on, one skill, <agent dir>/skills/
// use-my-browser/SKILL.md, marked as MonoRail's, that tells pi how to attach
// to the chosen browser. It is replaced on save and removed when turned off,
// and never overwrites a skill MonoRail did not write.

const fs = require('node:fs/promises')
const fssync = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')

const { agentDir } = require('./pi.cjs')._internal
const { killTree } = require('../run.cjs')

const PACKAGE = 'pi-playwright'
const EXTENSION_ID = 'mmlmfjhmonkocbjadbfplnigmagldckm'
const STORE_URL = `https://chromewebstore.google.com/detail/playwright-extension/${EXTENSION_ID}`
const SKILL_NAME = 'use-my-browser'
const SKILL_MARKER = '<!-- monorail:pi-playwright -->'
const CHECK_SESSION = 'monorail-check'
const ATTACH_TIMEOUT_MS = 120_000
const PROFILE = /^[\w .()-]{1,64}$/

const CHANNELS = {
  chrome: {
    label: 'Google Chrome',
    dataDir: { win32: ['Google', 'Chrome', 'User Data'], darwin: ['Google', 'Chrome'], linux: 'google-chrome' },
    exe: {
      win32: [
        ['ProgramFiles', 'Google', 'Chrome', 'Application', 'chrome.exe'],
        ['ProgramFiles(x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'],
        ['LOCALAPPDATA', 'Google', 'Chrome', 'Application', 'chrome.exe'],
      ],
      darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      linux: ['/opt/google/chrome/chrome'],
    },
  },
  msedge: {
    label: 'Microsoft Edge',
    dataDir: { win32: ['Microsoft', 'Edge', 'User Data'], darwin: ['Microsoft Edge'], linux: 'microsoft-edge' },
    exe: {
      win32: [
        ['ProgramFiles(x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
        ['ProgramFiles', 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      ],
      darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      linux: ['/opt/microsoft/msedge/msedge'],
    },
  },
}

function channelOf(conn) {
  const c = conn?.values?.browser
  return CHANNELS[c] ? c : 'chrome'
}

/** The browser's user data folder, where Playwright looks for the extension. */
function userDataDir(channel, { platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const parts = CHANNELS[channel].dataDir[platform]
  if (!parts) return undefined
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), ...parts)
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', ...parts)
  return env.CHROME_USER_DATA_DIR || path.join(env.CHROME_CONFIG_HOME || env.XDG_CONFIG_HOME || path.join(home, '.config'), parts)
}

function browserExecutable(channel, { platform = process.platform, env = process.env, exists = fssync.existsSync } = {}) {
  for (const c of CHANNELS[channel].exe[platform] ?? []) {
    const file = Array.isArray(c) ? (env[c[0]] ? path.join(env[c[0]], ...c.slice(1)) : undefined) : c
    if (file && exists(file)) return file
  }
  return undefined
}

async function readJson(file) {
  return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^﻿/, ''))
}

const exists = (p) => fs.access(p).then(() => true, () => false)

/**
 * Which profiles of a browser have the Playwright Extension, in the order
 * Playwright tries them (last used first). Only folder names come back.
 */
async function findExtensionProfiles(dataDir) {
  let entries = []
  try {
    entries = await fs.readdir(dataDir)
  } catch {
    return { found: false, profiles: [], withExtension: [] }
  }
  const profiles = entries
    .filter((e) => e === 'Default' || /^Profile \d+$/.test(e))
    .sort((a, b) => (a === 'Default' ? -1 : +a.slice(8)) - (b === 'Default' ? -1 : +b.slice(8)))
  let lastUsed
  try {
    const v = (await readJson(path.join(dataDir, 'Local State')))?.profile?.last_used
    if (typeof v === 'string' && profiles.includes(v)) lastUsed = v
  } catch {
    // no Local State: keep folder order
  }
  const ordered = lastUsed ? [lastUsed, ...profiles.filter((p) => p !== lastUsed)] : profiles
  const withExtension = []
  for (const p of ordered) if (await hasExtension(path.join(dataDir, p))) withExtension.push(p)
  return { found: true, profiles: ordered, lastUsed, withExtension }
}

async function hasExtension(profileDir) {
  if (await exists(path.join(profileDir, 'Extensions', EXTENSION_ID))) return true
  for (const name of ['Preferences', 'Secure Preferences']) {
    try {
      const record = (await readJson(path.join(profileDir, name)))?.extensions?.settings?.[EXTENSION_ID]
      if (record && typeof record === 'object' && Object.keys(record).length) return true
    } catch {
      // missing or unreadable: not there
    }
  }
  return false
}

/** pi's package source -> where pi installs it, if it is pi-playwright. */
function matchSource(source, dir) {
  if (typeof source !== 'string') return undefined
  const s = source.trim()
  if (s.startsWith('npm:')) {
    const spec = s.slice(4).trim()
    const name = spec.startsWith('@') ? spec.split('@').slice(0, 2).join('@') : spec.split('@')[0]
    return name === PACKAGE ? { type: 'npm', source: s, dir: path.join(dir, 'npm', 'node_modules', PACKAGE) } : undefined
  }
  const git = s
    .replace(/^git:/, '')
    .replace(/^(?:git\+)?(?:https?|ssh):\/\/(?:[^@/]+@)?/, '')
    .replace(/^git@([^:]+):/, '$1/')
  const m = /^([\w.-]+\.[a-z]{2,})\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[@#].*)?$/i.exec(git)
  if (m) return m[3] === PACKAGE ? { type: 'git', source: s, dir: path.join(dir, 'git', m[1], m[2], m[3]) } : undefined
  // A local path: resolved from the settings file that lists it.
  const local = path.resolve(dir, s.startsWith('~') ? path.join(os.homedir(), s.slice(1)) : s)
  return path.basename(local) === PACKAGE ? { type: 'local', source: s, dir: local } : undefined
}

/** pi-playwright as pi sees it: listed in pi's settings, installed, with its Playwright CLI. */
async function findPackage(dir) {
  let settings = {}
  let settingsError
  try {
    settings = await readJson(path.join(dir, 'settings.json'))
  } catch (e) {
    if (e.code !== 'ENOENT') settingsError = e instanceof Error ? e.message : String(e)
  }
  const list = Array.isArray(settings?.packages) ? settings.packages : []
  let listed
  for (const p of list) {
    listed = matchSource(typeof p === 'string' ? p : p?.source, dir)
    if (listed) break
  }
  const pkgDir = listed?.dir ?? path.join(dir, 'npm', 'node_modules', PACKAGE)
  const out = { listed: !!listed, source: listed?.source, settingsError, dir: undefined, version: undefined, cli: undefined, pwJs: undefined }
  try {
    const pkg = await readJson(path.join(pkgDir, 'package.json'))
    if (pkg?.name !== PACKAGE) return out
    out.dir = pkgDir
    out.version = typeof pkg.version === 'string' ? pkg.version : undefined
  } catch {
    return out
  }
  const pw = path.join(pkgDir, 'skills', 'playwright-browser', 'scripts', 'pw.js')
  if (await exists(pw)) out.pwJs = pw
  out.cli = await findCli(pkgDir)
  return out
}

/** The @playwright/cli that pi-playwright resolves (nested or hoisted), and its entry script. */
async function findCli(pkgDir) {
  let manifest
  try {
    manifest = require.resolve('@playwright/cli/package.json', { paths: [pkgDir] })
  } catch {
    return undefined
  }
  try {
    const pkg = await readJson(manifest)
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['playwright-cli']
    if (!bin) return { version: pkg.version }
    return { version: pkg.version, entry: path.join(path.dirname(manifest), bin) }
  } catch {
    return undefined
  }
}

// ---------- the skill that tells pi how to attach ----------

/** Forward slashes, so the path works in the bash pi runs on Windows too. */
const shellPath = (p) => p.replace(/\\/g, '/')

function skillText({ channel, profile, pwJs }) {
  const browser = CHANNELS[channel].label
  const pw = `node "${shellPath(pwJs)}"`
  const env = profile ? `PLAYWRIGHT_MCP_PROFILE_DIR_NAME="${profile}" ` : ''
  return `---
name: ${SKILL_NAME}
description: Work in the user's own ${browser} tabs, with their logins, cookies and extensions, through the Playwright Extension. Use when the user asks to look at, check or automate something in their browser, on a site they are signed in to, or in "my ${browser.split(' ').pop()}".
metadata:
  written-by: MonoRail
---
${SKILL_MARKER}
<!-- Written by MonoRail (Connections > pi > Playwright browser). Saving that connection replaces this file; turning "Teach pi" off removes it. -->

# Use the user's ${browser}

This builds on the \`playwright-browser\` skill and its wrapper script. Instead of
\`open\` (which starts a separate, signed-out browser), attach to the user's
running ${browser}:

\`\`\`bash
${env}${pw} attach --extension=${channel}
\`\`\`

- ${browser} shows a Playwright page asking which tab to share. Tell the user to
  pick the tab, then wait for the command to finish. (No prompt if they set
  PLAYWRIGHT_MCP_EXTENSION_TOKEN; never ask for or print that token.)
- After attaching, use the same wrapper for everything else, as the
  \`playwright-browser\` skill describes: \`snapshot\`, \`click\`, \`fill\`,
  \`tab-list\`, \`tab-select\`, \`screenshot\`.
- When done, run \`${pw} detach\`. Never \`close\`: that is for browsers the CLI
  started, and these are the user's own windows.
- These are the user's real accounts. Ask before submitting forms, sending
  messages, buying, deleting or changing settings.
- If attaching fails with "Playwright Extension not found" or times out, tell
  the user to check Connections > pi > Playwright browser in MonoRail.
`
}

function skillFile(dir) {
  return path.join(dir, 'skills', SKILL_NAME, 'SKILL.md')
}

/** 'missing' | 'ours' | 'foreign', and the current text when it is ours. */
async function readSkill(dir) {
  try {
    const text = await fs.readFile(skillFile(dir), 'utf8')
    return text.includes(SKILL_MARKER) ? { state: 'ours', text } : { state: 'foreign' }
  } catch {
    return { state: 'missing' }
  }
}

function wantsSkill(conn) {
  return (conn?.values?.teachPi ?? 'yes') !== 'no'
}

function profileOf(conn) {
  return conn?.values?.profile?.trim() || ''
}

/** Write, refresh or remove the skill to match the connection. */
async function syncSkill(conn, dir, pkg) {
  const current = await readSkill(dir)
  if (!conn || !wantsSkill(conn) || !pkg?.pwJs) {
    if (current.state === 'ours') await fs.rm(path.dirname(skillFile(dir)), { recursive: true, force: true })
    return current.state === 'ours' ? 'removed' : 'unchanged'
  }
  if (current.state === 'foreign') throw new Error(`pi already has a skill named ${SKILL_NAME} that MonoRail did not write. Rename it, or turn off "Teach pi".`)
  const text = skillText({ channel: channelOf(conn), profile: profileOf(conn), pwJs: pkg.pwJs })
  if (current.text === text) return 'unchanged'
  await fs.mkdir(path.dirname(skillFile(dir)), { recursive: true })
  const tmp = `${skillFile(dir)}.${process.pid}.monorail.tmp`
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, skillFile(dir))
  return 'written'
}

// ---------- status ----------

/** Fold what was found into a status. Exported for tests. */
function summarize({ sdk, pkg, channel, profile, browser, skill, wantSkill, tokenSet, managed }) {
  const label = CHANNELS[channel].label
  const details = []
  details.push({
    label: 'pi-playwright',
    value: pkg.dir ? `${pkg.version ?? 'unknown version'}${pkg.listed ? '' : ' (installed, but not in pi settings)'}` : pkg.listed ? 'In pi settings, not installed yet' : 'Not installed',
    ok: !!pkg.dir && pkg.listed,
  })
  if (pkg.dir) details.push({ label: 'Playwright CLI', value: pkg.cli?.version ?? 'Missing: reinstall pi-playwright', ok: !!pkg.cli?.entry })
  details.push({ label, value: browser.found ? 'Found' : 'Not found', ok: browser.found })
  if (browser.found) {
    const using = profile ? (browser.withExtension.includes(profile) ? profile : undefined) : browser.withExtension[0]
    details.push({
      label: 'Playwright Extension',
      value: using
        ? `Installed in ${using}${!profile && browser.withExtension.length > 1 ? ` (also ${browser.withExtension.slice(1).join(', ')})` : ''}`
        : profile
          ? `Not in ${profile}${browser.withExtension.length ? ` (found in ${browser.withExtension.join(', ')})` : ''}`
          : 'Not installed',
      ok: !!using,
    })
  }
  details.push({ label: 'Tab prompt', value: tokenSet ? 'Skipped (extension token set)' : `${label} asks which tab to share`, ok: undefined })
  if (managed) {
    const skillValue = !wantSkill
      ? 'Off'
      : skill.state === 'foreign'
        ? `A different ${SKILL_NAME} skill exists`
        : skill.state === 'ours'
          ? skill.current
            ? `${SKILL_NAME}: up to date`
            : `${SKILL_NAME}: out of date, save to refresh`
          : 'Not written yet'
    details.push({ label: 'Skill for pi', value: skillValue, ok: wantSkill ? skill.state === 'ours' && skill.current : undefined })
  }

  const actions = ['test-attach']
  if (!sdk) return { state: 'unavailable', summary: 'Set up pi first: the pi coding agent was not found.', hint: 'See the pi connection above.', details, actions: [] }
  if (pkg.settingsError) return { state: 'error', summary: "pi's settings.json could not be read.", hint: pkg.settingsError, details, actions: [] }
  if (!pkg.dir || !pkg.listed) {
    return {
      state: 'needs-setup',
      summary: "pi's Playwright skill (pi-playwright) is not installed.",
      hint: 'Install it in pi (a terminal opens and runs pi install npm:pi-playwright). Installed for one project only? MonoRail checks pi\'s personal settings.',
      details,
      actions: ['install-skill'],
    }
  }
  if (!pkg.cli?.entry) return { state: 'error', summary: 'pi-playwright is installed without its Playwright CLI.', hint: 'Install it again.', details, actions: ['install-skill'] }
  if (!browser.found) return { state: 'unavailable', summary: `${label} was not found on this PC.`, hint: 'Install it, or pick the other browser in Edit.', details, actions: [] }
  const using = profile ? browser.withExtension.includes(profile) : browser.withExtension.length > 0
  if (!using) {
    return {
      state: 'needs-setup',
      summary: profile ? `The Playwright Extension is not installed in the ${label} profile ${profile}.` : `The Playwright Extension is not installed in ${label}.`,
      hint: `Get the extension opens its Chrome Web Store page in ${label}${profile ? ` (${profile})` : ''}. Add it, then come back.`,
      details,
      actions: ['open-extension-page'],
    }
  }
  if (managed && wantSkill && skill.state === 'foreign') {
    return { state: 'error', summary: `pi already has a different skill named ${SKILL_NAME}.`, hint: 'Rename it, or turn off "Teach pi" in Edit.', details, actions }
  }
  return {
    state: 'ok',
    summary: `pi can drive your ${label} tabs${managed && wantSkill && skill.state === 'ours' ? ', and knows how' : ''}.`,
    hint: tokenSet ? undefined : 'Test connection opens the tab prompt once, then detaches.',
    details,
    actions,
  }
}

function findSdk(deps) {
  if (deps.findPiSdk) return deps.findPiSdk()
  return require('../../modules/agent-chat-options.cjs').findPiSdk()
}

async function detect(conn, deps = {}) {
  const dir = deps.piAgentDir ?? agentDir()
  const channel = channelOf(conn)
  const profile = profileOf(conn)
  const env = deps.env ?? process.env
  const dataDir = deps.browserDataDir?.(channel) ?? userDataDir(channel, { env })
  const pkg = await findPackage(dir)
  const browser = dataDir ? await findExtensionProfiles(dataDir) : { found: false, profiles: [], withExtension: [] }
  return { dir, channel, profile, env, pkg, browser }
}

async function status(conn, deps = {}) {
  const { dir, channel, profile, env, pkg, browser } = await detect(conn, deps)
  const skill = await readSkill(dir)
  if (skill.state === 'ours' && pkg.pwJs) skill.current = skill.text === skillText({ channel, profile, pwJs: pkg.pwJs })
  return summarize({
    sdk: findSdk(deps),
    pkg,
    channel,
    profile,
    browser,
    skill,
    wantSkill: wantsSkill(conn),
    tokenSet: !!env.PLAYWRIGHT_MCP_EXTENSION_TOKEN,
    managed: !!conn,
  })
}

// ---------- actions ----------

/** Run the Playwright CLI with MonoRail's own executable as Node. No shell, so arguments are never re-parsed. */
function runCli(entry, args, { env, timeoutMs, job, deps = {} }) {
  return new Promise((resolve) => {
    const node = deps.nodeExecutable ?? process.execPath
    const cwd = path.join(os.tmpdir(), 'monorail-playwright-check')
    fssync.mkdirSync(cwd, { recursive: true })
    const child = (deps.spawn ?? spawn)(node, [entry, ...args], {
      cwd,
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)
    if (job) job.kill = () => killTree(child)
    child.stdout?.on('data', (d) => job?.appendOutput(String(d)))
    child.stderr?.on('data', (d) => job?.appendOutput(String(d)))
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: -1, timedOut, error })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, timedOut })
    })
  })
}

async function testAttach(conn, job, deps = {}) {
  const { channel, profile, env, pkg, browser } = await detect(conn, deps)
  const label = CHANNELS[channel].label
  if (!pkg.cli?.entry) throw new Error('Install pi-playwright first.')
  if (!browser.found) throw new Error(`${label} was not found.`)
  const runEnv = { ...env }
  if (profile) runEnv.PLAYWRIGHT_MCP_PROFILE_DIR_NAME = profile
  job.step = 1
  job.stepLabel = env.PLAYWRIGHT_MCP_EXTENSION_TOKEN ? `Connecting to ${label}` : `Pick a tab in ${label}`
  job.note = env.PLAYWRIGHT_MCP_EXTENSION_TOKEN
    ? `Connecting through the Playwright Extension with your token.`
    : `${label} opened a Playwright page. Pick any tab to share; MonoRail detaches right after.`
  const attached = await runCli(pkg.cli.entry, [`-s=${CHECK_SESSION}`, 'attach', `--extension=${channel}`], { env: runEnv, timeoutMs: deps.attachTimeoutMs ?? ATTACH_TIMEOUT_MS, job, deps })
  job.step = 2
  job.stepLabel = 'Detaching'
  job.note = undefined
  await runCli(pkg.cli.entry, [`-s=${CHECK_SESSION}`, 'detach'], { env: runEnv, timeoutMs: 20_000, deps })
  if (job.cancelled) throw new Error('Cancelled.')
  if (attached.timedOut) throw new Error(`No tab was shared within ${Math.round((deps.attachTimeoutMs ?? ATTACH_TIMEOUT_MS) / 1000)} seconds.`)
  if (attached.error) throw new Error(`Could not run the Playwright CLI: ${attached.error.message}`)
  if (attached.code !== 0) {
    const last = job.output.trim().split(/\r?\n/).find((l) => /^Error:/.test(l))
    throw new Error(last ? last.replace(/^Error:\s*/, '') : `The Playwright CLI exited with code ${attached.code}.`)
  }
  job.note = `Connected to ${label} and detached again.`
}

/** Open the extension's store page in the chosen browser (and profile), so it lands in the right place. */
async function openExtensionPage(conn, _job, deps = {}) {
  const channel = channelOf(conn)
  const profile = profileOf(conn)
  const exe = deps.browserExecutable?.(channel) ?? browserExecutable(channel)
  if (exe) {
    const args = [...(profile ? [`--profile-directory=${profile}`] : []), STORE_URL]
    const child = (deps.spawn ?? spawn)(exe, args, { detached: true, shell: false, stdio: 'ignore', windowsHide: false })
    child.on?.('error', () => {})
    child.unref?.()
    return
  }
  const open = deps.openExternal ?? ((url) => require('electron').shell.openExternal(url))
  await open(STORE_URL)
}

module.exports = {
  kind: 'pi-playwright',
  parent: 'pi',
  title: 'Playwright browser',
  description: "pi's Playwright skill working in your own Chrome tabs (with your logins) through the Playwright Extension.",
  icon: 'globe',
  fields: [
    {
      key: 'browser',
      label: 'Browser',
      type: 'select',
      defaultValue: 'chrome',
      options: Object.entries(CHANNELS).map(([value, c]) => ({ value, label: c.label })),
      help: 'The browser that has the Playwright Extension. pi attaches to its open tabs.',
    },
    {
      key: 'profile',
      label: 'Browser profile folder (optional)',
      type: 'text',
      placeholder: 'Default, Profile 1, ...',
      help: 'Leave empty to use the last profile you used that has the extension, as Playwright does. A folder name from chrome://version (Profile Path), not your profile name.',
    },
    {
      key: 'teachPi',
      label: 'Teach pi',
      type: 'select',
      defaultValue: 'yes',
      options: [
        { value: 'yes', label: `Add a ${SKILL_NAME} skill that tells pi how to attach` },
        { value: 'no', label: 'No, I tell pi myself' },
      ],
      help: `Writes ${SKILL_NAME}/SKILL.md to pi's skills folder with the attach command for this browser and profile. It holds no tokens.`,
    },
  ],
  validate({ values }) {
    if (values.browser && !CHANNELS[values.browser]) throw new Error('Pick Google Chrome or Microsoft Edge.')
    if (values.profile && !PROFILE.test(values.profile)) throw new Error('The profile folder is a name like Default or Profile 1.')
    if (values.teachPi && !['yes', 'no'].includes(values.teachPi)) throw new Error('Pick whether to teach pi.')
  },
  /** After a save: write, refresh or remove the skill. */
  async afterSave(conn, deps = {}) {
    const dir = deps.piAgentDir ?? agentDir()
    await syncSkill(conn, dir, await findPackage(dir))
  },
  /** When the connection is removed, its skill goes too. */
  async afterRemove(deps = {}) {
    const dir = deps.piAgentDir ?? agentDir()
    await syncSkill(undefined, dir)
  },
  actions: [
    {
      id: 'install-skill',
      label: 'Install in pi',
      description: 'Opens a terminal that runs pi install npm:pi-playwright (pi asks before installing). Check again when it finishes.',
      showWhen: ['needs-setup', 'error'],
      run: async (_conn, _job, deps = {}) => (deps.openTerminal ?? require('../run.cjs').openTerminal)('pi Playwright install', 'pi', ['install', 'npm:pi-playwright']),
    },
    {
      id: 'open-extension-page',
      label: 'Get the extension',
      description: 'Opens the Playwright Extension in the Chrome Web Store, in the chosen browser and profile.',
      showWhen: ['needs-setup'],
      run: openExtensionPage,
    },
    {
      id: 'test-attach',
      label: 'Test connection',
      description: 'Attaches to the browser the way pi does (you pick a tab), then detaches.',
      steps: 2,
      showWhen: ['ok'],
      run: testAttach,
    },
  ],
  status,
  _internal: { summarize, openExtensionPage, CHANNELS, PROFILE, findExtensionProfiles, findPackage, matchSource, userDataDir, browserExecutable, skillText, syncSkill, readSkill, EXTENSION_ID, STORE_URL, SKILL_NAME, SKILL_MARKER },
}
