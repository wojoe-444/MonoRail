// Jira+ backend: one tracker for two kinds of projects.
//
//   source "jira"   your team's Jira Cloud site, through the REST API (cloud.cjs)
//   source "local"  personal projects kept in a git repository under AppData
//                   (local.cjs), never pushed anywhere
//
// Both return the same issue shape, so the app treats them alike.
//
// Private data rule: team Jira credentials come from the Atlassian connection
// on the Connections page (see "connection" below); Jira+ keeps only its JQL
// setting in <dataDir>\settings.json. The local repo is <dataDir>\local-repo.
//
// <dataDir> is %APPDATA%\MonoRail\apps\jira-plus. Before Jira+ was an app it
// was the "jira" module, whose data lives in ...\modules\jira. If that folder
// holds data and the new one doesn't, keep using the old one in place. It is
// never moved or copied (see "names that must not change" in CLAUDE.md).

const fs = require('node:fs/promises')
const path = require('node:path')
const { BrowserWindow, dialog, safeStorage } = require('electron')

const { createJiraClient } = require('./cloud.cjs')
const { createLocalStore, worklogEntry } = require('./local.cjs')
const { resolveJiraDataDir, CONNECTION_FILE } = require('./data-dir.cjs')
const { createRepoLinks } = require('./repo-links.cjs')
const ghGit = require('../github-plus/git.cjs')
const { pickGitHubRemote } = require('../github-plus/github.cjs')

const DEFAULT_SCOPE = 'assignee = currentUser()'
const RECENT_DONE = 'statusCategory != Done OR updated >= -14d'

// Keyed by ctx.dataDir: one entry in the app, one per temp folder in tests.
const resolvedDirs = new Map()
function dataDir(ctx) {
  if (!resolvedDirs.has(ctx.dataDir)) resolvedDirs.set(ctx.dataDir, resolveJiraDataDir(ctx.dataDir))
  return resolvedDirs.get(ctx.dataDir)
}

const stores = new Map()
function localStore(ctx) {
  const dir = path.join(dataDir(ctx), 'local-repo')
  if (!stores.has(dir)) stores.set(dir, createLocalStore(dir))
  return stores.get(dir)
}

// ---------- repository links ----------
//
// A task can be linked to local git repos and to repos on github.com
// (repo-links.cjs, <dataDir>\repo-links.json). Links are only stored here:
// nothing is written to Jira, GitHub or any repository. GitHub+ reads them
// through tasksForRepo below.

const linkStores = new Map()
function repoLinks(ctx) {
  const dir = dataDir(ctx)
  if (!linkStores.has(dir)) linkStores.set(dir, createRepoLinks(dir))
  return linkStores.get(dir)
}

/** A local repo as a link stores it: its root (as git reports it), name and github.com remote. Runs git only. */
async function describeLocalRepo(dir) {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('Pick a repository folder.')
  const info = await ghGit.openRepo(dir)
  const github = pickGitHubRemote(await ghGit.remotes(info.path).catch(() => []))
  return { path: info.path, name: info.name, github }
}

/** What GitHub+ shows for a task: key, summary and status, or why it can't be read. */
function taskRow(link, issue, error) {
  const base = { linkId: link.id, source: link.issue.source, key: link.issue.key, linkedAt: link.linkedAt, repo: link.repo }
  if (!issue) return { ...base, error: error ?? 'Not found' }
  return {
    ...base,
    summary: issue.summary,
    status: issue.status,
    statusCategory: issue.statusCategory,
    type: issue.type,
    projectName: issue.projectName,
    url: issue.url,
  }
}

/**
 * Tasks linked to a repo (by folder and/or GitHub name), with their summary
 * and status: local tickets from the local repo, team tickets with one Jira
 * search when an Atlassian connection is set up. Used by GitHub+.
 */
async function tasksForRepo(ctx, { path: p, github } = {}) {
  const links = await repoLinks(ctx).forRepo({ path: p, github })
  if (!links.length) return []
  const local = links.filter((l) => l.issue.source === 'local')
  const team = links.filter((l) => l.issue.source === 'jira')

  const localRows = await Promise.all(
    local.map((l) =>
      localStore(ctx)
        .getIssue(l.issue.key)
        .then((i) => taskRow(l, i), () => taskRow(l, null, 'This ticket no longer exists in Jira+.')),
    ),
  )

  let teamRows = []
  if (team.length) {
    const conn = await resolveConnection(ctx)
    if (conn.missing || conn.error) {
      const why = conn.missing ? 'Team Jira is not set up on the Connections page.' : conn.error
      teamRows = team.map((l) => taskRow(l, null, why))
    } else {
      const { jira } = await client(ctx)
      const keys = team.map((l) => l.issue.key)
      let found
      try {
        found = await jira.search(`key in (${keys.map(jqlString).join(', ')})`, keys.length)
      } catch {
        // One unknown key fails the whole search: ask for each key on its own.
        found = (await Promise.all(keys.map((k) => jira.search(`key = ${jqlString(k)}`, 1).catch(() => [])))).flat()
      }
      const byKey = new Map(found.map((i) => [i.key, i]))
      teamRows = team.map((l) => taskRow(l, byKey.get(l.issue.key), 'Not found in your team Jira (or no access).'))
    }
  }
  return [...localRows, ...teamRows]
}

// ---------- connection ----------
//
// Team Jira credentials come from the Atlassian connection on the Connections
// page (electron/connections, getCredentials('atlassian')). Installs from
// before Connections existed may still have their own connection.json here
// (site, email, safeStorage-encrypted token); it is used only when no
// Atlassian connection is set up, and "Forget" deletes it. Which issues to
// show (scopeJql) is a Jira+ setting, kept in settings.json.

const SETTINGS_FILE = 'settings.json'
const NOT_SET_UP = /Add an Atlassian connection/i

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return undefined
  }
}

const readLegacy = (ctx) => readJson(path.join(dataDir(ctx), CONNECTION_FILE))
const readSettings = async (ctx) => (await readJson(path.join(dataDir(ctx), SETTINGS_FILE))) ?? {}

function decryptToken(conn) {
  if (!conn?.token) return undefined
  if (conn.encrypted) return safeStorage.decryptString(Buffer.from(conn.token, 'base64'))
  return conn.token
}

/** Tests replace this; the app reads the shared Connections service. */
let atlassianCredentials = () => require('../../connections/index.cjs').getCredentials('atlassian')

/**
 * The team Jira connection in effect, or { missing } / { error }.
 * Never returned to the page as is: see publicConnection.
 */
async function resolveConnection(ctx) {
  const settings = await readSettings(ctx)
  const legacy = await readLegacy(ctx)
  const scopeJql = settings.scopeJql || legacy?.scopeJql || DEFAULT_SCOPE
  try {
    const { siteUrl, email, token } = await atlassianCredentials()
    return { via: 'connections', siteUrl, email, token, scopeJql }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (!NOT_SET_UP.test(message)) return { via: 'connections', scopeJql, error: message }
  }
  if (legacy) {
    return {
      via: 'legacy',
      siteUrl: legacy.siteUrl,
      email: legacy.email,
      token: decryptToken(legacy),
      scopeJql,
      accountId: legacy.accountId,
      displayName: legacy.displayName,
    }
  }
  return { missing: true, scopeJql }
}

// Who the token belongs to, per site + email, for "assign to me" and the UI.
const accounts = new Map()
async function myAccount(conn, jira) {
  if (conn.accountId) return { accountId: conn.accountId, displayName: conn.displayName }
  const id = `${conn.siteUrl}|${conn.email}`
  if (!accounts.has(id)) {
    const me = await jira.myself()
    accounts.set(id, { accountId: me.accountId, displayName: me.displayName })
  }
  return accounts.get(id)
}

async function client(ctx) {
  const conn = await resolveConnection(ctx)
  if (conn.missing) throw new Error('Add an Atlassian connection on the Connections page to see your team Jira.')
  if (conn.error) throw new Error(conn.error)
  return { conn, jira: createJiraClient({ siteUrl: conn.siteUrl, email: conn.email, token: conn.token }) }
}

/** The connection as the page may see it: never the token. */
function publicConnection(conn, extra = {}) {
  if (conn.missing) return { connected: false, scopeJql: conn.scopeJql, ...extra }
  return {
    connected: !conn.error,
    via: conn.via,
    siteUrl: conn.siteUrl,
    email: conn.email,
    displayName: conn.displayName,
    scopeJql: conn.scopeJql,
    error: conn.error,
    ...extra,
  }
}

/** User JQL without its ORDER BY, so it can be combined with other clauses. */
function scopeClause(conn) {
  const jql = (conn?.scopeJql || DEFAULT_SCOPE).replace(/\border\s+by\b[\s\S]*$/i, '').trim()
  return jql || DEFAULT_SCOPE
}

function jqlString(s) {
  return `"${String(s).replace(/(["\\])/g, '\\$1')}"`
}

// ---------- helpers ----------

function requireSource(args) {
  const source = args?.source
  if (source !== 'jira' && source !== 'local') throw new Error(`Unknown source: ${source}`)
  return source
}

module.exports = {
  id: 'jira-plus',
  // Methods that act on this PC's own screen (a dialog, Explorer, a terminal,
  // a restart). Remote access never runs them (electron/bridge/desktop-only.cjs).
  desktopOnly: ['pickRepoFolder'],
  tasksForRepo,
  repoLinks,
  /** For tests: swap where Atlassian credentials come from. */
  _setCredentialSource(fn) {
    atlassianCredentials = fn
    accounts.clear()
  },
  methods: {
    /** Projects from both sources plus the Jira connection status. Jira errors don't hide local projects. */
    async getOverview(ctx) {
      const local = localStore(ctx)
      const conn = await resolveConnection(ctx)
      const localProjects = await local.listProjects()

      let jiraProjects = []
      let connection = publicConnection(conn)
      if (!conn.missing && !conn.error) {
        try {
          const { jira } = await client(ctx)
          connection = publicConnection(conn, { displayName: (await myAccount(conn, jira)).displayName })
          const issues = await jira.search(`(${scopeClause(conn)}) AND (${RECENT_DONE}) ORDER BY updated DESC`)
          const byKey = new Map()
          for (const i of issues) {
            const p = byKey.get(i.projectKey) ?? {
              key: i.projectKey,
              name: i.projectName ?? i.projectKey,
              source: 'jira',
              url: `${jira.base}/browse/${i.projectKey}`,
              issueCount: 0,
              openCount: 0,
            }
            p.issueCount += 1
            if (i.statusCategory !== 'done') p.openCount += 1
            byKey.set(i.projectKey, p)
          }
          jiraProjects = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
        } catch (e) {
          connection = publicConnection(conn, { error: e.message })
        }
      }

      return {
        connection,
        projects: [...localProjects, ...jiraProjects],
        local: local.meta,
      }
    },

    /** listIssues({ source: 'local'|'jira'|'all', projectKey? }) */
    async listIssues(ctx, args) {
      const local = localStore(ctx)
      if (args?.source === 'local') return local.listIssues(args.projectKey)

      const conn = await resolveConnection(ctx)
      const jiraIssues = async (projectKey) => {
        if (conn.missing) return []
        const { jira } = await client(ctx)
        const project = projectKey ? `project = ${jqlString(projectKey)} AND ` : ''
        return jira.search(`${project}(${scopeClause(conn)}) AND (${RECENT_DONE}) ORDER BY updated DESC`)
      }
      if (args?.source === 'jira') return jiraIssues(args.projectKey)

      // "All my work": every local project plus the Jira scope.
      const projects = await local.listProjects()
      const [locals, remote] = await Promise.all([
        Promise.all(projects.map((p) => local.listIssues(p.key))).then((l) => l.flat()),
        jiraIssues().catch(() => []),
      ])
      return [...locals, ...remote].sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))
    },

    async getIssue(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).getIssue(args.key)
      const { jira } = await client(ctx)
      return jira.getIssue(args.key)
    },

    /** Issue types offered when creating a ticket in a project. */
    async getIssueTypes(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).meta.types
      const { jira } = await client(ctx)
      return jira.issueTypes(args.projectKey)
    },

    async createIssue(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).createIssue(args)
      const { conn, jira } = await client(ctx)
      const summary = String(args.summary ?? '').trim()
      if (!summary) throw new Error('A ticket needs a summary.')
      const me = await myAccount(conn, jira).catch(() => ({}))
      const key = await jira.createIssue({ ...args, summary, accountId: me.accountId })
      return jira.getIssue(key)
    },

    async updateIssue(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).updateIssue(args)
      const { jira } = await client(ctx)
      await jira.updateIssue(args.key, args.fields ?? {})
      return jira.getIssue(args.key)
    },

    async transitionIssue(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).transitionIssue(args)
      const { jira } = await client(ctx)
      await jira.transition(args.key, args.transitionId)
      return jira.getIssue(args.key)
    },

    async addComment(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).addComment(args)
      const { jira } = await client(ctx)
      return jira.addComment(args.key, String(args.body ?? '').trim())
    },

    /** setParent({ source, key, parent }): parent is an issue key in the same project, or null. */
    async setParent(ctx, args) {
      const parent = args?.parent ? String(args.parent).trim().toUpperCase() : null
      if (parent && !/^[A-Z][A-Z0-9]+-\d+$/.test(parent)) throw new Error(`${parent} is not an issue key, like ME-12.`)
      if (requireSource(args) === 'local') return localStore(ctx).setParent({ key: args.key, parent })
      const { jira } = await client(ctx)
      if (parent && parent.split('-')[0] !== String(args.key).split('-')[0]) throw new Error('A parent must be in the same project.')
      await jira.setParent(args.key, parent)
      return jira.getIssue(args.key)
    },

    /** Issues that can be the parent of `key` (or of a new issue in `projectKey`). */
    async parentOptions(ctx, args) {
      const projectKey = args?.projectKey ?? String(args?.key ?? '').split('-')[0]
      if (requireSource(args) === 'local') return localStore(ctx).parentOptions({ projectKey, key: args?.key })
      const { jira } = await client(ctx)
      return jira.parentOptions(projectKey, args?.key)
    },

    /** logWork({ source, key, seconds, started?, comment? }): time spent on a ticket. Team tickets get a real Jira worklog. */
    async logWork(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).logWork(args)
      const entry = worklogEntry(args ?? {})
      const { jira } = await client(ctx)
      return jira.logWork(args.key, entry)
    },

    async deleteWorklog(ctx, args) {
      if (requireSource(args) === 'local') return localStore(ctx).deleteWorklog(args)
      const { jira } = await client(ctx)
      await jira.deleteWorklog(args.key, String(args.id ?? ''))
      return { ok: true }
    },

    /** Local tickets only: team Jira deletes stay in Jira itself. */
    async deleteIssue(ctx, args) {
      if (requireSource(args) !== 'local') throw new Error('Delete team Jira tickets in Jira.')
      const result = await localStore(ctx).deleteIssue(args)
      await repoLinks(ctx).removeIssue({ source: 'local', key: args.key }).catch(() => undefined)
      return result
    },

    /** Repos linked to a task: [{ id, repo: { kind, path?, github?, name }, linkedAt }]. */
    getRepoLinks: (ctx, args) => repoLinks(ctx).forIssue({ source: args?.source, key: args?.key }),

    /**
     * linkRepo({ source, key, path }) links a local repo (checked with git,
     * stored by its root and github.com remote); linkRepo({ source, key,
     * github: 'owner/name' }) links a repo on github.com. Stored in Jira+'s
     * data folder only. Returns the task's links.
     */
    async linkRepo(ctx, args) {
      const issue = { source: requireSource(args), key: args?.key }
      const repo = args?.path ? await describeLocalRepo(args.path) : { github: args?.github, name: args?.github }
      await repoLinks(ctx).link(issue, repo)
      return repoLinks(ctx).forIssue(issue)
    },

    async unlinkRepo(ctx, args) {
      const issue = { source: requireSource(args), key: args?.key }
      await repoLinks(ctx).unlink(issue, String(args?.id ?? ''))
      return repoLinks(ctx).forIssue(issue)
    },

    /** The system folder picker, for linking a repo that GitHub+ has not opened. */
    async pickRepoFolder() {
      const win = BrowserWindow.getFocusedWindow()
      const opts = { title: 'Link a local git repository', properties: ['openDirectory'] }
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
      return r.canceled ? null : r.filePaths[0]
    },

    async createLocalProject(ctx, args) {
      return localStore(ctx).createProject(args ?? {})
    },

    async updateLocalProject(ctx, args) {
      return localStore(ctx).updateProject(args ?? {})
    },

    /**
     * saveSettings({ scopeJql }): which team issues to show. Checked against
     * Jira first when a connection is set up, so a typo shows up here.
     */
    async saveSettings(ctx, args) {
      const scopeJql = String(args?.scopeJql ?? '').trim() || DEFAULT_SCOPE
      const conn = await resolveConnection(ctx)
      if (!conn.missing && !conn.error) {
        const { jira } = await client(ctx)
        await jira.search(`(${scopeClause({ scopeJql })}) ORDER BY updated DESC`, 1)
      }
      const settings = { ...(await readSettings(ctx)), scopeJql }
      await fs.writeFile(path.join(dataDir(ctx), SETTINGS_FILE), JSON.stringify(settings, null, 2))
      return publicConnection({ ...conn, scopeJql })
    },

    /** Deletes the token Jira+ saved itself before the Connections page existed. */
    async forgetLegacyConnection(ctx) {
      await fs.rm(path.join(dataDir(ctx), CONNECTION_FILE), { force: true })
      return publicConnection(await resolveConnection(ctx))
    },
  },
}
