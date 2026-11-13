const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const graph = require('./flows-graph.cjs')
const runner = require('./flows-runner.cjs')
const { createFlowsStore } = require('./flows-store.cjs')
const { TEMPLATES } = require('./flows-templates.cjs')

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'flows-'))
const node = (id, kind, values = {}, extra = {}) => ({ id, kind, x: 0, y: 0, values, ...extra })
const edge = (id, source, sourceHandle, target, targetHandle) => ({ id, source, sourceHandle, target, targetHandle })

describe('flows graph', () => {
  test('a prompt template gets one input per placeholder', () => {
    assert.deepEqual(graph.placeholders('Hi {name}, about {topic} and {name} again {9bad}'), ['name', 'topic'])
    const ports = graph.inputsOf(node('p', 'prompt', { template: 'A {x} B {y}' }))
    assert.deepEqual(ports.map((p) => p.id), ['var:x', 'var:y'])
  })

  test('cleanFlow drops dangling and mistyped edges and unknown fields', () => {
    const f = graph.cleanFlow({
      name: '  My flow ',
      nodes: [node('in', 'chat-input', { text: 'hi', junk: 'x' }), node('out', 'chat-output')],
      edges: [edge('e1', 'in', 'message', 'out', 'input'), edge('e2', 'in', 'message', 'ghost', 'input'), edge('e3', 'in', 'nope', 'out', 'input')],
    })
    assert.equal(f.name, 'My flow')
    assert.deepEqual(f.nodes[0].values, { text: 'hi' })
    assert.deepEqual(f.edges.map((e) => e.id), ['e1'])
  })

  test('unknown kinds, repeated ids and loops are refused', () => {
    assert.throws(() => graph.cleanFlow({ nodes: [node('a', 'shell-command')] }), /Unknown step type/)
    assert.throws(() => graph.cleanFlow({ nodes: [node('a', 'chat-input'), node('a', 'chat-output')] }), /repeated id/)
    const loop = {
      nodes: [node('a', 'combine'), node('b', 'combine')],
      edges: [edge('e1', 'a', 'text', 'b', 'a'), edge('e2', 'b', 'text', 'a', 'a')],
    }
    assert.throws(() => graph.cleanFlow(loop), /loop/)
  })

  test('problems names missing required inputs and a missing output', () => {
    const f = graph.cleanFlow({ nodes: [node('m', 'model')] })
    const p = graph.problems(f)
    assert.ok(p.some((s) => /Chat output/.test(s)))
    assert.ok(p.some((s) => /Model call: "Prompt" needs/.test(s)))
  })

  test('every template is a clean flow that is ready to run', () => {
    for (const t of TEMPLATES) {
      const f = graph.cleanFlow(t.flow)
      assert.equal(f.edges.length, t.flow.edges.length, `${t.id}: an edge was dropped`)
      assert.deepEqual(graph.problems(f), [], t.id)
    }
  })

  test('the components file and the graph agree', () => {
    for (const c of graph.COMPONENTS_FILE.components) {
      assert.ok(graph.COMPONENTS_FILE.categories.some((k) => k.id === c.category), c.kind)
      for (const o of c.outputs) assert.ok(['message', 'text', 'data', 'any'].includes(o.type), `${c.kind}.${o.id}`)
    }
  })
})

describe('flows store', () => {
  test('create, save, flush, history, version and remove', async () => {
    const dir = tmp()
    const store = createFlowsStore(dir, { commitAfterMs: 60_000 })
    try {
      const { flow } = await store.create(TEMPLATES.find((t) => t.id === 'basic-prompt').flow)
      assert.match(flow.id, /^basic-prompt-[0-9a-f]{6}$/)
      assert.ok(!fs.readdirSync(dir).some((f) => f !== 'repo'), 'only the repo folder is written')
      await store.save(flow.id, { ...flow, name: 'Renamed' })
      assert.equal((await store.list()).pending, 1)
      await store.flush()
      const hist = await store.history(flow.id)
      assert.equal(hist.length, 2)
      const old = await store.version(flow.id, hist[1].oid)
      assert.equal(old.flow.name, 'Basic prompt')
      assert.equal((await store.get(flow.id)).flow.name, 'Renamed')
      await store.remove(flow.id)
      assert.deepEqual((await store.list()).flows, [])
      await assert.rejects(store.get('../escape'), /Unknown flow/)
    } finally {
      store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a damaged flow file is listed with an error, not dropped', async () => {
    const dir = tmp()
    const store = createFlowsStore(dir)
    try {
      await store.list()
      fs.writeFileSync(path.join(dir, 'repo', 'flows', 'broken-abc123.json'), '{ not json')
      const { flows } = await store.list()
      assert.equal(flows.length, 1)
      assert.match(flows[0].error, /damaged/)
    } finally {
      store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('flows runner', () => {
  const models = { claude: [{ id: 'default' }, { id: 'claude-sonnet-5-5' }], pi: [{ id: 'default' }] }

  /** Fake Chat turns: each replies with the text the test picks, after a tick. */
  function fakeDeps({ reply = (p) => `reply to: ${p}`, fail } = {}) {
    const turns = new Map()
    const started = []
    let n = 0
    return {
      started,
      deps: {
        models,
        pollMs: 1,
        resolveRepo: (name) => (name === 'demo' ? { name: 'demo', path: '/repos/demo' } : undefined),
        async startTurn(job) {
          const id = `t${++n}`
          started.push(job)
          turns.set(id, { at: Date.now(), job })
          return { turnId: id }
        },
        pollTurn(id) {
          const t = turns.get(id)
          if (Date.now() - t.at < 5) return { status: 'running', events: [] }
          if (fail && fail(t.job)) return { status: 'failed', events: [{ t: 'error', message: 'boom' }] }
          return { status: 'done', events: [{ t: 'assistant', blocks: [{ type: 'text', text: reply(t.job.prompt) }] }, { t: 'cost', turnUsd: 0.01 }] }
        },
        stopTurn: (id) => turns.delete(id),
        getSubagent: async () => ({ name: 'researcher', tool: 'claude', model: 'sonnet', prompt: 'Find facts.' }),
        onEnd() {},
      },
    }
  }

  async function finished(runId) {
    for (let i = 0; i < 400; i++) {
      const r = runner.pollRun(runId)
      if (r.status !== 'running') return r
      await new Promise((res) => setTimeout(res, 5))
    }
    throw new Error('run did not finish')
  }

  test('text steps fill a prompt and reach the output', async () => {
    const flow = graph.cleanFlow({
      nodes: [node('in', 'chat-input'), node('p', 'prompt', { template: 'Q: {q}!' }), node('out', 'chat-output')],
      edges: [edge('e1', 'in', 'message', 'p', 'var:q'), edge('e2', 'p', 'text', 'out', 'input')],
    })
    const { deps } = fakeDeps()
    const r = await finished(runner.startRun({ flow, input: 'why', deps }).runId)
    assert.equal(r.status, 'done')
    assert.equal(r.reply, 'Q: why!')
    assert.ok(r.steps.every((s) => s.status === 'done'))
  })

  test('agent steps are Chat turns in the flow repo, in parallel, with cost', async () => {
    const t = TEMPLATES.find((x) => x.id === 'side-by-side')
    const flow = graph.cleanFlow({ ...t.flow, folder: 'demo' })
    const { deps, started } = fakeDeps()
    const r = await finished(runner.startRun({ flow, input: 'ship it', deps }).runId)
    assert.equal(r.status, 'done', r.error)
    assert.equal(started.length, 3)
    assert.ok(started.every((j) => j.repoPath === '/repos/demo' && j.mode === 'ask'))
    assert.ok(started.slice(0, 2).every((j) => j.prompt.endsWith('ship it')))
    assert.equal(started[2].model, 'claude-sonnet-5-5')
    assert.ok(Math.abs(r.costUsd - 0.03) < 1e-9)
  })

  test('a subagent step runs its instructions with a matching model', async () => {
    const flow = graph.cleanFlow({
      folder: 'demo',
      nodes: [node('in', 'chat-input'), node('s', 'subagent', { subagent: 'sub_1' }), node('out', 'chat-output')],
      edges: [edge('e1', 'in', 'message', 's', 'input'), edge('e2', 's', 'reply', 'out', 'input')],
    })
    const { deps, started } = fakeDeps()
    const r = await finished(runner.startRun({ flow, input: 'look', deps }).runId)
    assert.equal(r.status, 'done')
    assert.match(started[0].prompt, /Find facts\.[\s\S]*look$/)
    assert.equal(started[0].model, 'claude-sonnet-5-5')
  })

  test('no repo, a failing step and problems stop the run with a reason', async () => {
    const t = TEMPLATES.find((x) => x.id === 'agent-in-repo')
    const noRepo = await finished(runner.startRun({ flow: graph.cleanFlow(t.flow), deps: fakeDeps().deps }).runId)
    assert.equal(noRepo.status, 'failed')
    assert.match(noRepo.error, /Pick a repo/)
    assert.equal(noRepo.steps.find((s) => s.nodeId === 'out').status, 'skipped')

    const failing = await finished(runner.startRun({ flow: graph.cleanFlow({ ...t.flow, folder: 'demo' }), deps: fakeDeps({ fail: () => true }).deps }).runId)
    assert.equal(failing.status, 'failed')
    assert.match(failing.error, /boom/)

    assert.throws(() => runner.startRun({ flow: graph.cleanFlow({ nodes: [node('in', 'chat-input')] }), deps: fakeDeps().deps }), /Chat output/)
  })

  test('stop ends the run and its running turns', async () => {
    const t = TEMPLATES.find((x) => x.id === 'agent-in-repo')
    const { deps } = fakeDeps()
    let stopped = 0
    deps.stopTurn = () => stopped++
    deps.pollTurn = () => ({ status: 'running', events: [] })
    const { runId } = runner.startRun({ flow: graph.cleanFlow({ ...t.flow, folder: 'demo' }), deps })
    await new Promise((r) => setTimeout(r, 30))
    runner.stopRun(runId, deps)
    const r = runner.pollRun(runId)
    assert.equal(r.status, 'stopped')
    assert.equal(stopped, 1)
  })

  test('maps Catalog model names to Chat model ids', () => {
    assert.equal(runner.modelFor('claude', 'opus', { claude: [{ id: 'default' }, { id: 'claude-opus-5-5' }] }), 'claude-opus-5-5')
    assert.equal(runner.modelFor('claude', 'inherit', models), 'default')
    assert.equal(runner.modelFor('pi', 'something/odd', models), 'default')
  })
})
