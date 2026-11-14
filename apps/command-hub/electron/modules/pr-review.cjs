// Opt-in local watcher. Existing PRs are skipped at enable/startup; while the
// app is running, newly opened PRs are reviewed once and submitted as COMMENT.
const path = require('node:path')
const fs = require('node:fs/promises')
const { writeJsonAtomic } = require('../cache/files.cjs')
const github = require('../connections/github-api.cjs')
const { getCredentials } = require('../connections/index.cjs')
const { collect } = require('./pr-review-context.cjs')
const agent = require('./pr-review-agent.cjs')
const { folderOf } = require('../profiles/index.cjs')
const templates = require('./builtin-template-store.cjs')
const templateDir = (ctx) => ctx.layout || ctx.rootDir ? folderOf(ctx.layout ?? ctx.rootDir, 'modules/agent-chat') : undefined

const STATE_FILE = 'reviewer.json'
const INTERVAL = 60_000
const MAX_RUNS = 100
const REPO = /^[A-Za-z0-9_.-]+[/][A-Za-z0-9_.-]+$/
const running = new Map()
const sessions = new Map()
const statePath = (ctx) => path.join(ctx.dataDir, STATE_FILE)

async function read(ctx) {
  let state
  try { state = JSON.parse(await fs.readFile(statePath(ctx), 'utf8')) } catch (e) {
    if (e.code === 'ENOENT') return { enabled: false, repository: '', model: '', runs: [] }
    throw new Error('The reviewer settings could not be read. They were not replaced.')
  }
  if (!Array.isArray(state.runs) || typeof state.enabled !== 'boolean') throw new Error('The reviewer settings could not be read. They were not replaced.')
  return state
}
const save = (ctx, state) => writeJsonAtomic(statePath(ctx), state)
const errorText = (e) => String(e?.message ?? e).slice(0, 500)

// Keep each profile's reads and writes serial, including UI changes and polls.
function serial(ctx, fn) {
  const previous = running.get(ctx.dataDir) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(fn)
  running.set(ctx.dataDir, next)
  return next.finally(() => { if (running.get(ctx.dataDir) === next) running.delete(ctx.dataDir) })
}

async function poll(ctx, deps = { github, getCredentials, collect, review: agent.review }, now = Date.now(), retryNumber) {
  return serial(ctx, async () => {
    const state = await read(ctx)
    if (!state.enabled) return state
    const session = sessions.get(ctx.dataDir)
    if (!session) { sessions.set(ctx.dataDir, now); return state }
    try {
      const gh = await deps.getCredentials('github')
      const result = await deps.github.list(gh, `repos/${state.repository}/pulls`, { state: 'open', sort: 'created', direction: 'desc' }, { maxPages: 3 })
      if (result.truncated) throw new Error('More than 300 open PRs; the watcher could not check them all.')
      const candidates = result.items.filter((pr) => Number.isInteger(pr.number) && (pr.number === retryNumber || (Date.parse(pr.created_at) >= Math.floor(session / 1000) * 1000 && !state.runs.some((r) => r.number === pr.number))))
      for (const pr of candidates.reverse()) {
        const run = { number: pr.number, title: String(pr.title ?? '').slice(0, 300), startedAt: Date.now(), status: 'running' }
        state.runs.unshift(run)
        state.runs = state.runs.slice(0, MAX_RUNS)
        await save(ctx, state)
        try {
          const context = await deps.collect({ credentials: gh, repository: state.repository, number: pr.number })
          if (!/^[a-f0-9]{40}$/i.test(context.head ?? '')) throw new Error('GitHub did not return the PR head revision.')
          const { apiKey } = await deps.getCredentials('openai')
          const dir = templateDir(ctx)
          const instructions = dir ? templates.read(dir, 'pr-reviewer')?.value.prompt : undefined
          const output = await deps.review({ apiKey, model: state.model || undefined, instructions, ...context })
          const current = await deps.github.request(gh, { path: `repos/${state.repository}/pulls/${pr.number}` })
          if (current.data?.state !== 'open' || current.data?.head?.sha !== context.head) throw new Error('The PR changed or closed during review; the review was not posted.')
          const marker = `<!-- monorail-pr-review:${context.head} -->`
          const reviews = await deps.github.list(gh, `repos/${state.repository}/pulls/${pr.number}/reviews`, {}, { maxPages: 3 })
          if (reviews.truncated) throw new Error('Could not check all existing reviews for duplicates.')
          if (!reviews.items.some((r) => typeof r.body === 'string' && r.body.includes(marker))) {
            await deps.github.request(gh, { method: 'POST', path: `repos/${state.repository}/pulls/${pr.number}/reviews`, body: { event: 'COMMENT', commit_id: context.head, body: `${output}\n\n${marker}` } })
          }
          run.status = 'posted'
          run.head = context.head
        } catch (e) { run.status = 'failed'; run.error = errorText(e) }
        run.endedAt = Date.now()
        await save(ctx, state)
      }
      state.lastCheckedAt = now
      delete state.error
    } catch (e) { state.error = errorText(e) }
    await save(ctx, state)
    return state
  })
}

module.exports = {
  id: 'pr-review',
  start(ctx) {
    sessions.set(ctx.dataDir, Date.now())
    const tick = () => void poll(ctx).catch((e) => ctx.log('PR review watcher failed', errorText(e)))
    setTimeout(tick, 10_000).unref?.()
    setInterval(tick, INTERVAL).unref?.()
  },
  methods: {
    get: (ctx) => read(ctx),
    template: async (ctx) => {
      const override = templates.read(templateDir(ctx), 'pr-reviewer')
      return { prompt: override?.value.prompt ?? agent._internal.INSTRUCTIONS, updatedAt: override?.updatedAt ?? 0, customized: !!override }
    },
    saveTemplate: async (ctx, args) => {
      if (typeof args?.prompt !== 'string' || !args.prompt.trim() || args.prompt.length > 200_000) throw new Error('Enter instructions up to 200,000 characters.')
      await templates.write(templateDir(ctx), 'pr-reviewer', { prompt: args.prompt }, args.updatedAt)
      return module.exports.methods.template(ctx)
    },
    resetTemplate: async (ctx, args) => { await templates.reset(templateDir(ctx), 'pr-reviewer', args?.updatedAt); return module.exports.methods.template(ctx) },
    source: async () => Promise.all(['pr-review-agent.cjs', 'pr-review-context.cjs', 'pr-review.cjs'].map(async (name) => ({ name: `electron/modules/${name}`, text: await fs.readFile(path.join(__dirname, name), 'utf8') }))),
    configure: (ctx, args = {}) => serial(ctx, async () => {
      if (!REPO.test(args.repository ?? '') || args.repository.split('/').some((s) => s === '.' || s === '..')) throw new Error('Enter a GitHub repository as owner/name.')
      if (typeof args.model !== 'string' || args.model.length > 128 || (args.model && !/^[\w.-]+$/.test(args.model))) throw new Error('Enter a valid OpenAI model ID, or leave it blank.')
      // Fail before enabling if either connection is missing.
      await getCredentials('github')
      const { apiKey } = await getCredentials('openai')
      if (!apiKey) throw new Error('Set up an OpenAI API key in Connections.')
      const old = await read(ctx)
      const state = { enabled: true, repository: args.repository, model: args.model, runs: old.repository?.toLowerCase() === args.repository.toLowerCase() ? old.runs : [] }
      sessions.set(ctx.dataDir, Date.now())
      await save(ctx, state)
      return state
    }),
    disable: (ctx) => serial(ctx, async () => { const state = await read(ctx); state.enabled = false; await save(ctx, state); return state }),
    check: (ctx) => poll(ctx),
    retry: async (ctx, args) => {
      if (!Number.isInteger(args?.number) || args.number < 1) throw new Error('Invalid pull request number.')
      const state = await read(ctx)
      if (!state.enabled || !state.runs.some((r) => r.number === args.number && ['failed', 'running'].includes(r.status))) throw new Error('Only a failed or interrupted review can be retried.')
      return poll(ctx, undefined, Date.now(), args.number)
    },
  },
  _internal: { poll, sessions },
}
