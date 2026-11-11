// One pi turn, driven through the user's own pi coding agent SDK.
// Loaded by agent-chat-worker.mjs; emits the same events as the Claude path.

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { piTools, piThinkingLevel, piPathAllowed } = require('./agent-chat-options.cjs')
const { _format: fmt } = require('./agent-chat.cjs')

function toBlocks(message) {
  const blocks = []
  const content = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : Array.isArray(message.content) ? message.content : []
  for (const c of content) {
    if (c?.type === 'text' && c.text?.trim()) blocks.push({ type: 'text', text: fmt.clip(c.text) })
    else if (c?.type === 'thinking' && c.thinking?.trim()) blocks.push({ type: 'thinking', text: fmt.clip(c.thinking) })
    else if (c?.type === 'toolCall') blocks.push({ type: 'tool', id: c.id, name: c.name, summary: fmt.inputSummary(c.arguments), input: fmt.formatInput(c.arguments) })
  }
  if (message.errorMessage) blocks.push({ type: 'text', text: `Error: ${fmt.oneLine(message.errorMessage, 500)}` })
  return blocks
}

/**
 * @param {{ job: any, cwd: string, root: string, sessionFile?: string, sdkEntry: string }} payload
 * @param {(e: object) => void} emit
 */
export async function runPi({ job, cwd, root, sessionFile, sdkEntry }, emit) {
  // stdout carries events only; anything the SDK prints goes to stderr, which is dropped.
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = (...a) => process.stderr.write(`${a.join(' ')}\n`)
  const pi = await import(pathToFileURL(sdkEntry).href)
  const tools = piTools(job.mode)

  // Every tool path must stay inside the chat's repo. A handler that throws
  // also blocks the tool (pi fails safe).
  const guard = (api) => {
    api.on('tool_call', async (event) => {
      if (!tools.includes(event.toolName)) {
        emit({ t: 'denied', kind: 'Blocked', tool: event.toolName, toolUseId: event.toolCallId, reason: 'This tool is not offered in this mode.' })
        return { block: true, reason: 'This tool is not available here.' }
      }
      const target = event.input?.path
      if (!(await piPathAllowed(root, cwd, target))) {
        emit({
          t: 'denied',
          kind: 'Blocked',
          tool: event.toolName,
          toolUseId: event.toolCallId,
          summary: fmt.inputSummary(event.input),
          reason: "Outside this chat's repo.",
        })
        return { block: true, reason: "Only files inside this chat's repository can be used." }
      }
      return undefined
    })
  }

  const agentDir = pi.getAgentDir()
  // The user's own extensions are not loaded: they could add tools (a shell).
  const resourceLoader = new pi.DefaultResourceLoader({ cwd, agentDir, noExtensions: true, extensionFactories: [guard] })
  await resourceLoader.reload()

  const authStorage = pi.AuthStorage.create()
  const modelRegistry = pi.ModelRegistry.create(authStorage)
  let model
  if (job.model !== 'default') {
    const [provider, ...rest] = job.model.split('/')
    model = modelRegistry.find(provider, rest.join('/'))
    if (!model) throw new Error(`This version of pi does not know ${job.model}. Update pi or pick another model.`)
  }

  const sessionManager = sessionFile ? pi.SessionManager.open(sessionFile) : pi.SessionManager.create(cwd)
  const thinkingLevel = piThinkingLevel(job.effort)
  const { session } = await pi.createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    resourceLoader,
    sessionManager,
    tools,
    ...(model ? { model } : {}),
    ...(thinkingLevel ? { thinkingLevel } : {}),
  })

  emit({ t: 'init', sessionId: session.sessionId, model: session.model?.id })

  let n = 0
  let costUsd = 0
  let calls = 0
  let lastError
  session.subscribe((event) => {
    switch (event.type) {
      case 'message_start':
        if (event.message?.role === 'assistant') emit({ t: 'message_start', id: `pi-${++n}` })
        break
      case 'message_update':
        if (event.assistantMessageEvent?.type === 'text_delta') emit({ t: 'delta', text: event.assistantMessageEvent.delta })
        break
      case 'message_end': {
        const m = event.message
        if (m?.role !== 'assistant') break
        const blocks = toBlocks(m)
        if (blocks.length) emit({ t: 'assistant', id: `pi-${n}`, model: m.model, blocks })
        // A call to a tool this mode does not offer never reaches tool_call: show it here.
        for (const b of blocks) {
          if (b.type !== 'tool' || tools.includes(b.name)) continue
          const shell = /bash|shell|exec/i.test(b.name)
          emit({
            t: 'denied',
            kind: 'Blocked',
            tool: b.name,
            toolUseId: b.id,
            summary: b.summary,
            reason: shell ? 'pi never gets shell commands from this page.' : job.mode === 'ask' ? 'Ask mode only reads files. Switch to Agent to let pi edit files.' : 'This tool is not offered here.',
          })
        }
        lastError = m.stopReason === 'error' ? m.errorMessage || 'pi stopped with an error.' : undefined
        const u = m.usage
        if (u) {
          calls++
          costUsd += u.cost?.total ?? 0
          emit({ t: 'usage', model: m.model, input: u.input ?? 0, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0, output: u.output ?? 0, costUsd: u.cost?.total })
        }
        break
      }
      case 'tool_execution_end':
        emit({ t: 'tool_result', toolUseId: event.toolCallId, result: fmt.clip(fmt.contentText(event.result?.content ?? event.result), 4000), isError: !!event.isError })
        break
      default:
        break
    }
  })

  const started = Date.now()
  try {
    await session.prompt(job.prompt, { expandPromptTemplates: false })
  } finally {
    emit({
      t: 'result',
      subtype: lastError ? 'error' : 'success',
      isError: !!lastError,
      costUsd,
      durationMs: Date.now() - started,
      numTurns: calls,
      contextWindow: session.model?.contextWindow,
      errors: lastError ? [fmt.oneLine(lastError, 300)] : undefined,
    })
    session.dispose()
  }
}
