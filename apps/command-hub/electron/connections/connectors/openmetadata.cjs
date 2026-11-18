// OpenMetadata connector: an OpenMetadata server (2.0.x), for the
// OpenMetadata page (electron/modules/openmetadata.cjs).
//
// Optional, like every connector: nothing here runs until the user adds the
// connection. Two ways to sign in, both stored the usual way (secret fields
// encrypted with safeStorage, never sent to the page):
//
//   token   a bot's JWT (OpenMetadata > Settings > Bots). Preferred.
//   login   an email and password, exchanged for a token with
//           POST /api/v1/users/login (OpenMetadata wants the password
//           base64-encoded). Basic auth logins only, not SSO.
//
// The server must be https, except on this PC (localhost), where
// OpenMetadata's Docker Compose serves plain http on port 8585.
//
// The check reads GET /api/v1/system/version and the signed-in user
// (GET /api/v1/users/loggedInUser); nothing is written.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function normalizeUrl(url) {
  let s = String(url ?? '').trim()
  if (!s) throw new Error('Enter the OpenMetadata server, like http://localhost:8585.')
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  let u
  try {
    u = new URL(s)
  } catch {
    throw new Error('That is not a web address. Enter the OpenMetadata server, like http://localhost:8585.')
  }
  if (u.protocol === 'http:' && !LOCAL_HOSTS.has(u.hostname)) {
    throw new Error('Use https for an OpenMetadata server on another computer. Plain http is only allowed for localhost.')
  }
  // The API is /api/v1 under the server; drop a pasted /api/v1 or trailing slash.
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '').replace(/\/api(\/v1)?$/, '')}`
}

function validate({ values, secretsSet }) {
  normalizeUrl(values.url)
  if (values.auth === 'login') {
    if (!values.email) throw new Error('Enter the email you sign in to OpenMetadata with.')
    if (!secretsSet.password) throw new Error('Enter your OpenMetadata password.')
  } else if (!secretsSet.token) {
    throw new Error('Paste a bot token (OpenMetadata > Settings > Bots).')
  }
}

/** What the OpenMetadata backend needs: the server and how to sign in. */
async function credentials(conn) {
  if (!conn) throw new Error('Add an OpenMetadata connection on the Connections page first.')
  const { values, secrets } = conn
  const url = normalizeUrl(values.url)
  if (values.auth === 'login') {
    if (!secrets.password) throw new Error('The saved OpenMetadata password could not be read. Enter it again on the Connections page.')
    return { url, auth: 'login', email: values.email, password: secrets.password }
  }
  if (!secrets.token) throw new Error('The saved OpenMetadata token could not be read. Paste it again on the Connections page.')
  return { url, auth: 'token', token: secrets.token }
}

/** A bearer token for these credentials: the bot token, or a fresh login. */
async function accessToken(creds, fetchImpl = fetch) {
  if (creds.auth !== 'login') {
    if (!creds.token) throw new Error('No OpenMetadata token is saved. Paste one on the Connections page.')
    return creds.token
  }
  if (!creds.email || !creds.password) throw new Error('Enter the OpenMetadata email and password on the Connections page.')
  const res = await fetchImpl(`${creds.url}/api/v1/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: creds.email, password: Buffer.from(creds.password, 'utf8').toString('base64') }),
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 401 || res.status === 400) {
    const err = new Error('OpenMetadata did not accept that email and password.')
    err.status = 401
    throw err
  }
  if (!res.ok) throw new Error(`OpenMetadata answered ${res.status} ${res.statusText} to the sign-in.`)
  const body = await res.json().catch(() => ({}))
  if (!body.accessToken) throw new Error('OpenMetadata signed in but sent no token.')
  return body.accessToken
}

async function status(conn, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch
  if (!conn) return { state: 'needs-setup', summary: 'Add your OpenMetadata server and a bot token.', details: [] }
  const details = [
    { label: 'Server', value: conn.values.url },
    { label: 'Signs in with', value: conn.values.auth === 'login' ? `Email and password (${conn.values.email})` : 'Bot token (encrypted)' },
  ]
  let creds
  try {
    creds = await credentials(conn)
  } catch (e) {
    return { state: 'error', summary: e.message, details }
  }
  let version
  try {
    const res = await fetchImpl(`${creds.url}/api/v1/system/version`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return { state: 'error', summary: `${creds.url} answered ${res.status} ${res.statusText}. Is it an OpenMetadata server?`, details }
    version = (await res.json().catch(() => ({}))).version
  } catch (e) {
    return { state: 'error', summary: `Could not reach ${creds.url}: ${e.cause?.code ?? e.message}`, hint: 'Is OpenMetadata running? Its Docker Compose takes a few minutes to start.', details }
  }
  if (version) details.push({ label: 'Version', value: version, ok: /^2\.0\./.test(version) || undefined })
  let token
  try {
    token = await accessToken(creds, fetchImpl)
  } catch (e) {
    return { state: e.status === 401 ? 'expired' : 'error', summary: e.message, details }
  }
  let res
  try {
    res = await fetchImpl(`${creds.url}/api/v1/users/loggedInUser`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    return { state: 'error', summary: `Could not reach ${creds.url}: ${e.cause?.code ?? e.message}`, details }
  }
  if (res.status === 401 || res.status === 403) {
    return {
      state: 'expired',
      summary: 'OpenMetadata rejected the token. It may have expired or been revoked.',
      hint: 'Copy the bot token again from OpenMetadata > Settings > Bots and update it here.',
      details,
    }
  }
  if (!res.ok) return { state: 'error', summary: `OpenMetadata answered ${res.status} ${res.statusText}.`, details }
  const me = await res.json().catch(() => ({}))
  const who = me.displayName || me.name || 'unknown user'
  return { state: 'ok', summary: version ? `Connected to OpenMetadata ${version} as ${who}.` : `Connected to OpenMetadata as ${who}.`, details, account: who }
}

module.exports = {
  kind: 'openmetadata',
  // Also where server-run ingestion pipelines live (Services page).
  service: { category: 'metadataService', serviceType: 'OpenMetadata' },
  title: 'OpenMetadata',
  description: 'An OpenMetadata server and a way to sign in to it. Used by the OpenMetadata page.',
  icon: 'database',
  fields: [
    { key: 'url', label: 'Server', type: 'text', defaultValue: 'http://localhost:8585', placeholder: 'http://localhost:8585', help: 'https, or http on this PC (localhost).' },
    {
      key: 'auth',
      label: 'Sign in with',
      type: 'select',
      options: [
        { value: 'token', label: 'A bot token' },
        { value: 'login', label: 'Email and password' },
      ],
      defaultValue: 'token',
    },
    {
      key: 'token',
      label: 'Bot token',
      type: 'secret',
      showIf: { auth: 'token' },
      help: 'OpenMetadata > Settings > Bots: open a bot (or make one) and copy its token. Stored encrypted on this PC.',
    },
    { key: 'email', label: 'Email', type: 'text', showIf: { auth: 'login' }, placeholder: 'you@example.com' },
    { key: 'password', label: 'Password', type: 'secret', showIf: { auth: 'login' }, help: 'Stored encrypted on this PC.' },
  ],
  actions: [],
  validate,
  status,
  credentials,
  accessToken,
  _internal: { normalizeUrl },
}
