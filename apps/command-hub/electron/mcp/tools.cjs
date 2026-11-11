// The MCP server's read-only tools. Each reads what MonoRail already keeps on
// disk in its data folder (rootDir: a data folder or a profile layout, see
// electron/profiles; e.g. %APPDATA%\MonoRail), or the local
// data MonoRail's own pages read, and never starts a slow build:
//
//   usage_summary            Claude Stats' summary file (written after each report build)
//   list_chat_sessions       Chat's session list (logs read in place, allowed folders only)
//   list_github_plus_repos   GitHub+'s recent repos, with issue counts
//   list_github_plus_issues  local issues of one of those repos (refs/local-issues)
//   get_github_plus_issue
//   list_jira_plus_projects  Jira+'s private local projects (never team Jira)
//   list_jira_plus_issues
//   get_jira_plus_issue
//   connection_status        Connections' last check per account (no secrets)
//   list_flashcard_decks     Flashcards' decks with what is due (decks.json)
//   list_flashcards          cards of one deck, optionally searched
//
// Write tools (writeTools below) are off for every agent until the user turns
// them on per agent on the Agent access page (access.cjs), and every call is
// in the audit log:
//
//   create_github_plus_issue, comment_github_plus_issue
//   create_jira_plus_issue, comment_jira_plus_issue
//   add_flashcards    adds cards to a Flashcards deck (creates the deck if asked)
//   ask_coordinator   runs a turn of the user's Chat coordinator and returns its reply
//
// check_coordinator_reply only reads a turn this same connection started.
//
// Rules: nothing here returns a secret or a token or makes a network request,
// and no read tool writes a file. Repos and folders are the ones the user already allowed in
// MonoRail (GitHub+ recents, Chat's allowed folders); an agent cannot name
// another path.

const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')

const cache = require('../cache/index.cjs')
const { readJson } = require('../cache/files.cjs')
const issues = require('../apps/github-plus/issues.cjs')
const { resolveJiraDataDir } = require('../apps/jira-plus/data-dir.cjs')
const flashcards = require('../modules/flashcards-store.cjs')
const { folderOf } = require('../profiles/index.cjs')

const MAX_TEXT = 20_000
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const clip = (s, max = MAX_TEXT) => (typeof s === 'string' && s.length > max ? `${s.slice(0, max)}\n... (cut at ${max} characters)` : s)
const iso = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined)
const minutes = (ms) => (typeof ms === 'number' ? Math.round(ms / 60000) : undefined)

function folders(rootDir) {
  return {
    claudeStats: folderOf(rootDir, 'modules/claude-stats'),
    agentChat: folderOf(rootDir, 'modules/agent-chat'),
    githubPlus: folderOf(rootDir, 'apps/github-plus'),
    jiraPlus: resolveJiraDataDir(folderOf(rootDir, 'apps/jira-plus')),
    flashcards: folderOf(rootDir, 'modules/flashcards'),
    storage: folderOf(rootDir, 'modules/storage'),
  }
}

// ---------- Storage ----------

const GB = 1024 ** 3
const gb = (bytes) => (typeof bytes === 'number' ? Math.round((bytes / GB) * 100) / 100 : undefined)

/** The Storage page's last saved scan and drive sample, shaped for an agent (sizes in GB). */
async function storageScan(storageDir, { top = 40 } = {}) {
  const all = await cache.history({ dataDir: storageDir, log: () => {} }, 'storage.history').list()
  const scans = all.filter((s) => s.data?.kind === 'scan')
  const last = scans.at(-1)
  const lastDrives = all.at(-1)
  // Free-space goals the user set on the Storage page (goals.json, when that feature is present).
  const goalsFile = await readJson(path.join(storageDir, 'goals.json')).catch(() => undefined)
  const goals = goalsFile?.version === 1 && goalsFile.goals && typeof goalsFile.goals === 'object' ? goalsFile.goals : {}
  const drives = (lastDrives?.data?.drives ?? []).map((d) => {
    const goal = typeof goals[d.id]?.freeBytes === 'number' ? goals[d.id].freeBytes : undefined
    return {
      drive: d.id,
      totalGB: gb(d.total),
      freeGB: gb(d.free),
      usedPercent: d.total ? Math.round(((d.total - d.free) / d.total) * 100) : undefined,
      ...(goal !== undefined ? { freeGoalGB: gb(goal), stillToFreeGB: gb(Math.max(0, goal - d.free)) } : {}),
    }
  })
  if (!last) {
    return {
      available: false,
      reason: 'No folder scan has been saved yet. Open Utilities > Storage in MonoRail and press Scan.',
      drives,
      drivesSampledAt: lastDrives ? new Date(lastDrives.takenAt).toISOString() : undefined,
    }
  }
  const before = scans.at(-2)
  const prev = new Map((before?.data.locations ?? []).map((l) => [l.id, l.bytes]))
  const locations = (last.data.locations ?? [])
    .filter((l) => typeof l.bytes === 'number')
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, top)
    .map((l) => ({
      id: l.id,
      label: l.label,
      group: l.group,
      path: l.path,
      sizeGB: gb(l.bytes),
      files: l.files,
      advice: l.advice,
      tip: l.tip,
      note: l.note,
      measuredOnlyPartly: l.truncated || undefined,
      changeSincePreviousScanGB: prev.has(l.id) ? gb(l.bytes - prev.get(l.id)) : undefined,
      largestChildren: (l.children ?? []).slice(0, 8).map((c) => ({ name: c.name, kind: c.kind, sizeGB: gb(c.bytes) })),
    }))
  return {
    available: true,
    scannedAt: new Date(last.takenAt).toISOString(),
    ageHours: Math.round((Date.now() - last.takenAt) / 36e5),
    previousScanAt: before ? new Date(before.takenAt).toISOString() : undefined,
    adviceMeaning: { safe: 'a cache its tool rebuilds; safe to clear with that tool', review: 'may hold things the user wants; the user decides', keep: 'in use; leave alone' },
    drives,
    locations,
  }
}

// ---------- Flashcards ----------

/** A deck by id or by name (case does not matter). */
function flashcardDeck(data, wanted) {
  const w = String(wanted ?? '').trim()
  const byId = data.decks.find((d) => d.id === w)
  if (byId) return byId
  const byName = data.decks.filter((d) => d.name.toLowerCase() === w.toLowerCase())
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) throw new Error(`Several decks are called "${w}". Pass the deck id from list_flashcard_decks.`)
  return undefined
}

// ---------- GitHub+ ----------

async function githubRecents(dir) {
  const list = await readJson(path.join(dir, 'recents.json'))
  return Array.isArray(list) ? list.filter((p) => typeof p === 'string') : []
}

/** A repo from GitHub+'s recents, by its full path or its folder name. */
async function githubRepo(dir, wanted) {
  const recents = await githubRecents(dir)
  const norm = (p) => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase()
  const exact = recents.find((p) => norm(p) === norm(wanted))
  if (exact) return exact
  const byName = recents.filter((p) => path.basename(p).toLowerCase() === wanted.toLowerCase())
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) throw new Error(`Several GitHub+ repos are called "${wanted}". Pass the full path from list_github_plus_repos.`)
  throw new Error(`"${wanted}" is not one of the repos opened in GitHub+. Call list_github_plus_repos for the list; open a repo in MonoRail's GitHub+ to add it.`)
}

// ---------- Jira+ ----------

function jiraStore(dir) {
  const repoDir = path.join(dir, 'local-repo')
  // Reading must not create the repository, so only open one that exists.
  if (!fsSync.existsSync(path.join(repoDir, '.git'))) return undefined
  const { createLocalStore } = require('../apps/jira-plus/local.cjs')
  return createLocalStore(repoDir)
}

const JIRA_PROJECT = /^[A-Z][A-Z0-9]{1,9}$/
const JIRA_ISSUE = /^[A-Z][A-Z0-9]{1,9}-[1-9]\d{0,6}$/

/** The read-only tools, over the data folder `rootDir`. */
function readTools({ rootDir }) {
  const dir = folders(rootDir)

  return [
    {
      name: 'usage_summary',
      title: 'Agent usage and cost',
      description:
        "API-equivalent spend on coding agents (Claude Code, Gemini CLI, pi) per day for up to the last 30 days, the total, and the top models by cost. From Claude Stats' last cached report; MonoRail rebuilds it every 15 minutes while it runs. Costs are list-price estimates in USD, not a bill. claudeAccount says how the Claude login is billed (subscription: flat fee, so Claude Code costs are API-equivalent; api or enterprise: billed per token at API prices), when the Claude connection has been checked.",
      inputSchema: {
        type: 'object',
        properties: { days: { type: 'integer', minimum: 1, maximum: 30, description: 'How many recent days to return (default 30).' } },
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ days = 30 }) {
        const s = (await cache.readSummaries(rootDir))['claude-stats.summary']
        const status = await readJson(path.join(dir.claudeStats, 'usage.json.status.json'))
        if (!s) {
          return {
            available: false,
            reason: 'There is no usage report yet. Open Claude Stats in MonoRail, or leave MonoRail running: it builds the report in the background.',
          }
        }
        const recent = (s.summary.days ?? []).slice(-days)
        const claudeAccount = (await cache.readSummaries(rootDir))['connections.summary']?.summary?.connections?.claude?.account
        return {
          available: true,
          builtAt: s.builtAt,
          ageMinutes: minutes(s.ageMs),
          stale: s.stale,
          lastBuildError: status?.lastError && Date.parse(status.lastAttemptAt ?? 0) > Date.parse(s.builtAt) ? status.lastError.split('\n')[0] : undefined,
          currency: 'USD',
          totalForDays: recent.reduce((a, d) => a + (d.cost ?? 0), 0),
          days: recent,
          topModels30Days: s.summary.topModels ?? [],
          claudeAccount,
        }
      },
    },

    {
      name: 'list_chat_sessions',
      title: 'Recent agent chats',
      description:
        "Recent local Claude Code and pi sessions, newest first, as MonoRail's Chat page lists them: only sessions whose folder is in a repo the user allowed there. Each has an id, title, repo, branch, model, times, spend when known, and unread/archived/scheduled flags. Transcripts are not returned.",
      inputSchema: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['claude', 'pi'], description: 'Only sessions of this agent.' },
          repo: { type: 'string', maxLength: 260, description: 'Only sessions in the repo with this folder name.' },
          includeArchived: { type: 'boolean', description: 'Include chats archived in MonoRail (default false).' },
          limit: { type: 'integer', minimum: 1, maximum: 60, description: 'At most this many (default 20).' },
        },
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ source, repo, includeArchived = false, limit = 20 }) {
        const { _internal } = require('../modules/agent-chat.cjs')
        const list = await _internal.listSessions({ dataDir: dir.agentChat })
        const sessions = list.sessions
          .filter((s) => !source || s.source === source)
          .filter((s) => !repo || s.repo?.name?.toLowerCase() === repo.toLowerCase())
          .filter((s) => includeArchived || !s.archived)
          .slice(0, limit)
          .map((s) => ({
            id: s.id,
            source: s.source,
            title: s.title,
            repo: s.repo?.name,
            repoPath: s.repo?.path,
            branch: s.branch,
            model: s.model,
            startedAt: iso(s.startedAt),
            updatedAt: iso(s.updatedAt),
            spentUsd: s.total?.usd,
            spendComplete: s.total?.complete,
            unread: s.unread,
            archived: s.archived,
            scheduled: s.scheduled,
            coordinator: s.coordinator || undefined,
          }))
        return {
          sessions,
          sources: list.sources,
          allowedRepos: list.folders?.repoCount,
          note: list.folders?.repoCount ? undefined : 'No allowed repos yet: add them in MonoRail under Chat > Folders.',
        }
      },
    },

    {
      name: 'list_github_plus_repos',
      title: 'GitHub+ repos',
      description: "The local git repos recently opened in MonoRail's GitHub+, with their open and closed local issue counts. Local issues live in each repo under refs/local-issues.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
      async handler() {
        const recents = await githubRecents(dir.githubPlus)
        return {
          repos: await Promise.all(
            recents.map(async (p) => {
              const base = { name: path.basename(p), path: p }
              try {
                await fs.access(p)
                return { ...base, issues: await issues.issueCounts(p) }
              } catch (e) {
                return { ...base, error: e.code === 'ENOENT' ? 'Folder not found' : e.message.split('\n')[0] }
              }
            }),
          ),
        }
      },
    },

    {
      name: 'list_github_plus_issues',
      title: 'GitHub+ local issues',
      description: 'Local issues of a GitHub+ repo, newest first (number, title, state, author, times, comment count). Pass the repo folder name or the path from list_github_plus_repos.',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', maxLength: 1024, description: 'Repo folder name or full path.' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Default open.' },
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'At most this many (default 100).' },
        },
        required: ['repo'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ repo, state = 'open', limit = 100 }) {
        const p = await githubRepo(dir.githubPlus, repo)
        const list = await issues.listIssues(p, state)
        return { repo: p, total: list.length, issues: list.slice(0, limit) }
      },
    },

    {
      name: 'get_github_plus_issue',
      title: 'GitHub+ local issue',
      description: 'One local issue of a GitHub+ repo, with its body and timeline (comments, closes, reopens).',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', maxLength: 1024, description: 'Repo folder name or full path.' },
          number: { type: 'integer', minimum: 1, description: 'Issue number.' },
        },
        required: ['repo', 'number'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ repo, number }) {
        const p = await githubRepo(dir.githubPlus, repo)
        const issue = await issues.getIssue(p, number)
        return { repo: p, ...issue, body: clip(issue.body), timeline: issue.timeline.map((t) => (typeof t.body === 'string' ? { ...t, body: clip(t.body) } : t)) }
      },
    },

    {
      name: 'list_jira_plus_projects',
      title: 'Jira+ local projects',
      description: "The user's private local projects in MonoRail's Jira+ (kept in a git repo on this machine, never synced), with issue counts. Team Jira Cloud projects are not available here.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
      async handler() {
        const store = jiraStore(dir.jiraPlus)
        if (!store) return { projects: [], note: 'No local Jira+ projects yet.' }
        return { projects: await store.listProjects() }
      },
    },

    {
      name: 'list_jira_plus_issues',
      title: 'Jira+ local issues',
      description: 'Issues of one local Jira+ project, most recently updated first (key, summary, type, priority, status, labels, times, comment count).',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', maxLength: 10, description: 'Project key, e.g. "ME".' },
          statusCategory: { type: 'string', enum: ['todo', 'in_progress', 'done'], description: 'Only issues in this status category.' },
          limit: { type: 'integer', minimum: 1, maximum: 500, description: 'At most this many (default 100).' },
        },
        required: ['project'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ project, statusCategory, limit = 100 }) {
        const key = project.toUpperCase()
        if (!JIRA_PROJECT.test(key)) throw new Error('Project keys are 2 to 10 letters or digits and start with a letter.')
        const store = jiraStore(dir.jiraPlus)
        if (!store) throw new Error(`There is no local Jira+ project ${key}.`)
        const all = (await store.listIssues(key)).filter((i) => !statusCategory || i.statusCategory === statusCategory)
        return { project: key, total: all.length, issues: all.slice(0, limit).map(({ description: _d, ...i }) => i) }
      },
    },

    {
      name: 'get_jira_plus_issue',
      title: 'Jira+ local issue',
      description: 'One local Jira+ issue with its description, comments and history.',
      inputSchema: {
        type: 'object',
        properties: { key: { type: 'string', maxLength: 20, description: 'Issue key, e.g. "ME-4".' } },
        required: ['key'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ key }) {
        const k = key.toUpperCase()
        if (!JIRA_ISSUE.test(k)) throw new Error('Issue keys look like ME-4.')
        const store = jiraStore(dir.jiraPlus)
        if (!store) throw new Error(`There is no local Jira+ issue ${k}.`)
        let issue
        try {
          issue = await store.getIssue(k)
        } catch (e) {
          if (e.code === 'ENOENT') throw new Error(`There is no local Jira+ issue ${k}.`)
          throw e
        }
        const { transitions: _t, ...rest } = issue
        return { ...rest, description: clip(rest.description), comments: rest.comments.map((c) => ({ ...c, body: clip(c.body) })) }
      },
    },

    {
      name: 'connection_status',
      title: 'Account connections',
      description:
        "Whether each account MonoRail signs in with (Google Cloud, Atlassian, Claude) still works, from the last check MonoRail ran: state (ok, expired, needs-setup, error, unavailable), a one-line summary and when it was checked. Never returns credentials.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
      async handler() {
        const s = (await cache.readSummaries(rootDir))['connections.summary']
        const list = Object.entries(s?.summary?.connections ?? {}).map(([kind, c]) => ({ kind, ...c }))
        if (!list.length) return { connections: [], note: 'No connection has been checked yet. Add or check one on the Connections page in MonoRail.' }
        return { connections: list }
      },
    },
    {
      name: 'storage_scan',
      title: 'Disk space and folder sizes',
      description:
        "The Storage page's last saved scan: free and used space per drive, and the size of known folders (MonoRail's data, agent tools, package manager caches, Temp, Downloads, system files), largest first, each with its largest subfolders, the change since the previous scan, and advice: safe (a cache its tool rebuilds), review (may hold things the user wants) or keep (in use), plus any free-space goal the user set per drive. Sizes in GB. Read-only: MonoRail never deletes or moves anything it measures. If there is no scan yet, ask the user to press Scan on the Storage page.",
      inputSchema: {
        type: 'object',
        properties: { top: { type: 'integer', minimum: 1, maximum: 100, description: 'How many folders to return, largest first (default 40).' } },
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ top = 40 }) {
        return storageScan(dir.storage, { top })
      },
    },
    {
      name: 'list_flashcard_decks',
      title: 'Flashcard decks',
      description:
        "The user's spaced repetition decks in MonoRail's Flashcards page: id, name, description, card count and what is due today (new cards within the daily limit, learning, reviews), plus reviews done today.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
      async handler() {
        const { decks, reviewedToday } = flashcards.listDecks(await flashcards.createStore(dir.flashcards).read(), Date.now())
        return {
          decks: decks.map((d) => ({ id: d.id, name: d.name, description: d.description, cards: d.counts.total, due: { new: d.counts.new, learning: d.counts.learning, review: d.counts.review }, nextDue: iso(d.counts.nextDue) })),
          reviewedToday,
        }
      },
    },
    {
      name: 'list_flashcards',
      title: 'Cards of a flashcard deck',
      description: 'Cards of one Flashcards deck (front, back, state, next due), optionally only those whose front or back contains `query`. Use it to avoid adding duplicates. At most 500 cards.',
      inputSchema: {
        type: 'object',
        properties: {
          deck: { type: 'string', maxLength: 200, description: 'Deck name or id from list_flashcard_decks.' },
          query: { type: 'string', maxLength: 200 },
        },
        required: ['deck'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ deck, query }) {
        const data = await flashcards.createStore(dir.flashcards).read()
        const d = flashcardDeck(data, deck)
        if (!d) throw new Error(`There is no deck "${deck}". Call list_flashcard_decks for the list.`)
        const { cards, total } = flashcards.listCards(data, { deckId: d.id, query })
        return {
          deck: d.name,
          total,
          cards: cards.slice(0, 500).map((c) => ({ front: clip(c.front, 2000), back: clip(c.back, 2000), state: c.state, suspended: c.suspended || undefined, due: c.state === 'new' ? undefined : iso(c.due) })),
        }
      },
    },
  ]
}

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const NOTE = ' Off until the user allows it for this agent in MonoRail (Configure > Agent access); every call is logged there.'

/** The write tools. The server checks consent before each call (protocol.cjs authorize). */
function writeTools({ rootDir }) {
  const dir = folders(rootDir)

  return [
    {
      name: 'create_github_plus_issue',
      title: 'Raise a GitHub+ local issue',
      description: 'Create a local issue in a GitHub+ repo (stored in the repo under refs/local-issues, never pushed). Markdown body.' + NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', maxLength: 1024, description: 'Repo folder name or full path.' },
          title: { type: 'string', maxLength: 256 },
          body: { type: 'string', maxLength: 65536, description: 'Markdown.' },
        },
        required: ['repo', 'title'],
        additionalProperties: false,
      },
      annotations: WRITE,
      write: true,
      async handler({ repo, title, body = '' }, ctx) {
        const p = await githubRepo(dir.githubPlus, repo)
        const issue = await issues.createIssue(p, { title, body })
        ctx.did(`Created issue #${issue.number} "${issue.title}" in ${path.basename(p)}`)
        return { repo: p, number: issue.number, title: issue.title, state: issue.state }
      },
    },
    {
      name: 'comment_github_plus_issue',
      title: 'Comment on a GitHub+ local issue',
      description: 'Add a comment to a local issue in a GitHub+ repo. Markdown body.' + NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', maxLength: 1024, description: 'Repo folder name or full path.' },
          number: { type: 'integer', minimum: 1 },
          body: { type: 'string', maxLength: 65536, description: 'Markdown.' },
        },
        required: ['repo', 'number', 'body'],
        additionalProperties: false,
      },
      annotations: WRITE,
      write: true,
      async handler({ repo, number, body }, ctx) {
        const p = await githubRepo(dir.githubPlus, repo)
        await issues.addComment(p, number, { body })
        ctx.did(`Commented on issue #${number} in ${path.basename(p)}`)
        return { repo: p, number, commented: true }
      },
    },
    {
      name: 'create_jira_plus_issue',
      title: 'Raise a Jira+ local issue',
      description: 'Create an issue in one of the user\'s private local Jira+ projects (never team Jira).' + NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', maxLength: 10, description: 'Project key, e.g. "ME".' },
          summary: { type: 'string', maxLength: 256 },
          description: { type: 'string', maxLength: 65536 },
          type: { type: 'string', enum: ['Task', 'Bug', 'Story', 'Spike'] },
          priority: { type: 'string', enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'] },
        },
        required: ['project', 'summary'],
        additionalProperties: false,
      },
      annotations: WRITE,
      write: true,
      async handler({ project, summary, description = '', type, priority }, ctx) {
        const key = project.toUpperCase()
        if (!JIRA_PROJECT.test(key)) throw new Error('Project keys are 2 to 10 letters or digits and start with a letter.')
        const store = jiraStore(dir.jiraPlus)
        if (!store || !fsSync.existsSync(path.join(dir.jiraPlus, 'local-repo', 'projects', key, 'project.json'))) throw new Error(`There is no local Jira+ project ${key}.`)
        const issue = await store.createIssue({ projectKey: key, summary, description, type, priority })
        ctx.did(`Created ${issue.key} "${issue.summary}"`)
        return { key: issue.key, summary: issue.summary, status: issue.status, type: issue.type, priority: issue.priority }
      },
    },
    {
      name: 'comment_jira_plus_issue',
      title: 'Comment on a Jira+ local issue',
      description: 'Add a comment to an issue in a local Jira+ project.' + NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', maxLength: 20, description: 'Issue key, e.g. "ME-4".' },
          body: { type: 'string', maxLength: 65536 },
        },
        required: ['key', 'body'],
        additionalProperties: false,
      },
      annotations: WRITE,
      write: true,
      async handler({ key, body }, ctx) {
        const k = key.toUpperCase()
        if (!JIRA_ISSUE.test(k)) throw new Error('Issue keys look like ME-4.')
        const store = jiraStore(dir.jiraPlus)
        if (!store || !fsSync.existsSync(path.join(dir.jiraPlus, 'local-repo', 'projects', k.split('-')[0], 'issues', `${k}.json`))) throw new Error(`There is no local Jira+ issue ${k}.`)
        await store.addComment({ key: k, body })
        ctx.did(`Commented on ${k}`)
        return { key: k, commented: true }
      },
    },
    {
      name: 'add_flashcards',
      title: 'Add flashcards',
      description:
        'Add up to 200 cards to a Flashcards deck for the user to study with spaced repetition. Front and back are Markdown; keep each card to one fact. Pass createDeck to make the deck when no deck has that name.' + NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          deck: { type: 'string', minLength: 1, maxLength: 120, description: 'Deck name or id.' },
          cards: {
            type: 'array',
            minItems: 1,
            maxItems: 200,
            items: {
              type: 'object',
              properties: { front: { type: 'string', minLength: 1, maxLength: 20000 }, back: { type: 'string', maxLength: 20000 } },
              required: ['front'],
              additionalProperties: false,
            },
          },
          createDeck: { type: 'boolean', description: 'Create the deck if it does not exist (default false).' },
        },
        required: ['deck', 'cards'],
        additionalProperties: false,
      },
      annotations: WRITE,
      write: true,
      async handler({ deck, cards, createDeck = false }, ctx) {
        if (!Array.isArray(cards) || cards.length === 0 || cards.length > 200) throw new Error('Pass 1 to 200 cards.')
        const r = await flashcards.createStore(dir.flashcards).update((data, now) => {
          let d = flashcardDeck(data, deck)
          let created = false
          if (!d) {
            if (!createDeck) throw new Error(`There is no deck "${deck}". Call list_flashcard_decks, or pass createDeck: true.`)
            d = flashcards.createDeck(data, { name: deck }, now)
            created = true
          }
          const added = flashcards.addCards(data, d.id, cards, now)
          return { deck: d.name, deckId: d.id, added: added.length, createdDeck: created }
        })
        ctx.did(`Added ${r.added} ${r.added === 1 ? 'card' : 'cards'} to "${r.deck}"${r.createdDeck ? ' (new deck)' : ''}`)
        return r
      },
    },
    {
      name: 'ask_coordinator',
      title: "Ask the user's coordinator",
      description:
        "Send a message to the user's coordinator in MonoRail (their Claude agent that coordinates their other agent sessions; it can read and message the user's chats in allowed repos) and wait for its reply. Continues the coordinator's latest chat unless newChat is true. If the reply takes longer than waitSeconds, returns a turnId for check_coordinator_reply. Refused while the coordinator is already busy." +
        NOTE,
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 100000 },
          newChat: { type: 'boolean', description: 'Start a new coordinator chat instead of continuing the latest one.' },
          waitSeconds: { type: 'integer', minimum: 0, maximum: 1200, description: 'How long to wait for the reply (default 300).' },
        },
        required: ['message'],
        additionalProperties: false,
      },
      annotations: { ...WRITE, openWorldHint: true },
      write: true,
      async handler({ message, newChat = false, waitSeconds = 300 }, ctx) {
        const { askCoordinator } = require('../modules/agent-chat-coordinator.cjs')
        const r = await askCoordinator({ dataDir: dir.agentChat, agent: ctx.agent, message, newChat, waitSeconds })
        if (r.turnId) myTurns.add(r.turnId)
        ctx.did(`Asked the coordinator (${r.status})`)
        return r
      },
    },
  ]
}

/** Coordinator turns this server process started (so only it can read them back). */
const myTurns = new Set()

/** Reading back a coordinator reply this connection asked for. No consent needed: the turn id only exists here. */
function coordinatorReadTools() {
  return [
    {
      name: 'check_coordinator_reply',
      title: 'Check a coordinator reply',
      description: 'Wait for the reply to an ask_coordinator call that returned while the coordinator was still working.',
      inputSchema: {
        type: 'object',
        properties: {
          turnId: { type: 'string', maxLength: 100 },
          waitSeconds: { type: 'integer', minimum: 0, maximum: 1200, description: 'How long to wait (default 300).' },
        },
        required: ['turnId'],
        additionalProperties: false,
      },
      annotations: READ_ONLY,
      async handler({ turnId, waitSeconds = 300 }) {
        if (!myTurns.has(turnId)) throw new Error('Unknown turnId: only replies asked for on this connection can be checked.')
        const { waitForTurn } = require('../modules/agent-chat-coordinator.cjs')
        return waitForTurn(turnId, waitSeconds)
      },
    },
  ]
}

module.exports = { readTools, writeTools, coordinatorReadTools, folders }
