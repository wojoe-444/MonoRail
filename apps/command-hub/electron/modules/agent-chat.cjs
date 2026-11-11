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

const HEAD_BYTES = 256 * 1024
const MAX_TEXT = 20_000
const MAX_TOOL_TEXT = 4_000
const MAX_FILE_BYTES = 64 * 1024 * 1024

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
  const meta = { cwd: undefined, branch: undefined, model: undefined, title: undefined, prompt: undefined, start: undefined }
  for (const d of entries) {
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
  return messages.filter((m) => m.blocks.length > 0).map(({ id: _id, ...m }) => m)
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
      if (blocks.length) messages.push({ role: 'assistant', ts, model: m.model, blocks })
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
  const def = SOURCES[source]
  const head = parseLines(await readHead(file))
  const tail = parseLines(await readTail(file, stat.size))
  const meta = def.meta([...head, ...tail])
  if (!meta.prompt && !meta.title) {
    summaryCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, summary: null })
    return null
  }
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
  }
  summaryCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, summary })
  return summary
}

async function listSessions(opts = {}) {
  const env = opts.env ?? process.env
  const home = opts.home ?? os.homedir()
  const sessions = []
  const sources = []
  for (const [source, def] of Object.entries(SOURCES)) {
    const roots = def.roots(env, home).filter((r) => fs.existsSync(r))
    sources.push({ id: source, label: def.label, found: roots.length > 0, roots })
    for (const root of roots) {
      for (const file of await listJsonl(root, def.depth, def.skip)) {
        try {
          const s = await summarize(source, root, file)
          if (!s) continue
          known.set(s.id, { source, file })
          sessions.push(s)
        } catch {
          // Unreadable file: leave it out.
        }
      }
    }
  }
  // The same Claude session can exist under two config roots; keep the newest.
  const byId = new Map()
  for (const s of sessions) if (!byId.has(s.id) || byId.get(s.id).updatedAt < s.updatedAt) byId.set(s.id, s)
  return {
    sources: sources.map(({ roots: _roots, ...s }) => s),
    sessions: [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt),
  }
}

async function getSession(id, opts) {
  if (typeof id !== 'string') throw new Error('Missing session id')
  if (!known.has(id)) await listSessions(opts)
  const entry = known.get(id)
  if (!entry) throw new Error('Session not found')
  const stat = await fs.promises.stat(entry.file)
  if (stat.size > MAX_FILE_BYTES) throw new Error('This session log is too large to open here.')
  const entries = parseLines(await fs.promises.readFile(entry.file, 'utf8'))
  const def = SOURCES[entry.source]
  return { id, messages: def.transcript(entries) }
}

module.exports = {
  id: 'agent-chat',
  methods: {
    listSessions: async () => listSessions(),
    getSession: async (_ctx, args) => getSession(args?.id),
  },
  // Exported for tests.
  _internal: { listSessions, getSession, claudeTranscript, piTranscript, piBranch, claudeMeta, piMeta },
}
