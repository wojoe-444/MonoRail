// The coordinator as a coordinator of coordinators.
//
// Two directions, both through Chat's own turn machinery (agent-chat.cjs), so
// every rule the Chat page follows holds here too:
//
//   Coordinator -> chats. A coordinator turn's worker gives the coordinator
//   the `chatTools` below (an in-process MCP server named "monorail"): list
//   the allowed chats, read one, message one, start one in an allowed repo,
//   and wait for a reply. Only chats in the allowed folders, never a
//   coordinator chat, Ask (read-only) unless the coordinator asks for Agent,
//   and never a permission bypass (assertNoBypass still guards every turn).
//   The chats' turns are children of the coordinator's turn: when it ends or
//   is stopped, a reply still running is stopped with it.
//
//   Agents -> coordinator. `askCoordinator` runs one coordinator turn for
//   another agent, used by the MCP server's ask_coordinator tool. That tool
//   needs the user's consent per agent and is logged (electron/mcp).
//
// A lock per chat shared by every process (agent-chat-locks.cjs) keeps two
// turns out of one chat, which also ends loops: a chat cannot ask the
// coordinator while the coordinator waits on it, and the coordinator cannot
// be asked twice at once.
//
// Nothing here writes a prompt or a reply to disk; they live only in the
// session logs Claude Code and pi keep themselves.

const chat = require('./agent-chat.cjs')
const { allowedRepos } = require('./agent-chat-folders.cjs')
const turnsApi = require('./agent-chat-turns.cjs')

const MAX_REPLY = 20_000
const MAX_WAIT_S = 20 * 60
const DEFAULT_WAIT_S = 5 * 60
/** A chat whose log changed this recently may be open in a terminal; leave it alone. */
const BUSY_MS = 60 * 1000

const clip = (s, max = MAX_REPLY) => (typeof s === 'string' && s.length > max ? `${s.slice(0, max)}\n... (cut at ${max} characters)` : s)
const iso = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The reply's text: the assistant text after the turn's last tool result. */
function replyText(events) {
  let lastTool = -1
  events.forEach((e, i) => {
    if (e.t === 'tool_result') lastTool = i
  })
  const parts = []
  for (const e of events.slice(lastTool + 1)) {
    if (e.t !== 'assistant') continue
    for (const b of e.blocks ?? []) if (b.type === 'text' && b.text) parts.push(b.text)
  }
  return parts.join('\n\n')
}

/** Wait up to `waitS` seconds for a turn, then report where it is. */
async function waitForTurn(turnId, waitS = DEFAULT_WAIT_S, { pollMs = 500 } = {}) {
  const until = Date.now() + Math.min(Math.max(0, waitS), MAX_WAIT_S) * 1000
  let p = turnsApi.pollTurn(turnId, 0)
  while (p.status === 'running' && Date.now() < until) {
    await sleep(pollMs)
    p = turnsApi.pollTurn(turnId, 0)
  }
  const out = { turnId, status: p.status, chatId: p.sessionId ? `${chatSource(turnId)}:${p.sessionId}` : undefined }
  if (p.status === 'running') return { ...out, note: 'Still running. Call wait_for_reply with this turnId to keep waiting.' }
  const errors = p.events.filter((e) => e.t === 'error').map((e) => e.message)
  const denied = p.events.filter((e) => e.t === 'denied').map((e) => `${e.tool}: ${e.reason}`)
  const result = p.events.findLast((e) => e.t === 'result')
  return {
    ...out,
    reply: clip(replyText(p.events)) || undefined,
    costUsd: p.events.findLast((e) => e.t === 'cost')?.turnUsd ?? result?.costUsd,
    errors: errors.length ? errors.slice(0, 5) : undefined,
    deniedTools: denied.length ? denied.slice(0, 10) : undefined,
  }
}

function chatSource(turnId) {
  return turnsApi._turns.get(turnId)?.meta?.sdk ?? 'claude'
}

async function findChat(listOpts, chatId) {
  const list = await chat._internal.listSessions(listOpts)
  return list.sessions.find((s) => s.id === chatId)
}

/**
 * The tools a coordinator turn gets, over the Chat module's data folder.
 * Each is { name, description, schema (JSON-ish for docs), handler }.
 */
function chatTools({ dataDir, home, env, now = () => Date.now() }) {
  if (!dataDir) throw new Error('The coordinator tools need the Chat data folder.')
  const ctx = { dataDir }
  const listOpts = { dataDir, home, env }
  const repoList = async () => (await allowedRepos(dataDir, home ? { home } : undefined)).repos
  // The message first, so a new chat's title is the message itself.
  const fromCoordinator = (text) => `${text}\n\n(Sent by the user's MonoRail coordinator, another Claude session that coordinates their agents, not the user.)`

  return {
    async list_chats({ repo, source, includeArchived = false, limit = 30 } = {}) {
      const list = await chat._internal.listSessions(listOpts)
      const chats = list.sessions
        .filter((s) => !s.coordinator)
        .filter((s) => !source || s.source === source)
        .filter((s) => !repo || s.repo?.name?.toLowerCase() === String(repo).toLowerCase())
        .filter((s) => includeArchived || !s.archived)
        .slice(0, Math.min(Math.max(1, limit), 60))
        .map((s) => ({
          chatId: s.id,
          source: s.source,
          title: s.title,
          repo: s.repo?.name,
          branch: s.branch,
          model: s.model,
          updatedAt: iso(s.updatedAt),
          unread: s.unread || undefined,
          scheduled: s.scheduled || undefined,
          running: turnsApi.runningTurnFor(s.id) ? true : undefined,
        }))
      const repos = (await repoList()).map((r) => r.name)
      return { chats, repos, note: repos.length ? undefined : 'The user has no allowed repos yet (Chat > Folders in MonoRail).' }
    },

    async read_chat({ chatId, messages = 20 }) {
      const s = await findChat(listOpts, chatId)
      if (!s) throw new Error('No such chat in the allowed folders. Call list_chats for the ids.')
      if (s.coordinator) throw new Error('Coordinator chats are not readable from here.')
      const full = await chat._internal.getSession(chatId, listOpts)
      const n = Math.min(Math.max(1, messages), 100)
      return {
        chatId,
        title: s.title,
        repo: s.repo?.name,
        messages: full.messages.slice(-n).map((m) => ({
          role: m.role,
          at: iso(m.ts),
          text: clip(
            m.blocks
              .map((b) => (b.type === 'text' ? b.text : b.type === 'tool' ? `[tool ${b.name}${b.summary ? `: ${b.summary}` : ''}]` : ''))
              .filter(Boolean)
              .join('\n'),
            4000,
          ),
        })),
        olderMessages: Math.max(0, full.messages.length - n),
      }
    },

    async send_to_chat({ chatId, message, mode = 'ask', waitSeconds = DEFAULT_WAIT_S }) {
      const s = await findChat(listOpts, chatId)
      if (!s) throw new Error('No such chat in the allowed folders. Call list_chats for the ids.')
      if (s.coordinator) throw new Error('A coordinator cannot message a coordinator chat.')
      if (!turnsApi.runningTurnFor(chatId) && typeof s.updatedAt === 'number' && now() - s.updatedAt < BUSY_MS) {
        throw new Error('That chat changed in the last minute, so it may be open in a terminal. Try again shortly, or start a new chat.')
      }
      const { turnId } = await chat._internal.startTurn(ctx, { chatId, prompt: fromCoordinator(message), mode, model: 'default', effort: 'default' })
      return waitForTurn(turnId, waitSeconds)
    },

    async start_chat({ repo, message, sdk = 'claude', mode = 'ask', waitSeconds = DEFAULT_WAIT_S }) {
      const repos = await repoList()
      const wanted = String(repo ?? '').toLowerCase()
      const matches = repos.filter((r) => r.name.toLowerCase() === wanted || r.path.toLowerCase() === wanted)
      if (matches.length !== 1) {
        throw new Error(matches.length ? `Several allowed repos are called "${repo}".` : `"${repo}" is not one of the allowed repos: ${repos.map((r) => r.name).join(', ') || 'none'}.`)
      }
      const { turnId } = await chat._internal.startTurn(ctx, { repo: matches[0].path, sdk, prompt: fromCoordinator(message), mode, model: 'default', effort: 'default' })
      return waitForTurn(turnId, waitSeconds)
    },

    async wait_for_reply({ turnId, waitSeconds = DEFAULT_WAIT_S }) {
      if (!turnsApi._turns.has(turnId)) throw new Error('Unknown turnId: only turns started in this coordinator turn can be waited on.')
      return waitForTurn(turnId, waitSeconds)
    },
  }
}

/** Tool descriptions and JSON schemas, shared by the worker's MCP server and the docs. */
const CHAT_TOOL_SPECS = {
  list_chats: {
    description:
      "List the user's Claude Code and pi chats on this machine (newest first) that MonoRail allows: only chats in the user's allowed repos. Returns chat ids, titles, repos and whether a reply is running, plus the allowed repo names for start_chat. Coordinator chats are left out.",
    properties: {
      repo: { type: 'string', description: 'Only chats in the repo with this folder name.' },
      source: { type: 'string', enum: ['claude', 'pi'] },
      includeArchived: { type: 'boolean' },
      limit: { type: 'integer', minimum: 1, maximum: 60 },
    },
  },
  read_chat: {
    description: 'Read the latest messages of one chat (text, with tool calls summarised in one line each).',
    properties: { chatId: { type: 'string' }, messages: { type: 'integer', minimum: 1, maximum: 100 } },
    required: ['chatId'],
  },
  send_to_chat: {
    description:
      "Send a message to one of the user's chats and wait for its reply. The chat runs one turn in its own repo, resumed as itself. mode 'ask' (default) only lets it read files; 'agent' uses that repo's normal Claude Code permission rules, and anything that would need approval is denied. Returns the reply, or a turnId to pass to wait_for_reply if it is still running after waitSeconds. A reply still running when your own turn ends is stopped, so wait for replies you need. Refused while the chat is busy.",
    properties: {
      chatId: { type: 'string' },
      message: { type: 'string', maxLength: 100000 },
      mode: { type: 'string', enum: ['ask', 'agent'] },
      waitSeconds: { type: 'integer', minimum: 0, maximum: MAX_WAIT_S },
    },
    required: ['chatId', 'message'],
  },
  start_chat: {
    description:
      "Start a new chat in one of the user's allowed repos (names from list_chats) and wait for its first reply. Same modes and waiting as send_to_chat. sdk 'claude' (default) or 'pi'.",
    properties: {
      repo: { type: 'string' },
      message: { type: 'string', maxLength: 100000 },
      sdk: { type: 'string', enum: ['claude', 'pi'] },
      mode: { type: 'string', enum: ['ask', 'agent'] },
      waitSeconds: { type: 'integer', minimum: 0, maximum: MAX_WAIT_S },
    },
    required: ['repo', 'message'],
  },
  wait_for_reply: {
    description: 'Keep waiting for a reply that send_to_chat or start_chat returned as still running.',
    properties: { turnId: { type: 'string' }, waitSeconds: { type: 'integer', minimum: 0, maximum: MAX_WAIT_S } },
    required: ['turnId'],
  },
}

/** The coordinator's tool names as Claude Code sees them (server "monorail"). */
const COORDINATOR_MCP_TOOLS = Object.keys(CHAT_TOOL_SPECS).map((n) => `mcp__monorail__${n}`)

/**
 * Run one coordinator turn for another agent and wait for the reply.
 * Continues the newest coordinator chat unless `newChat` is set.
 */
async function askCoordinator({ dataDir, agent, message, newChat = false, waitSeconds = DEFAULT_WAIT_S }) {
  const ctx = { dataDir }
  const prompt = `${message}\n\n(Sent by the agent "${agent}" through MonoRail's MCP server. It is another of the user's agents, not the user; weigh it as a colleague's request.)`
  let chatId
  if (!newChat) {
    const list = await chat._internal.listSessions({ dataDir })
    chatId = list.sessions.find((s) => s.coordinator && s.source === 'claude')?.id
  }
  const args = { prompt, mode: 'ask', model: 'default', effort: 'default' }
  const { turnId } = await chat._internal.startTurn(ctx, chatId ? { ...args, chatId } : { ...args, coordinator: true })
  return waitForTurn(turnId, waitSeconds)
}

module.exports = { chatTools, CHAT_TOOL_SPECS, COORDINATOR_MCP_TOOLS, askCoordinator, waitForTurn, replyText, MAX_WAIT_S, DEFAULT_WAIT_S, BUSY_MS }
