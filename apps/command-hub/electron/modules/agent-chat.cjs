// Agent Chat backend: lists the local session logs of Claude Code and pi and
// turns one session into a read-only chat transcript.
//
//   Claude Code: ~/.claude/projects/<project>/<session>.jsonl (and
//                ~/.config/claude, or CLAUDE_CONFIG_DIR, like ccusage)
//   pi:          ~/.pi/agent/sessions/<cwd>/<timestamp>_<id>.jsonl (or
//                PI_CODING_AGENT_DIR/sessions)
//
// Private data rule: the logs are read in place and never copied, cached to
// disk or sent anywhere. The renderer only ever names a session by the id this
// backend handed out; it never passes a file path.

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const crypto = require('node:crypto')

const { allowedRepos, repoFor, setReposRoot, addRepo, removeRepo, real } = require('./agent-chat-folders.cjs')
const options = require('./agent-chat-options.cjs')
const turnsApi = require('./agent-chat-turns.cjs')
const chatState = require('./agent-chat-state.cjs')
const changesApi = require('./agent-chat-changes.cjs')

const HEAD_BYTES = 256 * 1024
const MAX_TEXT = 20_000
const MAX_TOOL_TEXT = 4_000
// Read limits (K3): the list reads the 300 newest logs and keeps 60 chats; a
// history is at most the last 4 MB of its log and 300 messages.
const LIST_SCAN = 300
const LIST_KEEP = 60
const HISTORY_BYTES = 4 * 1024 * 1024
const HISTORY_MESSAGES = 300

// ---------------------------------------------------------------------------
// Locations

function claudeRoots(env = process.env, home = os.homedir()) {
  const bases = env.CLAUDE_CONFIG_DIR
    ? env.CLAUDE_CONFIG_DIR.split(',').map((s) => s.trim()).filter(Boolean)
    : [path.join(home, '.config', 'claude'), path.join(home, '.claude')]
  return bases.map((b) => path.join(b, 'projects'))
}

function piRoots(env = process.env, home = os.homedir()) {
  const base = env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent')
  return [path.join(base, 'sessions')]
}

async function listJsonl(dir, depth, skip) {
  const out = []
  let entries
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (depth > 0 && !skip?.(e.name)) out.push(...(await listJsonl(full, depth - 1, skip)))
    } else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------------------
// Helpers

function parseLines(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // A partially written last line, or junk: skip it.
    }
  }
  return out
}

async function readHead(file) {
  const fh = await fs.promises.open(file, 'r')
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, HEAD_BYTES, 0)
    let text = buf.subarray(0, bytesRead).toString('utf8')
    if (bytesRead === HEAD_BYTES) text = text.slice(0, text.lastIndexOf('\n') + 1)
    return text
  } finally {
    await fh.close()
  }
}

/** Read the tail of a file (for titles written late, like Claude Code summaries). */
async function readTail(file, size, bytes = 64 * 1024) {
  if (size <= HEAD_BYTES) return ''
  const fh = await fs.promises.open(file, 'r')
  try {
    const start = Math.max(HEAD_BYTES, size - bytes)
    const buf = Buffer.alloc(size - start)
    const { bytesRead } = await fh.read(buf, 0, buf.length, start)
    const text = buf.subarray(0, bytesRead).toString('utf8')
    return text.slice(text.indexOf('\n') + 1)
  } finally {
    await fh.close()
  }
}

function clip(s, max = MAX_TEXT) {
  if (typeof s !== 'string') return ''
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} more characters)` : s
}

function oneLine(s, max = 120) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function toMs(v) {
  if (typeof v === 'number') return v
  const n = Date.parse(v)
  return Number.isFinite(n) ? n : undefined
}

/** Tool input as readable text: JSON, but a lone command/path shows as itself. */
function formatInput(input) {
  if (input == null) return ''
  if (typeof input === 'string') return clip(input, MAX_TOOL_TEXT)
  try {
    return clip(JSON.stringify(input, null, 2), MAX_TOOL_TEXT)
  } catch {
    return ''
  }
}

function inputSummary(input) {
  if (!input || typeof input !== 'object') return oneLine(input, 80)
  for (const k of ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt']) {
    if (typeof input[k] === 'string') return oneLine(input[k], 80)
  }
  return ''
}

/** One model call's tokens (and its logged cost, when the log has one). */
function claudeUsage(msg, d) {
  const u = msg?.usage
  if (!u || msg.model === '<synthetic>') return undefined
  const usage = {
    model: msg.model,
    input: u.input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
  }
  if (typeof d?.costUSD === 'number') usage.costUsd = d.costUSD
  return usage
}

function piUsage(m) {
  const u = m?.usage
  if (!u) return undefined
  const usage = { model: m.model, input: u.input ?? 0, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0, output: u.output ?? 0 }
  if (typeof u.cost?.total === 'number') usage.costUsd = u.cost.total
  return usage
}

function contentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((c) => (c?.type === 'text' ? c.text : c?.type === 'image' ? '[image]' : ''))
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Claude Code

const CLAUDE_NOISE = /^(<local-command-|<command-message>|Caveat: |<system-reminder>|\[Request interrupted)/

/** "/compact focus" for slash-command messages, else undefined. */
function claudeCommand(text) {
  const name = /<command-name>([^<]*)<\/command-name>/.exec(text)?.[1]
  if (!name) return undefined
  const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim()
  return args ? `${name} ${args}` : name
}

function claudeUserText(d) {
  if (d.isMeta || d.isCompactSummary || d.isSidechain) return undefined
  const text = contentText(d.message?.content).trim()
  if (!text) return undefined
  const cmd = claudeCommand(text)
  if (cmd) return cmd
  if (CLAUDE_NOISE.test(text)) return undefined
  return text
}

function claudeMeta(entries) {
  const meta = { cwd: undefined, branch: undefined, model: undefined, title: undefined, prompt: undefined, start: undefined, entrypoint: undefined }
  for (const d of entries) {
    if (typeof d.entrypoint === 'string') meta.entrypoint ??= d.entrypoint
    // "summary" lines can describe other sessions (they point at a leafUuid), so only titles the user set count.
    if (d.type === 'custom-title' && d.customTitle) meta.title = d.customTitle
    meta.start ??= toMs(d.timestamp)
    if (d.cwd) meta.cwd ??= d.cwd
    if (d.gitBranch && d.gitBranch !== 'HEAD') meta.branch ??= d.gitBranch
    if (d.type === 'assistant' && d.message?.model && d.message.model !== '<synthetic>') meta.model = d.message.model
    if (d.type === 'user' && !meta.prompt) meta.prompt = claudeUserText(d)
  }
  return meta
}

function claudeTranscript(entries) {
  const messages = []
  const toolIndex = new Map()
  let last
  for (const d of entries) {
    if (d.isSidechain) continue
    const ts = toMs(d.timestamp)
    if (d.type === 'user') {
      const content = d.message?.content
      if (Array.isArray(content) && content.some((c) => c?.type === 'tool_result')) {
        for (const c of content) {
          if (c?.type !== 'tool_result') continue
          const tool = toolIndex.get(c.tool_use_id)
          if (tool) {
            tool.result = clip(contentText(c.content), MAX_TOOL_TEXT)
            tool.isError = !!c.is_error
          }
        }
        continue
      }
      if (d.isCompactSummary) {
        messages.push({ role: 'system', ts, blocks: [{ type: 'text', text: 'Conversation compacted. Earlier messages were summarized.' }] })
        last = undefined
        continue
      }
      const text = claudeUserText(d)
      if (!text) continue
      messages.push({ role: 'user', ts, blocks: [{ type: 'text', text: clip(text) }] })
      last = undefined
    } else if (d.type === 'assistant') {
      const msg = d.message ?? {}
      // Claude Code writes one line per content block; lines of one reply share message.id.
      let target = last && msg.id && last.id === msg.id ? last : undefined
      if (!target) {
        target = { role: 'assistant', id: msg.id, ts, model: msg.model === '<synthetic>' ? undefined : msg.model, blocks: [] }
        messages.push(target)
        last = target
      }
      // Every line of a reply carries the same usage; keep the last.
      const usage = claudeUsage(msg, d)
      if (usage) target.usage = usage
      for (const c of Array.isArray(msg.content) ? msg.content : []) {
        if (c?.type === 'text' && c.text?.trim()) target.blocks.push({ type: 'text', text: clip(c.text) })
        else if (c?.type === 'thinking' && c.thinking?.trim()) target.blocks.push({ type: 'thinking', text: clip(c.thinking) })
        else if (c?.type === 'tool_use') {
          const tool = { type: 'tool', id: c.id, name: c.name, summary: inputSummary(c.input), input: formatInput(c.input) }
          target.blocks.push(tool)
          if (c.id) toolIndex.set(c.id, tool)
        }
      }
    }
  }
  // A model call with only reasoning (hidden) still counts in Detailed view.
  return messages.filter((m) => m.blocks.length > 0 || m.usage).map(({ id: _id, ...m }) => m)
}

/** Model calls of a Claude subagent log (one per message id), for Detailed view. */
function claudeSubagentCalls(entries) {
  const byId = new Map()
  for (const d of entries) {
    if (d.type !== 'assistant') continue
    const usage = claudeUsage(d.message, d)
    if (usage) byId.set(d.message.id ?? d.uuid, { ...usage, ts: toMs(d.timestamp), subagent: true })
  }
  return [...byId.values()]
}

// ---------------------------------------------------------------------------
// pi

/** pi v3 sessions are trees (id/parentId); show the branch ending at the last entry. */
function piBranch(entries) {
  const body = entries.filter((d) => d.type !== 'session')
  if (!body.some((d) => d.id && 'parentId' in d)) return body
  const byId = new Map(body.filter((d) => d.id).map((d) => [d.id, d]))
  const chain = []
  const seen = new Set()
  for (let d = body[body.length - 1]; d && !seen.has(d.id); d = d.parentId ? byId.get(d.parentId) : undefined) {
    seen.add(d.id)
    chain.push(d)
  }
  return chain.reverse()
}

function piMeta(entries) {
  const header = entries.find((d) => d.type === 'session') ?? {}
  const meta = { cwd: header.cwd, branch: undefined, model: undefined, title: undefined, prompt: undefined, start: toMs(header.timestamp) }
  for (const d of entries) {
    if (d.type === 'session_info' && d.name) meta.title = d.name
    if (d.type === 'model_change' && d.modelId) meta.model = d.modelId
    const m = d.type === 'message' ? d.message : undefined
    if (!m) continue
    meta.start ??= toMs(d.timestamp)
    if (m.role === 'assistant' && m.model) meta.model = m.model
    if (m.role === 'user' && !meta.prompt) meta.prompt = contentText(m.content).trim() || undefined
  }
  return meta
}

function piTranscript(entries) {
  const messages = []
  const toolIndex = new Map()
  for (const d of piBranch(entries)) {
    const ts = toMs(d.timestamp)
    if (d.type === 'compaction') {
      messages.push({ role: 'system', ts, blocks: [{ type: 'text', text: 'Conversation compacted. Earlier messages were summarized.' }] })
      continue
    }
    if (d.type === 'model_change' && d.modelId) {
      messages.push({ role: 'system', ts, blocks: [{ type: 'text', text: `Model changed to ${d.modelId}` }] })
      continue
    }
    if (d.type !== 'message' || !d.message) continue
    const m = d.message
    if (m.role === 'user') {
      const text = contentText(m.content).trim()
      if (text) messages.push({ role: 'user', ts, blocks: [{ type: 'text', text: clip(text) }] })
    } else if (m.role === 'assistant') {
      const blocks = []
      const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : Array.isArray(m.content) ? m.content : []
      for (const c of content) {
        if (c?.type === 'text' && c.text?.trim()) blocks.push({ type: 'text', text: clip(c.text) })
        else if (c?.type === 'thinking' && c.thinking?.trim()) blocks.push({ type: 'thinking', text: clip(c.thinking) })
        else if (c?.type === 'toolCall') {
          const tool = { type: 'tool', id: c.id, name: c.name, summary: inputSummary(c.arguments), input: formatInput(c.arguments) }
          blocks.push(tool)
          if (c.id) toolIndex.set(c.id, tool)
        }
      }
      if (m.errorMessage) blocks.push({ type: 'text', text: `Error: ${oneLine(m.errorMessage, 500)}` })
      const usage = piUsage(m)
      if (blocks.length || usage) messages.push({ role: 'assistant', ts, model: m.model, blocks, ...(usage ? { usage } : {}) })
    } else if (m.role === 'toolResult') {
      const tool = toolIndex.get(m.toolCallId)
      if (tool) {
        tool.result = clip(contentText(m.content), MAX_TOOL_TEXT)
        tool.isError = !!m.isError
      }
    } else if (m.role === 'bashExecution' && m.command) {
      messages.push({
        role: 'user',
        ts,
        blocks: [{ type: 'tool', name: 'bash', summary: oneLine(m.command, 80), input: clip(m.command, MAX_TOOL_TEXT), result: clip(m.output ?? '', MAX_TOOL_TEXT) }],
      })
    }
  }
  return messages
}

/** pi's spend: every paid entry in the file, abandoned branches included. */
function piSpend(entries) {
  let usd = 0
  for (const d of entries) if (d.type === 'message' && d.message?.role === 'assistant') usd += d.message.usage?.cost?.total ?? 0
  return usd
}

// ---------------------------------------------------------------------------
// Index

const SOURCES = {
  claude: { label: 'Claude Code', roots: claudeRoots, depth: 1, skip: (n) => n === 'subagents', meta: claudeMeta, transcript: claudeTranscript, entries: (e) => e },
  pi: { label: 'pi', roots: piRoots, depth: 1, meta: piMeta, transcript: piTranscript, entries: piBranch },
}

function projectName(cwd, dirName) {
  if (cwd) return path.basename(cwd.replace(/[\\/]+$/, '')) || cwd
  return dirName.replace(/^-+|-+$/g, '').split('-').pop() || dirName
}

/** Session summaries keyed by file, reused while the file is unchanged. */
const summaryCache = new Map()
/** id -> { source, file } for sessions this backend has listed. */
const known = new Map()

async function summarize(source, root, file) {
  const stat = await fs.promises.stat(file)
  const cached = summaryCache.get(file)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.summary
  const summary = await summarizeFile(source, root, file, stat)
  summaryCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, summary })
  return summary
}

async function summarizeFile(source, root, file, stat) {
  const def = SOURCES[source]
  const head = parseLines(await readHead(file))
  const tail = parseLines(await readTail(file, stat.size))
  const meta = def.meta([...head, ...tail])
  if (!meta.prompt && !meta.title) return null
  const rel = path.relative(root, file).split(path.sep)
  const baseName = path.basename(file, '.jsonl')
  const sessionId = source === 'pi' ? baseName.split('_').pop() : baseName
  const summary = {
    id: `${source}:${sessionId}`,
    source,
    sessionId,
    title: oneLine(meta.title || meta.prompt, 100),
    preview: oneLine(meta.prompt, 160),
    project: projectName(meta.cwd, rel.length > 1 ? rel[0] : ''),
    cwd: meta.cwd,
    branch: meta.branch,
    model: meta.model,
    startedAt: meta.start ?? stat.birthtimeMs ?? stat.mtimeMs,
    updatedAt: stat.mtimeMs,
    sizeBytes: stat.size,
    // Claude Code records how a session was started: "cli" is a person at a
    // terminal; "sdk-*" is a script, a scheduled task or another app.
    headless: typeof meta.entrypoint === 'string' && meta.entrypoint.startsWith('sdk'),
  }
  // pi's total needs the whole file; past the history limit it is unknown here.
  if (source === 'pi' && stat.size <= HISTORY_BYTES) summary.spentUsd = piSpend(parseLines(await fs.promises.readFile(file, 'utf8')))
  return summary
}

/**
 * A chat's total spend, or why it cannot be known.
 *   - Claude: the last cost record MonoRail kept for the session (costs.json).
 *   - pi: every paid entry in its file, abandoned branches included.
 */
function chatTotal(summary, costs) {
  if (summary.source === 'pi') return typeof summary.spentUsd === 'number' ? { usd: summary.spentUsd, complete: true } : { complete: false, reason: 'too-big' }
  const rec = costs?.[summary.sessionId]
  if (!rec) return { complete: false, reason: 'no-record' }
  // Turns run elsewhere (a terminal) after the record are not in it.
  const stale = typeof summary.updatedAt === 'number' && summary.updatedAt > rec.at + 10_000
  return stale ? { usd: rec.usd, complete: false, reason: 'stale' } : { usd: rec.usd, complete: true }
}

/**
 * List chats. Only sessions whose folder resolves into an allowed repo are
 * listed (agent-chat-folders.cjs). Limits: the LIST_SCAN newest logs are
 * read, and the LIST_KEEP newest allowed chats are kept.
 */
async function listSessions(opts = {}) {
  const env = opts.env ?? process.env
  const home = opts.home ?? os.homedir()
  const folders = await allowedRepos(opts.dataDir, { home })
  const sources = []
  const files = []
  for (const [source, def] of Object.entries(SOURCES)) {
    const roots = def.roots(env, home).filter((r) => fs.existsSync(r))
    sources.push({ id: source, label: def.label, found: roots.length > 0 })
    for (const root of roots) {
      for (const file of await listJsonl(root, def.depth, def.skip)) {
        try {
          files.push({ source, root, file, mtimeMs: (await fs.promises.stat(file)).mtimeMs })
        } catch {
          // Vanished or unreadable: leave it out.
        }
      }
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs)
  const scanned = files.slice(0, LIST_SCAN)

  const byId = new Map()
  let outsideAllowed = 0
  for (const f of scanned) {
    let s
    try {
      s = await summarize(f.source, f.root, f.file)
    } catch {
      continue
    }
    if (!s || byId.has(s.id)) continue // newest first, so a duplicate under a second config root is older
    const repo = s.cwd ? await repoFor(folders.repos, s.cwd) : undefined
    if (!repo) {
      outsideAllowed++
      continue
    }
    known.set(s.id, { source: f.source, file: f.file, cwd: s.cwd })
    byId.set(s.id, { ...s, repo: { name: repo.name, path: repo.path } })
  }
  const costs = opts.dataDir ? readCosts(opts.dataDir) : {}
  const state = opts.dataDir ? chatState.read(opts.dataDir) : { since: 0, chats: {} }
  const sessions = [...byId.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ spentUsd: _s, headless, ...s }) => {
      const f = chatState.flags(state, s.id, s.updatedAt)
      return {
        ...s,
        total: chatTotal({ ...s, spentUsd: _s }, costs),
        unread: f.unread,
        archived: f.archived,
        // Run without a person, and not started from this page.
        scheduled: !!headless && !f.startedHere,
      }
    })
  return {
    sources,
    sessions: sessions.slice(0, LIST_KEEP),
    limits: {
      scanned: scanned.length,
      totalLogs: files.length,
      kept: Math.min(sessions.length, LIST_KEEP),
      dropped: Math.max(0, sessions.length - LIST_KEEP),
      outsideAllowed,
    },
    folders: { reposRoot: folders.reposRoot, reposRootFound: folders.reposRootFound, repoCount: folders.repos.length },
  }
}

/** Read at most the last `bytes` of a file, starting at a whole line. */
async function readTailWhole(file, size, bytes) {
  if (size <= bytes) return { text: await fs.promises.readFile(file, 'utf8'), cut: false }
  const fh = await fs.promises.open(file, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = await fh.read(buf, 0, bytes, size - bytes)
    const text = buf.subarray(0, bytesRead).toString('utf8')
    return { text: text.slice(text.indexOf('\n') + 1), cut: true }
  } finally {
    await fh.close()
  }
}

/**
 * One chat's history: the last HISTORY_BYTES of its log and at most
 * HISTORY_MESSAGES messages. `truncated` says when the history was cut.
 */
async function getSession(id, opts = {}) {
  if (typeof id !== 'string') throw new Error('Missing session id')
  if (!known.has(id)) await listSessions(opts)
  const entry = known.get(id)
  if (!entry) throw new Error('Session not found')
  // The folder may have stopped being allowed since the list was read.
  const folders = await allowedRepos(opts.dataDir, { home: opts.home })
  if (!entry.cwd || !(await repoFor(folders.repos, entry.cwd))) throw new Error('This chat is not in an allowed folder.')
  const stat = await fs.promises.stat(entry.file)
  const { text, cut } = await readTailWhole(entry.file, stat.size, HISTORY_BYTES)
  const lines = parseLines(text)
  const all = SOURCES[entry.source].transcript(lines)
  const messages = all.length > HISTORY_MESSAGES ? all.slice(-HISTORY_MESSAGES) : all
  const subagentCalls = entry.source === 'claude' ? await readSubagentCalls(entry.file) : []
  const sessionId = id.slice(id.indexOf(':') + 1)
  const total =
    entry.source === 'pi'
      ? cut
        ? { complete: false, reason: 'too-big' }
        : { usd: piSpend(lines), complete: true }
      : chatTotal({ source: 'claude', sessionId, updatedAt: stat.mtimeMs }, opts.dataDir ? readCosts(opts.dataDir) : {})
  return {
    id,
    messages,
    subagentCalls,
    total,
    truncated: cut || all.length > HISTORY_MESSAGES ? { bytes: cut, messages: all.length - messages.length } : undefined,
  }
}

/** Model calls from a Claude session's subagent logs (<session>/subagents/*.jsonl), within the read limit. */
async function readSubagentCalls(file) {
  const dir = path.join(file.slice(0, -'.jsonl'.length), 'subagents')
  const calls = []
  let budget = HISTORY_BYTES
  for (const f of await listJsonl(dir, 0)) {
    try {
      const stat = await fs.promises.stat(f)
      if (stat.size > budget) continue
      budget -= stat.size
      calls.push(...claudeSubagentCalls(parseLines(await fs.promises.readFile(f, 'utf8'))))
    } catch {
      // unreadable: leave it out
    }
  }
  return calls
}

// ---------------------------------------------------------------------------
// Live turns

const COSTS_FILE = 'costs.json'

/**
 * Last known running cost per session: { [sessionId]: { usd, at } } (numbers
 * only), so a resumed turn's own cost can be split out and a chat's total read.
 * Older files stored a bare number.
 */
function readCosts(dataDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, COSTS_FILE), 'utf8')) || {}
    const out = {}
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number') out[k] = { usd: v, at: 0 }
      else if (v && typeof v.usd === 'number') out[k] = { usd: v.usd, at: typeof v.at === 'number' ? v.at : 0 }
    }
    return out
  } catch {
    return {}
  }
}

function writeCosts(dataDir, costs) {
  try {
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(path.join(dataDir, COSTS_FILE), JSON.stringify(costs))
  } catch {
    // cost bookkeeping is best-effort
  }
}

function sdkStatus() {
  const exe = options.findClaudeExecutable()
  const piSdk = options.findPiSdk()
  return [
    {
      id: 'claude',
      label: 'Claude',
      ready: !!exe,
      reason: exe ? undefined : 'Claude Code was not found on this machine. Install it so "claude" is on your PATH, sign in once in a terminal, then reopen this page.',
    },
    {
      id: 'pi',
      label: 'pi',
      ready: !!piSdk,
      reason: piSdk ? undefined : 'pi was not found on this machine. Install it with "npm install -g @mariozechner/pi-coding-agent", sign in once in a terminal, then reopen this page.',
    },
  ]
}

async function getComposer(ctx) {
  const folders = await allowedRepos(ctx.dataDir)
  return {
    sdks: sdkStatus(),
    models: options.CLAUDE_MODELS,
    piModels: options.PI_MODELS,
    efforts: options.EFFORTS,
    repos: folders.repos.map((r) => ({ name: r.name, path: r.path })),
  }
}

/**
 * Start a turn. The folder is never taken from the page for a chat being
 * continued: it comes from the session log and must still be in an allowed
 * repo. A new chat names one of the allowed repos, which is checked again.
 */
async function startTurn(ctx, args = {}) {
  const folders = await allowedRepos(ctx.dataDir)

  // Which chat, which folder, which SDK. A continued chat keeps its own SDK
  // and folder (from its log), never what the page asks for.
  let cwd
  let root
  let sessionFile
  let resume
  let chatKey
  let sdk
  if (typeof args.chatId === 'string') {
    if (!known.has(args.chatId)) await listSessions({ dataDir: ctx.dataDir })
    const entry = known.get(args.chatId)
    if (!entry) throw new Error('Session not found')
    const dir = entry.cwd ? await real(entry.cwd) : undefined
    const repo = dir && (await repoFor(folders.repos, dir))
    if (!repo) throw new Error("This chat's folder is not in an allowed repo any more.")
    cwd = dir
    root = repo.path
    sdk = entry.source
    chatKey = args.chatId
    if (sdk === 'claude') resume = args.chatId.slice('claude:'.length)
    else sessionFile = entry.file
  } else {
    const wanted = typeof args.repo === 'string' ? await real(args.repo) : undefined
    const repo = wanted && folders.repos.find((r) => r.path === wanted)
    if (!repo) throw new Error('Pick one of your allowed repos for a new chat.')
    cwd = repo.path
    root = repo.path
    sdk = args.sdk === 'pi' ? 'pi' : 'claude'
    chatKey = `new:${crypto.randomUUID()}`
  }

  const job = options.validateJob({ sdk, prompt: args.prompt, mode: args.mode, model: args.model, effort: args.effort })
  const status = sdkStatus().find((s) => s.id === sdk)
  if (!status?.ready) throw new Error(status?.reason ?? 'That SDK is not available.')

  if (sdk === 'pi') {
    const piSdk = options.findPiSdk()
    return turnsApi.startTurn({
      chatKey,
      worker: { job, cwd, root, sessionFile, sdkEntry: piSdk.entry },
      meta: { sdk: 'pi', model: job.model, mode: job.mode, resume: sessionFile ? chatKey.slice('pi:'.length) : undefined },
      // pi logs a cost on every model call, so a turn's cost is exact.
      onFinish: (turn) => {
        if (turn.sessionId && !sessionFile) chatState.markStartedHere(ctx.dataDir, `pi:${turn.sessionId}`)
        return typeof turn.result?.costUsd === 'number' ? [{ t: 'cost', turnUsd: turn.result.costUsd, exact: true }] : []
      },
    })
  }

  const executable = options.findClaudeExecutable()
  const previous = resume ? readCosts(ctx.dataDir)[resume]?.usd : undefined
  return turnsApi.startTurn({
    chatKey,
    worker: { job, cwd, resume, executable },
    meta: { sdk: 'claude', model: job.model, mode: job.mode, resume },
    onFinish: (turn) => {
      if (turn.sessionId && !resume) chatState.markStartedHere(ctx.dataDir, `claude:${turn.sessionId}`)
      const r = turn.result
      if (!r || typeof r.costUsd !== 'number' || !turn.sessionId) return []
      const costs = readCosts(ctx.dataDir)
      costs[turn.sessionId] = { usd: r.costUsd, at: Date.now() }
      writeCosts(ctx.dataDir, costs)
      // Claude reports a resumed turn's cost as the session's running total.
      if (!resume) return [{ t: 'cost', turnUsd: r.costUsd, sessionUsd: r.costUsd, exact: true }]
      if (typeof previous === 'number' && r.costUsd >= previous) return [{ t: 'cost', turnUsd: r.costUsd - previous, sessionUsd: r.costUsd, exact: true }]
      return [{ t: 'cost', turnUsd: undefined, sessionUsd: r.costUsd, exact: false }]
    },
  })
}

/** git status and diff for a chat's folder (or a new chat's repo), re-checked against the allowed folders. */
async function getChanges(ctx, args = {}) {
  const folders = await allowedRepos(ctx.dataDir)
  let dir
  if (typeof args.chatId === 'string') {
    if (!known.has(args.chatId)) await listSessions({ dataDir: ctx.dataDir })
    const entry = known.get(args.chatId)
    if (!entry) throw new Error('Session not found')
    dir = entry.cwd ? await real(entry.cwd) : undefined
    if (!dir || !(await repoFor(folders.repos, dir))) throw new Error("This chat's folder is not in an allowed repo any more.")
  } else {
    const wanted = typeof args.repo === 'string' ? await real(args.repo) : undefined
    const repo = wanted && folders.repos.find((r) => r.path === wanted)
    if (!repo) throw new Error('Pick one of your allowed repos.')
    dir = repo.path
  }
  return changesApi.changes(dir)
}

module.exports = {
  id: 'agent-chat',
  start(ctx) {
    turnsApi.setLogger((msg, fields) => ctx.log(msg, JSON.stringify(fields)))
    try {
      require('electron').app.on('will-quit', () => turnsApi.stopAll())
    } catch {
      // not running under Electron (tests)
    }
  },
  methods: {
    getComposer: async (ctx) => getComposer(ctx),
    getChanges: async (ctx, args) => getChanges(ctx, args),
    startTurn: async (ctx, args) => startTurn(ctx, args),
    pollTurn: async (_ctx, args) => turnsApi.pollTurn(args?.turnId, args?.after),
    stopTurn: async (_ctx, args) => turnsApi.stopTurn(args?.turnId),
    runningTurn: async (_ctx, args) => (typeof args?.chatId === 'string' ? (turnsApi.runningTurnFor(args.chatId) ?? null) : null),
    listSessions: async (ctx) => listSessions({ dataDir: ctx.dataDir }),
    /** List flags live in a record file in the data folder, never in a transcript. */
    markSeen: async (ctx, args) => {
      chatState.markSeen(ctx.dataDir, args?.id)
    },
    setUnread: async (ctx, args) => {
      chatState.setUnread(ctx.dataDir, args?.id, !!args?.unread)
    },
    setArchived: async (ctx, args) => {
      chatState.setArchived(ctx.dataDir, args?.id, !!args?.archived)
    },
    getSession: async (ctx, args) => getSession(args?.id, { dataDir: ctx.dataDir }),
    getFolders: async (ctx) => {
      const f = await allowedRepos(ctx.dataDir)
      return { reposRoot: f.reposRoot, reposRootFound: f.reposRootFound, rootIsDefault: f.rootIsDefault, repos: f.repos, added: f.added }
    },
    /** Folder choices go through the system dialog, never a path typed in the page. */
    pickReposRoot: async (ctx) => {
      const dir = await pickFolder('Choose your Repos folder')
      if (dir) await setReposRoot(ctx.dataDir, dir)
      return !!dir
    },
    addRepo: async (ctx) => {
      const dir = await pickFolder('Add a git repository')
      if (dir) await addRepo(ctx.dataDir, dir)
      return !!dir
    },
    /** Only removes an entry from the list of added repos. */
    removeRepo: async (ctx, args) => {
      if (typeof args?.path === 'string') await removeRepo(ctx.dataDir, args.path)
    },
  },
  // Exported for tests.
  _format: { clip, oneLine, inputSummary, formatInput, contentText },
  _internal: { startTurn, getComposer, listSessions, getSession, claudeTranscript, claudeSubagentCalls, piSpend, chatTotal, piTranscript, piBranch, claudeMeta, piMeta },
}

async function pickFolder(title) {
  const { BrowserWindow, dialog } = require('electron')
  const win = BrowserWindow.getFocusedWindow()
  const opts = { title, properties: ['openDirectory'] }
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  return r.canceled ? undefined : r.filePaths[0]
}
