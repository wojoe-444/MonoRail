// GitHub connector: the github.com account GitHub+ lists repositories from
// and, only when the user turns it on per issue, creates issues with.
//
// The login comes from one of three places:
//
//   gh       the user's own GitHub CLI login (default). MonoRail runs
//            `gh api ...` and gh sends the request; the token stays in gh's
//            own store and MonoRail never reads it (no `gh auth token`).
//   direct   a token pasted into MonoRail, stored encrypted with safeStorage.
//   wincred  a token read from a named generic credential in Windows
//            Credential Manager each time; MonoRail stores only the name.
//
// Opt-in like every connector: nothing runs and nothing calls GitHub until
// the user adds this connection. Other backends get { via: 'gh' } or
// { via: 'token', token } through credentials(), in the main process only,
// and talk to the API with ../github-api.cjs.

const github = require('../github-api.cjs')
const { openTerminal } = require('../run.cjs')
const wincred = require('../wincred.cjs')

const SOURCE_LABEL = { gh: 'GitHub CLI (gh) login', direct: 'Saved in MonoRail (encrypted)', wincred: 'Credential Manager' }

function validate({ values, secretsSet }) {
  if (values.source === 'wincred') wincred.validTarget(values.credentialTarget)
  else if (values.source === 'direct' && !secretsSet.token) throw new Error('Paste a GitHub token, or pick the GitHub CLI login.')
}

/** { via: 'gh' } or { via: 'token', token }. Reads Credential Manager when configured. */
async function credentials(conn, { readCredential = wincred.readCredential } = {}) {
  if (!conn) throw new Error('Set up GitHub on the Connections page first.')
  const { values, secrets } = conn
  if (values.source === 'direct') {
    if (!secrets.token) throw new Error('The saved GitHub token could not be read. Paste it again on the Connections page.')
    return { via: 'token', token: secrets.token }
  }
  if (values.source === 'wincred') {
    const cred = await readCredential(values.credentialTarget)
    if (!cred.secret) throw new Error(`The Credential Manager entry "${values.credentialTarget}" has no password stored.`)
    return { via: 'token', token: cred.secret }
  }
  return { via: 'gh' }
}

/** Classic tokens list their scopes; fine-grained tokens and gh logins do not. */
function scopeDetail(scopes) {
  if (scopes === undefined) return undefined
  const list = String(scopes).split(',').map((s) => s.trim()).filter(Boolean)
  const ok = list.includes('repo')
  return {
    label: 'Token scopes',
    value: list.length ? list.join(', ') + (ok ? '' : ' (add "repo" to see private repositories and create issues)') : 'None (public data only)',
    ok,
  }
}

async function status(conn, deps = {}) {
  if (!conn) return { state: 'needs-setup', summary: 'Pick how MonoRail signs in to GitHub.', details: [] }
  const source = conn.values.source || 'gh'
  const details = [{ label: 'Login', value: source === 'wincred' ? `${SOURCE_LABEL.wincred}: ${conn.values.credentialTarget}` : SOURCE_LABEL[source] }]
  let creds
  try {
    creds = await credentials(conn, deps)
  } catch (e) {
    return { state: 'error', summary: e.message, details }
  }
  let me
  try {
    me = await github.request(creds, { path: 'user' }, deps)
  } catch (e) {
    if (e.status === 401) {
      return {
        state: 'expired',
        summary: e.message,
        hint: source === 'gh' ? 'Sign in runs "gh auth login" in a terminal.' : 'Create a new token on github.com (Settings > Developer settings) and update it here or in Credential Manager.',
        details,
      }
    }
    const unavailable = source === 'gh' && /was not found/.test(e.message)
    return { state: unavailable ? 'unavailable' : 'error', summary: e.message, hint: unavailable ? 'Install the GitHub CLI from cli.github.com, then check again.' : undefined, details }
  }
  const login = typeof me.data?.login === 'string' ? me.data.login : 'unknown'
  details.unshift({ label: 'Account', value: login })
  const scopes = scopeDetail(me.scopes)
  if (scopes) details.push(scopes)
  return { state: 'ok', summary: `Signed in to GitHub as ${login}.`, details }
}

module.exports = {
  kind: 'github',
  title: 'GitHub',
  description: 'Your github.com account. GitHub+ lists your repositories (owned, shared with you, and your organizations’) and can create an issue on GitHub when you ask it to.',
  icon: 'git',
  fields: [
    {
      key: 'source',
      label: 'How to sign in',
      type: 'select',
      options: [
        { value: 'gh', label: 'GitHub CLI (gh) login' },
        { value: 'direct', label: 'Paste a token into MonoRail' },
        { value: 'wincred', label: 'Windows Credential Manager entry' },
      ],
      defaultValue: 'gh',
      help: 'With the GitHub CLI, gh keeps the login and MonoRail never sees a token.',
    },
    {
      key: 'token',
      label: 'Token',
      type: 'secret',
      showIf: { source: 'direct' },
      help: 'A classic token with the "repo" scope sees every repository you can reach. A fine-grained token sees only the owner it was made for. Stored encrypted on this PC.',
    },
    {
      key: 'credentialTarget',
      label: 'Credential Manager entry',
      type: 'text',
      showIf: { source: 'wincred' },
      placeholder: 'e.g. github-token',
      help: 'The name of a generic credential whose password is a GitHub token. MonoRail reads it each time and does not copy it.',
      credentialPicker: true,
    },
  ],
  actions: [
    {
      id: 'sign-in',
      label: 'Sign in',
      description: 'Opens a terminal running gh auth login. Finish there, then check again.',
      showWhen: ['expired', 'needs-setup', 'error'],
      run: async (conn) => {
        if ((conn?.values?.source || 'gh') !== 'gh') throw new Error('Sign in is for the GitHub CLI login. For a token, edit the connection.')
        openTerminal('GitHub sign-in', 'gh', ['auth', 'login'])
      },
    },
  ],
  validate,
  status,
  credentials,
  _internal: { scopeDetail },
}
