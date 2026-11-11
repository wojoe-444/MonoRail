// A tiny GitHub REST client shared by the GitHub connector and GitHub+.
//
// It speaks through one of two routes, whichever the user picked on the
// Connections page (see connectors/github.cjs):
//
//   { via: 'gh' }            the user's own GitHub CLI runs `gh api ...`, so
//                            gh keeps the login and MonoRail never sees a
//                            token. Arguments are fixed shapes checked by
//                            run.cjs's SAFE_ARG; a request body goes to gh on
//                            stdin (`--input -`), never on the command line.
//   { via: 'token', token }  a token from the connection (encrypted in
//                            MonoRail or read from Credential Manager), sent
//                            with fetch to api.github.com.
//
// Only api.github.com is ever called. Paths are checked so they cannot leave
// the API (no "..", no query string, no other host).

const { runTool } = require('./run.cjs')

const API = 'https://api.github.com'
const PATH_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/
const FIELD_RE = /^[A-Za-z_]+$/
const VALUE_RE = /^[\w.-]+$/
const GH_ENV = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', GH_PAGER: 'cat', CLICOLOR: '0' }

class GitHubError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
  }
}

function checkPath(p) {
  if (typeof p !== 'string' || !PATH_RE.test(p) || p.split('/').some((s) => s === '.' || s === '..')) throw new Error(`Invalid GitHub API path: ${p}`)
  return p
}

function checkQuery(query = {}) {
  const out = []
  for (const [k, v] of Object.entries(query)) {
    const value = String(v)
    if (!FIELD_RE.test(k) || !VALUE_RE.test(value)) throw new Error(`Invalid GitHub API parameter: ${k}`)
    out.push([k, value])
  }
  return out
}

/** A readable message for an HTTP status from GitHub. */
function explain(status, apiMessage) {
  const tail = apiMessage ? ` (${apiMessage})` : ''
  if (status === 401) return `GitHub rejected the login. It may have expired or been revoked${tail}.`
  if (status === 403) return `GitHub refused the request: the login may lack access, or a rate limit was hit${tail}.`
  if (status === 404) return `GitHub could not find it, or this login cannot see it${tail}.`
  if (status === 410) return `Issues are turned off for this repository on GitHub${tail}.`
  if (status === 422) return `GitHub did not accept the request${tail}.`
  return `GitHub answered ${status}${tail}.`
}

async function viaToken(token, { method, path, query, body }, deps) {
  const fetchImpl = deps.fetch ?? fetch
  const qs = query.length ? `?${new URLSearchParams(query)}` : ''
  let res
  try {
    res = await fetchImpl(`${API}/${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'MonoRail',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw new GitHubError(`Could not reach GitHub: ${e.cause?.code ?? e.message}`, 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new GitHubError(explain(res.status, data?.message), res.status)
  return { data, scopes: res.headers?.get?.('x-oauth-scopes') ?? undefined }
}

async function viaGh({ method, path, query, body }, deps) {
  const run = deps.runTool ?? runTool
  const args = ['api', path, '-X', method]
  for (const [k, v] of query) args.push('-F', `${k}=${v}`)
  if (body !== undefined) args.push('--input', '-')
  const r = await run('gh', args, { env: GH_ENV, timeoutMs: 60_000, input: body === undefined ? undefined : JSON.stringify(body) })
  if (r.notFound) throw new GitHubError('The GitHub CLI (gh) was not found. Install it from cli.github.com, or use a token on the Connections page.', 0)
  if (r.timedOut) throw new GitHubError('The GitHub CLI did not answer in time.', 0)
  if (r.code !== 0) {
    const stderr = String(r.stderr ?? '')
    if (/gh auth login/.test(stderr)) throw new GitHubError('The GitHub CLI is not signed in. Run "gh auth login" in a terminal (or use Sign in on the Connections page).', 401)
    const status = Number(/HTTP (\d{3})/.exec(stderr)?.[1] ?? 0)
    let apiMessage
    try {
      apiMessage = JSON.parse(r.stdout)?.message
    } catch {
      /* not JSON */
    }
    if (status) throw new GitHubError(explain(status, apiMessage), status)
    throw new GitHubError(`The GitHub CLI failed: ${stderr.trim().split(/\r?\n/)[0] || `exit code ${r.code}`}`, 0)
  }
  try {
    return { data: r.stdout.trim() ? JSON.parse(r.stdout) : null }
  } catch {
    throw new GitHubError('The GitHub CLI returned something that is not JSON.', 0)
  }
}

/**
 * One request: { method?, path, query?, body? } -> { data, scopes? }.
 * creds is what the GitHub connector's credentials() returns.
 */
async function request(creds, { method = 'GET', path, query, body } = {}, deps = {}) {
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error(`Unsupported method ${method}`)
  const req = { method, path: checkPath(path), query: checkQuery(query), body }
  if (creds?.via === 'gh') return viaGh(req, deps)
  if (creds?.via === 'token' && typeof creds.token === 'string' && creds.token) return viaToken(creds.token, req, deps)
  throw new Error('No GitHub login to use. Set up GitHub on the Connections page.')
}

/** Every page of a list endpoint (100 a page), up to maxPages. */
async function list(creds, path, query = {}, { maxPages = 10 } = {}, deps = {}) {
  const all = []
  for (let page = 1; page <= maxPages; page++) {
    const { data } = await request(creds, { path, query: { ...query, per_page: 100, page } }, deps)
    if (!Array.isArray(data)) throw new GitHubError('GitHub returned an unexpected answer.', 0)
    all.push(...data)
    if (data.length < 100) return { items: all, truncated: false }
  }
  return { items: all, truncated: true }
}

module.exports = { request, list, GitHubError, _internal: { checkPath, checkQuery, explain } }
