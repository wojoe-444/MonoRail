// Parse Claude Code and pi session entries without reading session files.

const MAX_TEXT = 20_000
const MAX_TOOL_TEXT = 4_000

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

module.exports = {
  parseLines, clip, oneLine, inputSummary, formatInput, contentText,
  claudeMeta, claudeTranscript, claudeSubagentCalls, piMeta, piTranscript, piBranch, piSpend,
}
