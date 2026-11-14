const assert = require('node:assert/strict')
const test = require('node:test')
const { collect, _internal } = require('./pr-review-context.cjs')

test('collects root and nested guidance from the base revision', async () => {
  const sha = 'a'.repeat(40)
  const calls = []
  const api = {
    async request(_credentials, request) {
      calls.push(request)
      if (request.path.endsWith('/pulls/7')) return { data: { title: 'Change', base: { sha }, head: { sha: 'b'.repeat(40) } } }
      if (request.path.endsWith('/AGENTS.md')) return { data: { encoding: 'base64', content: Buffer.from('Review rules').toString('base64') } }
      throw Object.assign(new Error('Not found'), { status: 404 })
    },
    async list() { return { items: [{ filename: 'src/lib/a.js', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }], truncated: false } },
  }
  const context = await collect({ credentials: {}, repository: 'example/repo', number: 7 }, api)
  assert.deepEqual(context.guidance.map((g) => g.path), ['AGENTS.md', 'src/AGENTS.md', 'src/lib/AGENTS.md'])
  assert.ok(calls.slice(1).every((c) => c.query.ref === sha))
  assert.match(context.diff, /\+new/)
})

test('does not silently review incomplete patches or unsafe paths', async () => {
  assert.throws(() => _internal.guidancePaths([{ filename: '../outside' }]), /safely/)
  const api = { request: async () => ({ data: { base: { sha: 'a'.repeat(40) } } }), list: async () => ({ items: [{ filename: 'a.js' }], truncated: false }) }
  await assert.rejects(collect({ credentials: {}, repository: 'example/repo', number: 1 }, api), /complete textual patch/)
})
