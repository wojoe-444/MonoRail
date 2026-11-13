// Atlassian API token connector (Jira Cloud, Confluence).
//
// An API token (id.atlassian.com > Security > API tokens) is sent as Basic
// auth with the account email. The token comes from one of two places:
//
//   direct   pasted into MonoRail, stored encrypted with safeStorage
//   wincred  read from a named generic credential in Windows Credential
//            Manager each time it is needed; MonoRail stores only the name.
//            If the email is left blank, the credential's user name is used.
//
// Other backends get the resolved { siteUrl, email, token } through
// credentials() (see index.cjs), never the page.

const wincred = require('../wincred.cjs')

function normalizeSite(siteUrl) {
  let s = String(siteUrl ?? '').trim()
  if (!s) throw new Error('Enter your Atlassian site, like your-team.atlassian.net.')
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  const u = new URL(s)
  if (u.protocol !== 'https:') throw new Error('The Atlassian site must use https.')
  return `https://${u.host}`
}

function validate({ values, secretsSet }) {
  normalizeSite(values.siteUrl)
  if (values.tokenSource === 'wincred') {
    wincred.validTarget(values.credentialTarget)
  } else {
    if (!values.email) throw new Error('Enter the email of your Atlassian account.')
    if (!secretsSet.token) throw new Error('Paste your Atlassian API token.')
  }
}

/** Resolve the site, email and token, reading Credential Manager if configured. */
async function credentials(conn, { readCredential = wincred.readCredential } = {}) {
  if (!conn) throw new Error('Add an Atlassian connection on the Connections page first.')
  const { values, secrets } = conn
  const siteUrl = normalizeSite(values.siteUrl)
  let email = values.email
  let token
  if (values.tokenSource === 'wincred') {
    const cred = await readCredential(values.credentialTarget)
    token = cred.secret
    if (!email) email = cred.userName
    if (!token) throw new Error(`The Credential Manager entry "${values.credentialTarget}" has no password stored.`)
  } else {
    token = secrets.token
    if (!token) throw new Error('The saved Atlassian token could not be read. Paste it again on the Connections page.')
  }
  if (!email) throw new Error('Enter the email of your Atlassian account (the Credential Manager entry has no user name).')
  return { siteUrl, email, token }
}

async function status(conn, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch
  if (!conn) return { state: 'needs-setup', summary: 'Add your Atlassian site and API token.', details: [] }
  const source = conn.values.tokenSource === 'wincred' ? `Credential Manager: ${conn.values.credentialTarget}` : 'Saved in MonoRail (encrypted)'
  const details = [
    { label: 'Site', value: conn.values.siteUrl },
    { label: 'Token', value: source },
  ]
  let creds
  try {
    creds = await credentials(conn, deps)
  } catch (e) {
    return { state: 'error', summary: e.message, details }
  }
  details.splice(1, 0, { label: 'Email', value: creds.email })
  let res
  try {
    res = await fetchImpl(`${creds.siteUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${Buffer.from(`${creds.email}:${creds.token}`).toString('base64')}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    return { state: 'error', summary: `Could not reach ${creds.siteUrl}: ${e.cause?.code ?? e.message}`, details }
  }
  if (res.status === 401) {
    return {
      state: 'expired',
      summary: 'Atlassian rejected the token. It may have expired or been revoked, or the email does not match.',
      hint: 'Create a new API token at id.atlassian.com and update it here or in Credential Manager.',
      details,
    }
  }
  if (!res.ok) return { state: 'error', summary: `Atlassian answered ${res.status} ${res.statusText}.`, details }
  const me = await res.json().catch(() => ({}))
  return { state: 'ok', summary: `Connected as ${me.displayName ?? creds.email}.`, details, account: me.displayName }
}

module.exports = {
  kind: 'atlassian',
  title: 'Atlassian',
  description: 'An Atlassian API token for Jira Cloud. Used by Tasks.',
  icon: 'key',
  fields: [
    { key: 'siteUrl', label: 'Site', type: 'text', placeholder: 'your-team.atlassian.net' },
    {
      key: 'tokenSource',
      label: 'Where the token is',
      type: 'select',
      options: [
        { value: 'direct', label: 'Paste it into MonoRail' },
        { value: 'wincred', label: 'Windows Credential Manager entry' },
      ],
      defaultValue: 'direct',
    },
    { key: 'email', label: 'Account email', type: 'text', placeholder: 'you@example.com', help: 'For a Credential Manager entry, leave blank to use the entry’s user name.' },
    {
      key: 'token',
      label: 'API token',
      type: 'secret',
      showIf: { tokenSource: 'direct' },
      help: 'Create one at id.atlassian.com > Security > API tokens. Stored encrypted on this PC.',
    },
    {
      key: 'credentialTarget',
      label: 'Credential Manager entry',
      type: 'text',
      showIf: { tokenSource: 'wincred' },
      placeholder: 'e.g. atlassian-api-token',
      help: 'The name of a generic credential. Its password is the token; MonoRail reads it each time and does not copy it.',
      credentialPicker: true,
    },
  ],
  actions: [],
  validate,
  status,
  credentials,
  _internal: { normalizeSite },
}
