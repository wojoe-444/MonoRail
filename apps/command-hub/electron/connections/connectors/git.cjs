// git connector.
//
// Nothing is stored: git keeps its own settings. The check asks git for its
// version, the commit identity (user.name and user.email from the global
// config), and which credential helper it uses to sign in to remotes (the
// helper's name only, e.g. "manager" for Git Credential Manager). It never
// asks a helper for a credential (no `git credential fill`), so no token or
// password is ever read. GitHub+ and Chat's Changes panel run this git.

const os = require('node:os')

const { runTool } = require('../run.cjs')

// No pager, no prompts, and no repo config: run from the home folder.
const QUIET = { GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_OPTIONAL_LOCKS: '0' }

const firstLine = (text) => String(text ?? '').trim().split(/\r?\n/)[0] ?? ''

/** "git version 2.47.1.windows.1" -> "2.47.1.windows.1". */
function parseVersion(stdout) {
  const m = /git version (\S+)/.exec(stdout ?? '')
  return m ? m[1] : undefined
}

/** The helpers git would use, in order. An empty entry resets the list, as in git. */
function parseHelpers(stdout) {
  const out = []
  const text = String(stdout ?? '').replace(/(\r?\n)+$/, '')
  if (!text) return out
  for (const line of text.split(/\r?\n/)) {
    const h = line.trim()
    if (!h) out.length = 0
    else if (!out.includes(h)) out.push(h)
  }
  return out
}

// A helper may be a path to a program or a shell snippet: show its name only.
function helperName(h) {
  if (h.startsWith('!')) return 'custom script'
  const first = /^"([^"]+)"/.exec(h)?.[1] ?? /^(.+?\.exe)(\s|$)/i.exec(h)?.[1] ?? h.split(/\s+/)[0]
  return first.split(/[\\/]/).pop().replace(/^git-credential-/, '').replace(/\.exe$/i, '')
}

const HELPER_LABEL = { manager: 'Git Credential Manager', 'manager-core': 'Git Credential Manager', osxkeychain: 'macOS Keychain', wincred: 'Windows Credential Manager', libsecret: 'libsecret', cache: 'In-memory cache', store: 'Plain-text file (git-credentials)' }

/** Fold the checks into one status. Exported for tests. */
function summarize({ version, name, email, helpers }) {
  if (version.notFound || (version.code !== 0 && !parseVersion(version.stdout))) {
    return {
      state: 'unavailable',
      summary: 'git was not found.',
      hint: 'Install Git (git-scm.com, which also installs Git Credential Manager), then check again.',
      details: version.notFound ? [] : [{ label: 'git', value: firstLine(version.stderr) || 'Did not run' }],
    }
  }
  const v = parseVersion(version.stdout)
  const userName = name?.code === 0 ? firstLine(name.stdout) : ''
  const userEmail = email?.code === 0 ? firstLine(email.stdout) : ''
  const list = helpers?.code === 0 ? parseHelpers(helpers.stdout) : []
  const names = list.map(helperName)
  const details = [
    { label: 'git', value: v },
    { label: 'user.name', value: userName || 'Not set', ok: !!userName },
    { label: 'user.email', value: userEmail || 'Not set', ok: !!userEmail },
    {
      label: 'Credential helper',
      value: names.length ? names.map((n) => HELPER_LABEL[n] ?? n).join(', ') : 'None: git asks for a password on every push',
      ok: names.length > 0 && !names.every((n) => n === 'store'),
    },
  ]
  if (names.includes('store')) details.push({ label: 'Note', value: 'The "store" helper keeps passwords unencrypted in a file. Git Credential Manager is safer.', ok: false })

  const missing = [!userName && 'user.name', !userEmail && 'user.email'].filter(Boolean)
  if (missing.length) {
    return {
      state: 'needs-setup',
      summary: `git ${v} is installed, but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set, so commits have no author.`,
      hint: 'In a terminal: git config --global user.name "Your Name" and git config --global user.email you@example.com',
      details,
    }
  }
  return { state: 'ok', summary: `git ${v} is set up${names.length ? '' : ' (no credential helper)'}.`, details }
}

async function status(_conn, deps = {}) {
  const run = deps.runTool ?? runTool
  const opts = { env: QUIET, cwd: os.homedir(), timeoutMs: 20_000 }
  const version = await run('git', ['--version'], opts)
  if (version.notFound) return summarize({ version })
  const [name, email, helpers] = await Promise.all([
    run('git', ['config', '--global', '--get', 'user.name'], opts),
    run('git', ['config', '--global', '--get', 'user.email'], opts),
    // System and global together: Git for Windows sets its helper in the system config.
    run('git', ['config', '--get-all', 'credential.helper'], opts),
  ])
  return summarize({ version, name, email, helpers })
}

module.exports = {
  kind: 'git',
  title: 'Git',
  description: 'The git that GitHub+ and Chat run: its version, commit identity and credential helper.',
  icon: 'git',
  fields: [],
  actions: [],
  status,
  _internal: { summarize, parseVersion, parseHelpers, helperName },
}
