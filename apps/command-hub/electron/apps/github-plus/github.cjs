// GitHub+ and github.com: list the user's repositories on GitHub next to the
// local ones, and create an issue on GitHub when (and only when) the user
// turns that on for the issue they are writing.
//
// Everything goes through the GitHub connection on the Connections page
// (electron/connections/connectors/github.cjs). Until the user adds it,
// nothing here runs: no process, no request. The login stays where the
// connector keeps it (gh's own store, or encrypted / Credential Manager);
// this file only receives it in the main process and never hands it to the
// page.
//
// The repository list is kept in memory for ten minutes (Refresh forces a
// new fetch) and is never written to disk. GitHub's /user/repos with its
// default affiliation returns repos the user owns, repos shared with them
// as a collaborator, and repos of organizations they belong to, so team
// repos the user does not own are included.
//
// No Electron here, so tests run under plain Node with stubbed deps.

const github = require('../../connections/github-api.cjs')

const TTL_MS = 10 * 60_000
const NAME_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/

/** "owner/name" of a github.com remote URL, or null. https, ssh and scp forms. */
function parseGitHubRemote(url) {
  if (typeof url !== 'string') return null
  const m =
    /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/git@github\.com(?::\d+)?\/|git@github\.com:)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/i.exec(url.trim())
  if (!m) return null
  const full = `${m[1]}/${m[2]}`
  return NAME_RE.test(full) ? full : null
}

/** The GitHub repo a local repo belongs to: origin first, then upstream, then any github.com remote. */
function pickGitHubRemote(remotes) {
  const gh = remotes.map((r) => ({ name: r.name, full: parseGitHubRemote(r.url) })).filter((r) => r.full)
  return (gh.find((r) => r.name === 'origin') ?? gh.find((r) => r.name === 'upstream') ?? gh[0])?.full ?? null
}

function relationOf(r, login) {
  const owner = r.owner?.login
  if (owner && login && owner.toLowerCase() === login.toLowerCase()) return 'owner'
  if (r.owner?.type === 'Organization') return 'organization'
  return 'collaborator'
}

/** What the page gets per repo: names, flags and dates only. */
function toRepo(r, login) {
  const fullName = String(r.full_name ?? '')
  if (!NAME_RE.test(fullName)) return null
  return {
    fullName,
    owner: fullName.split('/')[0],
    name: fullName.split('/')[1],
    description: typeof r.description === 'string' ? r.description.slice(0, 300) : '',
    private: !!r.private,
    fork: !!r.fork,
    archived: !!r.archived,
    hasIssues: r.has_issues !== false,
    canPush: !!r.permissions?.push,
    relation: relationOf(r, login),
    pushedAt: typeof r.pushed_at === 'string' ? r.pushed_at : null,
    defaultBranch: typeof r.default_branch === 'string' ? r.default_branch : null,
  }
}

const htmlUrl = (fullName) => `https://github.com/${fullName}`
const cloneUrl = (fullName) => `https://github.com/${fullName}.git`

/**
 * hasConnection(): true once the user added the GitHub connection (runs
 * nothing). getCredentials(): what the connector hands other backends.
 */
function createGitHubService({ hasConnection, getCredentials, deps = {}, now = () => Date.now() }) {
  let cache = null // { at, value }
  let inflight = null

  async function fetchRepos() {
    const creds = await getCredentials()
    const me = await github.request(creds, { path: 'user' }, deps)
    const login = typeof me.data?.login === 'string' ? me.data.login : null
    const { items, truncated } = await github.list(creds, 'user/repos', { sort: 'pushed' }, { maxPages: 10 }, deps)
    const repos = items.map((r) => toRepo(r, login)).filter(Boolean)
    return { connected: true, login, repos, truncated, fetchedAt: new Date(now()).toISOString() }
  }

  return {
    /**
     * { connected: false } until the user sets up GitHub. Otherwise the
     * repos, or the last good list with an error when a fetch failed.
     */
    async repos({ force = false } = {}) {
      if (!(await hasConnection())) {
        cache = null
        return { connected: false, repos: [] }
      }
      if (!force && cache && now() - cache.at < TTL_MS) return cache.value
      if (!inflight) {
        inflight = fetchRepos()
          .then(
            (value) => {
              cache = { at: now(), value }
              return value
            },
            (e) => {
              const last = cache?.value
              const value = { connected: true, login: last?.login ?? null, repos: last?.repos ?? [], truncated: !!last?.truncated, fetchedAt: last?.fetchedAt ?? null, error: e.message }
              // A failure is retried on the next open after a minute, not every render.
              cache = { at: now() - TTL_MS + 60_000, value }
              return value
            },
          )
          .finally(() => (inflight = null))
      }
      return inflight
    },

    /** A repo from the last fetched list (the page can only name repos GitHub listed). */
    known(fullName) {
      if (typeof fullName !== 'string') return null
      return cache?.value?.repos?.find((r) => r.fullName.toLowerCase() === fullName.toLowerCase()) ?? null
    },

    /** Create an issue on GitHub. fullName comes from the repo's own remote, never from the page. */
    async createIssue(fullName, { title, body }) {
      if (!NAME_RE.test(fullName ?? '')) throw new Error('This repository has no github.com remote.')
      if (!(await hasConnection())) throw new Error('Set up GitHub on the Connections page to create issues on GitHub.')
      const creds = await getCredentials()
      const { data } = await github.request(creds, { method: 'POST', path: `repos/${fullName}/issues`, body: { title, body } }, deps)
      const number = Number(data?.number)
      if (!Number.isInteger(number) || number < 1) throw new Error('GitHub did not return the new issue.')
      return { repo: fullName, number, url: `${htmlUrl(fullName)}/issues/${number}` }
    },
  }
}

module.exports = { createGitHubService, parseGitHubRemote, pickGitHubRemote, htmlUrl, cloneUrl, NAME_RE, _internal: { toRepo, relationOf } }
