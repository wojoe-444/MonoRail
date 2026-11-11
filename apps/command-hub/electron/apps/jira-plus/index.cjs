// Jira+ backend: one tracker for two kinds of projects.
//
//   source "jira"   your team's Jira Cloud site, through the REST API (cloud.cjs)
//   source "local"  personal projects kept in a git repository under AppData
//                   (local.cjs), never pushed anywhere
//
// Both return the same issue shape, so the app treats them alike.
//
// Private data rule: the Jira site, email and API token are saved in
// <dataDir>\connection.json, with the token encrypted by Electron
// safeStorage. The local repo is <dataDir>\local-repo.
//
// <dataDir> is %APPDATA%\MonoRail\apps\jira-plus. Before Jira+ was an app it
// was the "jira" module, whose data lives in ...\modules\jira. If that folder
// holds data and the new one doesn't, keep using the old one in place. It is
// never moved or copied (see "names that must not change" in CLAUDE.md).

const fsSync = require('node:fs')
const fs = require('node:fs/promises')
const path = require('node:path')
const { safeStorage } = require('electron')

const { createJiraClient, normalizeSite } = require('./cloud.cjs')
const { createLocalStore } = require('./local.cjs')

const CONNECTION_FILE = 'connection.json'
const DEFAULT_SCOPE = 'assignee = currentUser()'
const RECENT_DONE = 'statusCategory != Done OR updated >= -14d'

const LEGACY_DIR = ['..', '..', 'modules', 'jira']

let resolvedDir
function dataDir(ctx) {
  if (resolvedDir) return resolvedDir
  const holdsData = (dir) => ['local-repo', CONNECTION_FILE].some((f) => fsSync.existsSync(path.join(dir, f)))
  const legacy = path.resolve(ctx.dataDir, ...LEGACY_DIR)
  resolvedDir = !holdsData(ctx.dataDir) && holdsData(legacy) ? legacy : ctx.dataDir
  return resolvedDir
}

let store
function localStore(ctx) {
  if (!store) store = createLocalStore(path.join(dataDir(ctx), 'local-repo'))
  return store
}

// ---------- connection ----------

async function readConnection(ctx) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir(ctx), CONNECTION_FILE), 'utf8'))
  } catch {
    return undefined
  }
}

function decryptToken(conn) {
  if (!conn?.token) return undefined
  if (conn.encrypted) return safeStorage.decryptString(Buffer.from(conn.token, 'base64'))
  return conn.token
}

async function writeConnection(ctx, { siteUrl, email, token, scopeJql, accountId, displayName }) {
  const encrypted = safeStorage.isEncryptionAvailable()
  const data = {
    siteUrl,
    email,
    scopeJql,
    accountId,
    displayName,
    encrypted,
    token: encrypted ? safeStorage.encryptString(token).toString('base64') : token,
    savedAt: new Date().toISOString(),
  }
  await fs.writeFile(path.join(dataDir(ctx), CONNECTION_FILE), JSON.stringify(data, null, 2))
  return data
}

async function client(ctx) {
  const conn = await readConnection(ctx)
  if (!conn) throw new Error('Connect your Jira site first.')
  return { conn, jira: createJiraClient({ siteUrl: conn.siteUrl, email: conn.email, token: decryptToken(conn) }) }
}

/** The connection as the page may see it: never the token. */
function publicConnection(conn, extra = {}) {
  if (!conn) return { connected: false, scopeJql: DEFAULT_SCOPE }
  return {
    connected: true,
    siteUrl: conn.siteUrl,
    email: conn.email,
    displayName: conn.displayName,
    scopeJql: conn.scopeJql || DEFAULT_SCOPE,
    encrypted: !!conn.encrypted,
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
  methods: {
    /** Projects from both sources plus the Jira connection status. Jira errors don't hide local projects. */
    async getOverview(ctx) {
      const local = localStore(ctx)
      const conn = await readConnection(ctx)
      const localProjects = await local.listProjects()

      let jiraProjects = []
      let connection = publicConnection(conn)
      if (conn) {
        try {
          const { jira } = await client(ctx)
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

      const conn = await readConnection(ctx)
      const jiraIssues = async (projectKey) => {
        if (!conn) return []
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
      const key = await jira.createIssue({ ...args, summary, accountId: conn.accountId })
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

    /** Local tickets only: team Jira deletes stay in Jira itself. */
    async deleteIssue(ctx, args) {
      if (requireSource(args) !== 'local') throw new Error('Delete team Jira tickets in Jira.')
      return localStore(ctx).deleteIssue(args)
    },

    async createLocalProject(ctx, args) {
      return localStore(ctx).createProject(args ?? {})
    },

    async updateLocalProject(ctx, args) {
      return localStore(ctx).updateProject(args ?? {})
    },

    /**
     * saveConnection({ siteUrl, email, token?, scopeJql })
     * Tests the credentials against /myself before saving. Leave token empty
     * to keep the saved one (e.g. when only changing the JQL).
     */
    async saveConnection(ctx, args) {
      const prev = await readConnection(ctx)
      const siteUrl = normalizeSite(args?.siteUrl)
      const email = String(args?.email ?? '').trim()
      const token = String(args?.token ?? '').trim() || decryptToken(prev)
      const scopeJql = String(args?.scopeJql ?? '').trim() || DEFAULT_SCOPE
      if (!email) throw new Error('Enter the email you sign in to Jira with.')
      if (!token) throw new Error('Paste an Atlassian API token.')

      const jira = createJiraClient({ siteUrl, email, token })
      const me = await jira.myself()
      // Validate the JQL now so a typo shows up here, not as an empty board.
      await jira.search(`(${scopeClause({ scopeJql })}) ORDER BY updated DESC`, 1)
      const saved = await writeConnection(ctx, {
        siteUrl,
        email,
        token,
        scopeJql,
        accountId: me.accountId,
        displayName: me.displayName,
      })
      return publicConnection(saved)
    },

    async disconnect(ctx) {
      await fs.rm(path.join(dataDir(ctx), CONNECTION_FILE), { force: true })
      return publicConnection(undefined)
    },
  },
}
