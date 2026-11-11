// Agent Chat worker: runs exactly one turn, then exits.
//
// The main process starts one of these per turn (agent-chat-turns.cjs) with
// MonoRail's own executable in ELECTRON_RUN_AS_NODE mode. The job, prompt
// included, arrives as JSON on stdin and is never placed on a command line.
// Events go back as one JSON object per line on stdout. Nothing here writes a
// log: stderr from Claude Code (hook output included) is dropped.

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { buildClaudeOptions, validateJob, DENY_MESSAGE } = require('./agent-chat-options.cjs')
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

/** SDK assistant content -> the transcript's ChatBlock shape. */
function toBlocks(content) {
  const blocks = []
  for (const c of Array.isArray(content) ? content : []) {
    if (c?.type === 'text' && c.text?.trim()) blocks.push({ type: 'text', text: fmt.clip(c.text) })
    else if (c?.type === 'thinking' && c.thinking?.trim()) blocks.push({ type: 'thinking', text: fmt.clip(c.thinking) })
    else if (c?.type === 'tool_use')
      blocks.push({ type: 'tool', id: c.id, name: c.name, summary: fmt.inputSummary(c.input), input: fmt.formatInput(c.input) })
  }
  return blocks
}

async function main() {
  const { job: rawJob, cwd, resume, executable } = await readStdin()
  const job = validateJob(rawJob)
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

  const options = buildClaudeOptions({ job, cwd, resume, executable, canUseTool })
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
      } else if (msg.type === 'assistant' && !msg.parent_tool_use_id) {
        const m = msg.message ?? {}
        const blocks = toBlocks(m.content)
        if (blocks.length) emit({ t: 'assistant', id: m.id, model: m.model, blocks })
        if (m.usage) {
          emit({
            t: 'usage',
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
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    emit({ t: 'error', message: err instanceof Error ? err.message : String(err) })
    process.exit(1)
  },
)
