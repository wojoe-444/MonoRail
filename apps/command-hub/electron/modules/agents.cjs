// Agents overview backend: one read that brings together what the Agents page
// shows. It owns no data of its own and keeps no files:
//
//   - agent definitions (Claude Code subagents and skills, pi skills) in the
//     user folders and the Chat page's allowed repos (agents-definitions.cjs)
//   - recent sessions and who is working right now, from Agent Chat's session
//     list and its running turns (logs are read in place, never cached)
//   - spend over the last 7 days, from the Claude Stats summary file (D1 in
//     docs/caching.md: a summary is read, a report is never built from here)

const os = require('node:os')
const path = require('node:path')

const cache = require('../cache/index.cjs')
const agentChat = require('./agent-chat.cjs')
const { allowedRepos } = require('./agent-chat-folders.cjs')
const turnsApi = require('./agent-chat-turns.cjs')
const defs = require('./agents-definitions.cjs')

const DAY = 24 * 60 * 60 * 1000
/** A session whose log changed this recently is shown as active. */
const ACTIVE_MS = 3 * 60 * 1000
const RECENT_KEEP = 10
const REPOS_KEEP = 6

function chatDataDir(ctx) {
  return path.join(ctx.rootDir, 'modules', 'agent-chat')
}

function startOfToday(now) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Pure: the overview from its parts (exported for tests). */
function buildOverview({ list, definitions, composer, running, summary, now = Date.now() }) {
  // Archived chats stay out of the overview (Chat's own list still has them).
  const sessions = list.sessions.filter((s) => !s.archived)
  const runningIds = new Set(running.map((t) => t.chatKey))
  const runningBySession = new Set(running.filter((t) => t.sessionId).map((t) => `${t.sdk}:${t.sessionId}`))
  const stateOf = (s) => (runningIds.has(s.id) || runningBySession.has(s.id) ? 'running' : now - s.updatedAt < ACTIVE_MS ? 'active' : 'idle')

  const today = startOfToday(now)
  const weekAgo = today - 6 * DAY
  const days = []
  for (let i = 6; i >= 0; i--) days.push({ start: today - i * DAY, claude: 0, pi: 0 })
  for (const s of sessions) {
    if (s.updatedAt < weekAgo) continue
    const day = days.find((d) => s.updatedAt >= d.start && s.updatedAt < d.start + DAY)
    if (day) day[s.source]++
  }
  // The list keeps the newest chats only; say so when that may hide some of this week's.
  const oldestKept = sessions.at(-1)?.updatedAt ?? now
  const weekCapped = list.limits.dropped > 0 && oldestKept >= weekAgo

  const repoMap = new Map()
  for (const s of sessions) {
    const r = repoMap.get(s.repo.path) ?? { name: s.repo.name, path: s.repo.path, sessions: 0, lastAt: 0, sources: [] }
    r.sessions++
    r.lastAt = Math.max(r.lastAt, s.updatedAt)
    if (!r.sources.includes(s.source)) r.sources.push(s.source)
    repoMap.set(s.repo.path, r)
  }
  // Allowed repos with no chats yet still appear in quick launch, after the busy ones.
  const repos = [...repoMap.values()].sort((a, b) => b.lastAt - a.lastAt)
  for (const r of composer.repos) if (!repoMap.has(r.path)) repos.push({ name: r.name, path: r.path, sessions: 0, lastAt: 0, sources: [] })

  let cost = null
  const c = summary?.['claude-stats.summary']
  if (c?.summary?.days) {
    const last7 = c.summary.days.slice(-7)
    cost = {
      days: last7,
      total: last7.reduce((a, d) => a + (d.cost || 0), 0),
      builtAt: c.builtAt,
      stale: c.stale,
    }
  }

  const recent = sessions.slice(0, RECENT_KEEP).map((s) => ({
    id: s.id,
    source: s.source,
    title: s.title,
    repo: s.repo.name,
    branch: s.branch,
    model: s.model,
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    state: stateOf(s),
  }))

  return {
    generatedAt: now,
    definitions: definitions.definitions,
    definitionSources: definitions.sources,
    definitionsTruncated: definitions.truncated,
    recent,
    activity: {
      today: days.at(-1).claude + days.at(-1).pi,
      week: days.reduce((a, d) => a + d.claude + d.pi, 0),
      weekCapped,
      days: days.map((d) => ({ start: d.start, claude: d.claude, pi: d.pi })),
      activeNow: sessions.filter((s) => stateOf(s) !== 'idle').length,
      runningTurns: running.length,
    },
    repos: repos.slice(0, Math.max(REPOS_KEEP, 0)),
    repoCount: composer.repos.length,
    sdks: composer.sdks,
    sources: list.sources,
    folders: list.folders,
    cost,
  }
}

async function getOverview(ctx, { env = process.env, home = os.homedir() } = {}) {
  const dataDir = chatDataDir(ctx)
  const [list, folders, composer, summary] = await Promise.all([
    agentChat._internal.listSessions({ dataDir, env, home }),
    allowedRepos(dataDir, { home }),
    agentChat._internal.getComposer({ ...ctx, dataDir }),
    cache.readSummaries(ctx.rootDir).catch(() => ({})),
  ])
  const definitions = await defs.listDefinitions({ repos: folders.repos, env, home })
  const running = turnsApi.runningTurns()
  return buildOverview({ list, definitions, composer, running, summary })
}

module.exports = {
  id: 'agents',
  methods: {
    getOverview: async (ctx) => getOverview(ctx),
    getDefinition: async (_ctx, args) => defs.getDefinition(args?.id),
  },
  _internal: { buildOverview, getOverview },
}
