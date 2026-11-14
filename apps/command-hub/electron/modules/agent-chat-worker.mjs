// Agent Chat worker: runs exactly one turn, then exits.
//
// The main process starts one of these per turn (agent-chat-turns.cjs) with
// MonoRail's own executable in ELECTRON_RUN_AS_NODE mode. The job, prompt
// included, arrives as JSON on stdin and is never placed on a command line.
// Events go back as one JSON object per line on stdout. Nothing here writes a
// log: stderr from Claude Code (hook output included) is dropped.

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildClaudeOptions, validateJob, findCoordinator, DENY_MESSAGE } = require('./agent-chat-options.cjs')
const { _format: fmt } = require('./agent-chat.cjs')

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`)
}

async function readStdin() {
  let data = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) data += chunk
  return JSON.parse(data)
}

/** SDK assistant content -> the transcript's ChatBlock shape. Reasoning only when asked for. */
function toBlocks(content, reasoning) {
  const blocks = []
  for (const c of Array.isArray(content) ? content : []) {
    if (c?.type === 'text' && c.text?.trim()) blocks.push({ type: 'text', text: fmt.clip(c.text) })
    else if (reasoning && c?.type === 'thinking' && c.thinking?.trim()) blocks.push({ type: 'thinking', text: fmt.clip(c.thinking) })
    else if (c?.type === 'tool_use')
      blocks.push({ type: 'tool', id: c.id, name: c.name, summary: fmt.inputSummary(c.input), input: fmt.formatInput(c.input) })
  }
  return blocks
}

/** JSON-ish property spec -> zod type. */
function zodFor(z, spec) {
  let t
  if (spec.enum) t = z.enum(spec.enum)
  else if (spec.type === 'integer') {
    t = z.number().int()
    if (spec.minimum !== undefined) t = t.min(spec.minimum)
    if (spec.maximum !== undefined) t = t.max(spec.maximum)
  } else if (spec.type === 'boolean') t = z.boolean()
  else {
    t = z.string().min(1)
    if (spec.maxLength) t = t.max(spec.maxLength)
  }
  if (spec.description) t = t.describe(spec.description)
  return t
}

/** The coordinator's in-process MCP server. Child turns it starts end with this worker. */
async function chatToolsServer(dataDir) {
  const { createSdkMcpServer, tool } = await import('@anthropic-ai/claude-agent-sdk')
  const { z } = await import('zod')
  const { chatTools, CHAT_TOOL_SPECS } = require('./agent-chat-coordinator.cjs')
  const handlers = chatTools({ dataDir })
  const tools = Object.entries(CHAT_TOOL_SPECS).map(([name, spec]) => {
    const shape = {}
    for (const [k, p] of Object.entries(spec.properties)) {
      const t = zodFor(z, p)
      shape[k] = spec.required?.includes(k) ? t : t.optional()
    }
    return tool(name, spec.description, shape, async (args) => {
      try {
        const value = await handlers[name](args)
        return { content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] }
      } catch (e) {
        return { content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true }
      }
    })
  })
  return createSdkMcpServer({ name: 'monorail', version: '1.0.0', tools })
}

async function main() {
  const payload = await readStdin()
  const job = validateJob(payload.job)
  if (job.sdk === 'pi') {
    const { runPi } = await import('./agent-chat-worker-pi.mjs')
    return runPi({ ...payload, job }, emit)
  }
  const { cwd, resume, executable } = payload
  const reported = new Set()

  // Agent mode: nobody can answer an approval prompt here, so every prompt is
  // denied, and the denial shows in the thread.
  const canUseTool = async (toolName, input, opts) => {
    reported.add(opts?.toolUseID)
    emit({
      t: 'denied',
      kind: 'Denied',
      tool: toolName,
      toolUseId: opts?.toolUseID,
      summary: fmt.inputSummary(input),
      reason: opts?.decisionReason || 'This tool needs approval, and approvals cannot be given from this page.',
    })
    return { behavior: 'deny', message: DENY_MESSAGE }
  }

  // The coordinator gets MonoRail's chat tools (agent-chat-coordinator.cjs):
  // list, read, message and start the user's allowed chats.
  const coordinatorServer = job.coordinator && payload.dataDir ? await chatToolsServer(payload.dataDir) : undefined

  // No coordinator.md of the user's own: run MonoRail's built-in coordinator.
  const builtinCoordinator = job.coordinator && !findCoordinator()
  const coordinatorDefinition = builtinCoordinator && payload.dataDir ? require('./builtin-template-store.cjs').read(payload.dataDir, 'coordinator')?.value : undefined

  const options = buildClaudeOptions({ job, cwd, resume, executable, canUseTool, coordinatorServer, builtinCoordinator, coordinatorDefinition })
  options.stderr = () => {} // hook and debug output stays out of the page and the logs

  // Streaming input: the prompt goes to Claude Code over its stdin, never argv.
  let finish
  const done = new Promise((r) => (finish = r))
  async function* input() {
    yield { type: 'user', message: { role: 'user', content: job.prompt }, parent_tool_use_id: null, session_id: '' }
    await done
  }

  const { query } = await import('@anthropic-ai/claude-agent-sdk')
  try {
    for await (const msg of query({ prompt: input(), options })) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        emit({ t: 'init', sessionId: msg.session_id, model: msg.model })
      } else if (msg.type === 'system' && msg.subtype === 'permission_denied') {
        if (reported.has(msg.tool_use_id)) continue
        reported.add(msg.tool_use_id)
        emit({ t: 'denied', kind: 'Blocked', tool: msg.tool_name, toolUseId: msg.tool_use_id, reason: msg.decision_reason || msg.message || 'Blocked by the permission rules.' })
      } else if (msg.type === 'stream_event' && !msg.parent_tool_use_id) {
        const e = msg.event
        if (e?.type === 'message_start') emit({ t: 'message_start', id: e.message?.id })
        else if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta') emit({ t: 'delta', text: e.delta.text })
      } else if (msg.type === 'assistant') {
        const m = msg.message ?? {}
        const sub = !!msg.parent_tool_use_id
        if (!sub) {
          const blocks = toBlocks(m.content, job.reasoning)
          if (blocks.length) emit({ t: 'assistant', id: m.id, model: m.model, blocks })
        }
        // One line per content block, all with the same usage: the page keeps the last per id.
        if (m.usage) {
          emit({
            t: 'usage',
            id: m.id,
            subagent: sub || undefined,
            model: m.model,
            input: m.usage.input_tokens ?? 0,
            cacheRead: m.usage.cache_read_input_tokens ?? 0,
            cacheWrite: m.usage.cache_creation_input_tokens ?? 0,
            output: m.usage.output_tokens ?? 0,
          })
        }
      } else if (msg.type === 'user' && !msg.parent_tool_use_id && Array.isArray(msg.message?.content)) {
        for (const c of msg.message.content) {
          if (c?.type !== 'tool_result') continue
          emit({ t: 'tool_result', toolUseId: c.tool_use_id, result: fmt.clip(fmt.contentText(c.content), 4000), isError: !!c.is_error })
        }
      } else if (msg.type === 'result') {
        // permission_denials is the authoritative record; report any we missed.
        for (const d of msg.permission_denials ?? []) {
          if (reported.has(d.tool_use_id)) continue
          reported.add(d.tool_use_id)
          emit({ t: 'denied', kind: 'Blocked', tool: d.tool_name, toolUseId: d.tool_use_id, summary: fmt.inputSummary(d.tool_input), reason: 'Blocked by the permission rules.' })
        }
        const contextWindow = Math.max(0, ...Object.values(msg.modelUsage ?? {}).map((u) => u.contextWindow ?? 0))
        emit({
          t: 'result',
          subtype: msg.subtype,
          isError: !!msg.is_error,
          costUsd: msg.total_cost_usd,
          durationMs: msg.duration_ms,
          numTurns: msg.num_turns,
          contextWindow: contextWindow || undefined,
          errors: Array.isArray(msg.errors) ? msg.errors.slice(0, 5).map((e) => fmt.oneLine(e, 300)) : undefined,
        })
        finish()
      }
    }
  } finally {
    finish()
    // Chats the coordinator messaged are children of this turn: stop any
    // still running (on Windows taskkill runs async, so give it a moment).
    const { runningTurns, stopAll } = require('./agent-chat-turns.cjs')
    if (runningTurns().length) {
      stopAll()
      if (process.platform === 'win32') await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    emit({ t: 'error', message: err instanceof Error ? err.message : String(err) })
    process.exit(1)
  },
)
