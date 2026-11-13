// Flows: running a flow.
//
// A run walks the graph in order (flows-graph.cjs): a step starts as soon as
// every step feeding it has finished, so independent branches run side by
// side (at most MAX_PARALLEL steps at once). Text steps run here in a moment.
// Agent, subagent and model steps are Chat turns, started through the Chat
// module's own startTurn (injected as `deps.startTurn`), so everything a Chat
// turn obeys applies unchanged: the allowed folders, Ask/Agent, the system
// prompts, assertNoBypass, the per-chat lock and the spending limit.
//
// Runs live in memory while the app runs (the page polls them). What is kept
// on disk afterwards is metadata only (flows.cjs, runs.json): when, how long,
// the outcome, the cost and the number of steps. Never a prompt or a reply.

const crypto = require('node:crypto')

const graph = require('./flows-graph.cjs')

const MAX_PARALLEL = 4
const RUN_TIMEOUT_MS = 30 * 60 * 1000
const KEEP_FINISHED_MS = 60 * 60 * 1000
const MAX_OUTPUT = 200_000
const PREVIEW = 600

/** runId -> run */
const runs = new Map()

const clip = (s, max = MAX_OUTPUT) => (s.length > max ? `${s.slice(0, max)}\n... (cut at ${max} characters)` : s)
const preview = (s) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > PREVIEW ? `${t.slice(0, PREVIEW - 1)}…` : t
}

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

/** A Catalog subagent's model line as one of Chat's model ids. */
function modelFor(sdk, subagentModel, models) {
  const m = String(subagentModel ?? '').toLowerCase()
  if (!m || m === 'inherit') return 'default'
  const ids = models[sdk].map((x) => x.id)
  if (ids.includes(m)) return m
  if (sdk === 'claude') for (const name of ['opus', 'sonnet', 'haiku', 'fable']) if (m.includes(name)) return ids.find((id) => id.includes(name)) ?? 'default'
  return 'default'
}

function prune(now = Date.now()) {
  for (const [id, r] of runs) if (r.endedAt && now - r.endedAt > KEEP_FINISHED_MS) runs.delete(id)
}

/**
 * Start a run. `flow` is a cleaned flow; `input` the Playground message.
 * deps: {
 *   startTurn({ sdk, repoPath, prompt, mode, model }) -> { turnId }
 *   pollTurn(turnId) -> { status, events }
 *   stopTurn(turnId)
 *   resolveRepo(name) -> { name, path } | undefined   (allowed repos only)
 *   getSubagent(id) -> { name, tool, model, prompt }
 *   models: { claude: [{id}], pi: [{id}] }
 *   onEnd(run)                                         (records metadata)
 *   pollMs?
 * }
 */
function startRun({ flow, input = '', deps }) {
  prune()
  const issues = graph.problems(flow)
  if (issues.length) throw new Error(issues.slice(0, 4).join(' '))
  const id = crypto.randomUUID()
  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  const run = {
    id,
    flowId: flow.id,
    status: 'running',
    startedAt: Date.now(),
    endedAt: undefined,
    reply: undefined,
    details: undefined,
    error: undefined,
    steps: flow.nodes.map((n) => ({
      nodeId: n.id,
      kind: n.kind,
      label: n.title || graph.COMPONENTS.get(n.kind).title,
      status: 'queued',
      startedAt: undefined,
      endedAt: undefined,
      costUsd: undefined,
      tools: 0,
      output: undefined,
      error: undefined,
      turnId: undefined,
    })),
    stopped: false,
  }
  runs.set(id, run)
  const stepOf = (nodeId) => run.steps.find((s) => s.nodeId === nodeId)
  /** nodeId -> { [output port]: string } */
  const outputs = new Map()

  const inputsFor = (node) => {
    const vals = {}
    for (const e of flow.edges) {
      if (e.target !== node.id) continue
      const v = outputs.get(e.source)?.[e.sourceHandle]
      if (v === undefined) continue
      vals[e.targetHandle] = vals[e.targetHandle] === undefined ? v : `${vals[e.targetHandle]}\n\n${v}`
    }
    return vals
  }
  const val = (node, inputs, field) => (inputs[field] !== undefined ? inputs[field] : graph.valueOf(node, field))

  async function turn(step, { sdk, folder, prompt, mode, model }) {
    const repo = deps.resolveRepo(folder || flow.folder)
    if (!repo) throw new Error(folder || flow.folder ? `"${folder || flow.folder}" is not one of Chat's allowed repos any more.` : "Pick a repo for this flow (top bar) or for this step: agents work inside one of Chat's allowed repos.")
    const { turnId } = await deps.startTurn({ sdk, repoPath: repo.path, prompt, mode, model })
    step.turnId = turnId
    const pollMs = deps.pollMs ?? 500
    for (;;) {
      if (run.stopped) throw new Error('Stopped.')
      const p = deps.pollTurn(turnId)
      step.tools = p.events.filter((e) => e.t === 'tool_result').length
      if (p.status !== 'running') {
        const cost = p.events.findLast((e) => e.t === 'cost')
        const result = p.events.findLast((e) => e.t === 'result')
        step.costUsd = typeof cost?.turnUsd === 'number' ? cost.turnUsd : typeof result?.costUsd === 'number' ? result.costUsd : undefined
        if (p.status !== 'done') {
          const err = p.events.findLast((e) => e.t === 'error')?.message
          throw new Error(err || (p.status === 'timed_out' ? 'The turn timed out.' : `The turn ended: ${p.status}.`))
        }
        const text = replyText(p.events)
        if (!text.trim()) throw new Error('The agent finished without a reply.')
        return text
      }
      await new Promise((r) => setTimeout(r, pollMs))
    }
  }

  async function exec(node, step) {
    const inputs = inputsFor(node)
    switch (node.kind) {
      case 'chat-input':
        return { message: String(input).trim() ? String(input) : graph.valueOf(node, 'text') }
      case 'text-input':
        return { text: graph.valueOf(node, 'text') }
      case 'prompt': {
        const vars = {}
        for (const v of graph.placeholders(graph.valueOf(node, 'template'))) vars[v] = inputs[`var:${v}`] ?? ''
        return { text: graph.fill(graph.valueOf(node, 'template'), vars) }
      }
      case 'combine': {
        const parts = [val(node, inputs, 'a'), val(node, inputs, 'b')].filter((s) => String(s).trim())
        return { text: parts.join(graph.unescape(graph.valueOf(node, 'sep'))) }
      }
      case 'model': {
        const prompt = `${val(node, inputs, 'input')}\n\n(Answer directly in your reply. Do not use any tools.)`
        return { text: await turn(step, { sdk: 'claude', folder: '', prompt, mode: 'ask', model: graph.valueOf(node, 'model') || 'default' }) }
      }
      case 'agent': {
        const sdk = graph.valueOf(node, 'sdk') === 'pi' ? 'pi' : 'claude'
        const instructions = String(val(node, inputs, 'instructions')).trim()
        const task = val(node, inputs, 'input')
        const prompt = instructions ? `${instructions}\n\n---\n\n${task}` : task
        let model = graph.valueOf(node, 'model') || 'default'
        if (!deps.models[sdk].some((m) => m.id === model)) model = 'default'
        return { reply: await turn(step, { sdk, folder: graph.valueOf(node, 'folder'), prompt, mode: graph.valueOf(node, 'mode') === 'agent' ? 'agent' : 'ask', model }) }
      }
      case 'subagent': {
        const sub = await deps.getSubagent(graph.valueOf(node, 'subagent'))
        const sdk = sub.tool === 'pi' ? 'pi' : 'claude'
        const prompt = `You are acting as the "${sub.name}" subagent. Its instructions:\n\n${sub.prompt}\n\n---\n\nYour task:\n\n${val(node, inputs, 'input')}`
        return { reply: await turn(step, { sdk, folder: graph.valueOf(node, 'folder'), prompt, mode: graph.valueOf(node, 'mode') === 'agent' ? 'agent' : 'ask', model: modelFor(sdk, sub.model, deps.models) }) }
      }
      case 'chat-output': {
        const reply = String(val(node, inputs, 'input'))
        const details = String(val(node, inputs, 'details') ?? '')
        if (run.reply === undefined) {
          run.reply = clip(reply)
          if (details.trim()) run.details = clip(details)
        }
        return {}
      }
      default:
        throw new Error(`Unknown step type ${node.kind}`)
    }
  }

  const finish = (status, error) => {
    if (run.endedAt) return
    run.status = status
    run.error = error
    run.endedAt = Date.now()
    clearTimeout(run.timer)
    for (const s of run.steps) if (s.status === 'queued') s.status = 'skipped'
    try {
      deps.onEnd?.(run)
    } catch {
      // bookkeeping never breaks a run
    }
  }

  // Scheduler: start every step whose sources are done, up to MAX_PARALLEL.
  const sources = new Map(flow.nodes.map((n) => [n.id, new Set(flow.edges.filter((e) => e.target === n.id).map((e) => e.source))]))
  const done = new Set()
  const started = new Set()
  let active = 0
  const pump = () => {
    if (run.endedAt) return
    if (done.size === flow.nodes.length) return finish(run.reply === undefined ? 'failed' : 'done', run.reply === undefined ? 'No Chat output was reached.' : undefined)
    for (const node of flow.nodes) {
      if (active >= MAX_PARALLEL) break
      if (started.has(node.id) || [...sources.get(node.id)].some((s) => !done.has(s))) continue
      started.add(node.id)
      active++
      const step = stepOf(node.id)
      step.status = 'running'
      step.startedAt = Date.now()
      exec(byId.get(node.id), step).then(
        (out) => {
          active--
          step.status = 'done'
          step.endedAt = Date.now()
          const first = Object.values(out)[0]
          if (first !== undefined) step.output = preview(first)
          outputs.set(node.id, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, clip(String(v))])))
          done.add(node.id)
          pump()
        },
        (err) => {
          active--
          step.status = run.stopped ? 'stopped' : 'failed'
          step.endedAt = Date.now()
          step.error = err?.message ?? String(err)
          if (!run.stopped) stopTurns(run, deps)
          finish(run.stopped ? 'stopped' : 'failed', run.stopped ? undefined : `${step.label}: ${step.error}`)
        },
      )
    }
  }

  run.timer = setTimeout(() => {
    run.stopped = true
    stopTurns(run, deps)
    finish('timed_out', `Stopped after ${Math.round(RUN_TIMEOUT_MS / 60000)} minutes.`)
  }, RUN_TIMEOUT_MS)
  run.timer.unref?.()
  queueMicrotask(pump)
  return { runId: id }
}

function stopTurns(run, deps) {
  for (const s of run.steps) {
    if (s.status === 'running' && s.turnId) {
      try {
        deps.stopTurn(s.turnId)
      } catch {
        // already gone
      }
    }
  }
}

/** What the page sees: never the step outputs in full, only previews (the reply in full). */
function snapshot(run) {
  return {
    id: run.id,
    flowId: run.flowId,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    reply: run.reply,
    details: run.details,
    error: run.error,
    costUsd: run.steps.reduce((n, s) => n + (s.costUsd ?? 0), 0),
    steps: run.steps.map(({ turnId: _t, ...s }) => s),
  }
}

function pollRun(runId) {
  const run = runs.get(runId)
  if (!run) throw new Error('That run is no longer available.')
  return snapshot(run)
}

function stopRun(runId, deps) {
  const run = runs.get(runId)
  if (!run || run.endedAt) return
  run.stopped = true
  stopTurns(run, deps)
  for (const s of run.steps) if (s.status === 'running') s.status = 'stopped'
  run.status = 'stopped'
  run.endedAt = Date.now()
  clearTimeout(run.timer)
  for (const s of run.steps) if (s.status === 'queued') s.status = 'skipped'
  try {
    deps.onEnd?.(run)
  } catch {
    // ignore
  }
}

/** The latest running run of a flow, so a reopened page can follow it again. */
function runningRunFor(flowId) {
  for (const r of runs.values()) if (r.flowId === flowId && !r.endedAt) return r.id
  return undefined
}

module.exports = { startRun, pollRun, stopRun, runningRunFor, replyText, modelFor, MAX_PARALLEL, _runs: runs }
