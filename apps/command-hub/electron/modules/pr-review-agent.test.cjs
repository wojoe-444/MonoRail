const assert = require('node:assert/strict')
const test = require('node:test')
const { review, _internal } = require('./pr-review-agent.cjs')

test('reviewer sends bounded context to a tool-free agent and disables tracing', async () => {
  const captured = {}
  class OpenAIProvider {
    constructor(options) { captured.provider = options }
    async close() { captured.closed = true }
  }
  class Agent { constructor(options) { captured.agent = options } }
  class Runner {
    constructor(options) { captured.runner = options }
    async run(_agent, input) { captured.input = JSON.parse(input); return { finalOutput: 'No findings.' } }
  }
  const output = await review({ apiKey: 'test-key', model: 'test-model', repository: 'example/repo', number: 3, diff: '+changed', guidance: [{ path: 'AGENTS.md', text: 'Review carefully.' }] }, { OpenAIProvider, Agent, Runner })
  assert.equal(output, 'No findings.')
  assert.equal(captured.input.guidance[0].path, 'AGENTS.md')
  assert.equal(captured.runner.tracingDisabled, true)
  assert.equal(captured.agent.tools, undefined)
  assert.match(captured.agent.instructions, /untrusted data/)
  assert.equal(captured.closed, true)
})

test('rejects missing and oversized PR context before a model call', () => {
  assert.throws(() => _internal.reviewInput({ repository: 'example/repo', number: 1, diff: '' }), /non-empty diff/)
  assert.throws(() => _internal.reviewInput({ repository: 'example/repo', number: 1, diff: 'x'.repeat(_internal.MAX_CONTEXT) }), /too large/)
})
