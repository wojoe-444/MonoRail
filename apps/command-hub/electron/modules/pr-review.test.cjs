const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { _internal } = require('./pr-review.cjs')
const { methods } = require('./pr-review.cjs')

async function fixture({ changed = false, priorReview = false } = {}) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pr-review-'))
  await fs.writeFile(path.join(dataDir, 'reviewer.json'), JSON.stringify({ enabled: true, repository: 'demo/repo', model: '', runs: [] }))
  const now = Date.now()
  _internal.sessions.set(dataDir, now - 5000)
  const head = 'b'.repeat(40)
  const posts = []
  const deps = {
    async getCredentials(kind) { return kind === 'github' ? { via: 'gh' } : { apiKey: 'fake' } },
    async collect() { return { repository: 'demo/repo', number: 1, head, diff: '+change', guidance: [] } },
    async review() { return 'Found a bug.' },
    github: {
      async list(_creds, endpoint) {
        if (endpoint.endsWith('/reviews')) return { items: priorReview ? [{ body: `<!-- monorail-pr-review:${head} -->` }] : [], truncated: false }
        return { items: [{ number: 1, title: 'A PR', created_at: new Date(now).toISOString() }], truncated: false }
      },
      async request(_creds, args) {
        if (args.method === 'POST') { posts.push(args); return { data: {} } }
        return { data: { state: 'open', head: { sha: changed ? 'c'.repeat(40) : head } } }
      },
    },
  }
  return { ctx: { dataDir }, deps, now, posts }
}

test('posts one comment review for a new PR and records the outcome', async () => {
  const { ctx, deps, now, posts } = await fixture()
  const state = await _internal.poll(ctx, deps, now)
  assert.equal(state.runs[0].status, 'posted')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].body.event, 'COMMENT')
  await _internal.poll(ctx, deps, now + 60_000)
  assert.equal(posts.length, 1)
})

test('does not post for a changed head or repeat an already posted review', async () => {
  const changed = await fixture({ changed: true })
  assert.equal((await _internal.poll(changed.ctx, changed.deps, changed.now)).runs[0].status, 'failed')
  assert.equal(changed.posts.length, 0)
  const prior = await fixture({ priorReview: true })
  assert.equal((await _internal.poll(prior.ctx, prior.deps, prior.now)).runs[0].status, 'posted')
  assert.equal(prior.posts.length, 0)
})

test('reviewer source exposes its fixed implementation files', async () => {
  const files = await methods.source()
  assert.deepEqual(files.map((f) => f.name), ['electron/modules/pr-review-agent.cjs', 'electron/modules/pr-review-context.cjs', 'electron/modules/pr-review.cjs'])
  assert.match(files[0].text, /new sdk\.Agent/)
})

test('reviewer uses edited template instructions and reset restores the default', async () => {
  const { ctx, deps, now } = await fixture()
  ctx.rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-profile-'))
  const original = await methods.template(ctx)
  const edited = await methods.saveTemplate(ctx, { prompt: 'Inspect compatibility.', updatedAt: original.updatedAt })
  assert.equal(edited.customized, true)
  let instructions
  deps.review = async (args) => { instructions = args.instructions; return 'Done.' }
  await _internal.poll(ctx, deps, now)
  assert.equal(instructions, 'Inspect compatibility.')
  const restored = await methods.resetTemplate(ctx, { updatedAt: edited.updatedAt })
  assert.equal(restored.prompt, original.prompt)
  assert.equal(restored.customized, false)
})
