// Flows backend (Agents > Flows): agents built as a graph of steps.
//
// - Flows are JSON files in a local git repo in this module's data folder
//   (flows-store.cjs); every commit is a version the page can bring back.
// - Runs (flows-runner.cjs) start agent, subagent and model steps as Chat
//   turns through agent-chat.cjs's own startTurn, in Chat's allowed repos,
//   so Chat's permission rules and the spending limit apply to every step.
// - runs.json keeps metadata of the newest 200 runs (flow id, when, how long,
//   outcome, cost, step count). Never a prompt, a reply or a step's output.
//
// Nothing here runs on its own: no start-up work besides committing changes
// the last session left uncommitted.

const os = require('node:os')
const path = require('node:path')

const { folderOf } = require('../profiles/index.cjs')
const { readJson, writeJsonAtomic } = require('../cache/files.cjs')
const agentChat = require('./agent-chat.cjs')
const { allowedRepos } = require('./agent-chat-folders.cjs')
const options = require('./agent-chat-options.cjs')
const turnsApi = require('./agent-chat-turns.cjs')
const catalog = require('./agent-catalog.cjs')
const graph = require('./flows-graph.cjs')
const runner = require('./flows-runner.cjs')
const { createFlowsStore } = require('./flows-store.cjs')
const { TEMPLATES } = require('./flows-templates.cjs')

const RUNS_FILE = 'runs.json'
const RUNS_KEEP = 200

const stores = new Map()
function store(ctx) {
  let s = stores.get(ctx.dataDir)
  if (!s) stores.set(ctx.dataDir, (s = createFlowsStore(ctx.dataDir, { log: ctx.log })))
  return s
}

const chatDir = (ctx) => folderOf(ctx.layout ?? ctx.rootDir, 'modules/agent-chat')

/** Run history, metadata only. A damaged file starts over (it holds nothing the user wrote). */
async function readRuns(dataDir) {
  try {
    const raw = await readJson(path.join(dataDir, RUNS_FILE))
    return Array.isArray(raw?.runs) ? raw.runs : []
  } catch {
    return []
  }
}

let runsWrite = Promise.resolve()
function recordRun(dataDir, run) {
  const row = {
    id: run.id,
    flowId: run.flowId,
    startedAt: run.startedAt,
    ms: (run.endedAt ?? Date.now()) - run.startedAt,
    status: run.status,
    costUsd: Math.round(run.steps.reduce((n, s) => n + (s.costUsd ?? 0), 0) * 1e6) / 1e6,
    steps: run.steps.length,
  }
  runsWrite = runsWrite
    .then(async () => {
      const runs = [row, ...(await readRuns(dataDir)).filter((r) => r.id !== row.id)].slice(0, RUNS_KEEP)
      await writeJsonAtomic(path.join(dataDir, RUNS_FILE), { version: 1, runs })
    })
    .catch(() => {})
}

/** Choices the editor's dropdowns need: repos, subagents, models, which SDKs are ready. */
async function editorOptions(ctx) {
  const dir = chatDir(ctx)
  const [folders, subs] = await Promise.all([
    allowedRepos(dir, { home: os.homedir() }).catch(() => ({ repos: [] })),
    catalog.methods.list(ctx).catch(() => ({ subagents: [] })),
  ])
  const composer = await agentChat._internal.getComposer({ ...ctx, dataDir: dir }).catch(() => undefined)
  return {
    repos: folders.repos.map((r) => ({ name: r.name })),
    subagents: (subs.subagents ?? []).map((s) => ({ id: s.id, name: s.name, tool: s.tool, scope: s.scope, repo: s.repo, description: s.description })),
    models: { claude: options.CLAUDE_MODELS, pi: options.PI_MODELS },
    sdks: composer?.sdks ?? [],
    templates: TEMPLATES.map(({ flow: _f, ...t }) => t),
  }
}

async function runDeps(ctx) {
  const dir = chatDir(ctx)
  const repos = (await allowedRepos(dir, { home: os.homedir() })).repos
  let listed = false
  return {
    models: { claude: options.CLAUDE_MODELS, pi: options.PI_MODELS },
    resolveRepo: (name) => repos.find((r) => r.name === name) ?? repos.find((r) => r.path === name),
    startTurn: ({ sdk, repoPath, prompt, mode, model }) => agentChat._internal.startTurn({ dataDir: dir }, { repo: repoPath, sdk, prompt, mode, model, effort: 'default' }),
    pollTurn: (turnId) => turnsApi.pollTurn(turnId, 0),
    stopTurn: (turnId) => turnsApi.stopTurn(turnId),
    async getSubagent(id) {
      if (!id) throw new Error('Pick a subagent for this step.')
      // Catalog ids are handed out by its list; make sure it has run once.
      if (!listed && !String(id).startsWith('builtin:')) {
        await catalog.methods.list(ctx)
        listed = true
      }
      const s = await catalog.methods.get(ctx, { id })
      return { name: s.name, tool: s.tool, model: s.model, prompt: s.prompt }
    },
    onEnd: (run) => recordRun(ctx.dataDir, run),
  }
}

module.exports = {
  id: 'flows',

  start(ctx) {
    setTimeout(() => void store(ctx).flush().catch((e) => ctx.log('flush failed', e?.message)), 5_000).unref?.()
  },

  methods: {
    list: async (ctx) => {
      const [list, runs] = await Promise.all([store(ctx).list(), readRuns(ctx.dataDir)])
      const week = Date.now() - 7 * 24 * 60 * 60 * 1000
      return {
        ...list,
        flows: list.flows.map((f) => ({ ...f, runs7d: runs.filter((r) => r.flowId === f.id && r.startedAt >= week).length, running: !!runner.runningRunFor(f.id) })),
      }
    },
    get: (ctx, args) => store(ctx).get(args?.id),
    /** { template } | { copyOf } | { flow } (an imported draft). */
    async create(ctx, args = {}) {
      if (typeof args.copyOf === 'string') {
        const { flow } = await store(ctx).get(args.copyOf)
        return store(ctx).create({ ...flow, name: `${flow.name} (copy)` })
      }
      if (args.flow) return store(ctx).create(args.flow)
      const t = TEMPLATES.find((x) => x.id === (args.template ?? 'blank'))
      if (!t) throw new Error('Unknown template')
      return store(ctx).create({ ...t.flow, folder: typeof args.folder === 'string' ? args.folder : '' })
    },
    save: (ctx, args) => store(ctx).save(args?.id, args?.flow),
    flush: (ctx) => store(ctx).flush(),
    remove: (ctx, args) => store(ctx).remove(args?.id),
    history: (ctx, args) => store(ctx).history(args?.id),
    version: (ctx, args) => store(ctx).version(args?.id, args?.oid),
    options: (ctx) => editorOptions(ctx),
    components: async () => graph.COMPONENTS_FILE,

    /** Run the saved flow with the Playground's message. */
    async run(ctx, args = {}) {
      const { flow } = await store(ctx).get(args.id)
      const input = typeof args.input === 'string' ? args.input.slice(0, 100_000) : ''
      return runner.startRun({ flow, input, deps: await runDeps(ctx) })
    },
    pollRun: async (_ctx, args) => runner.pollRun(args?.runId),
    async stopRun(ctx, args) {
      runner.stopRun(args?.runId, await runDeps(ctx))
      return { stopped: true }
    },
    runningRun: async (_ctx, args) => ({ runId: runner.runningRunFor(args?.id) }),
    runs: async (ctx, args) => {
      const all = await readRuns(ctx.dataDir)
      return { runs: typeof args?.id === 'string' ? all.filter((r) => r.flowId === args.id) : all }
    },
  },
}

module.exports._internal = { recordRun, readRuns, RUNS_FILE }
