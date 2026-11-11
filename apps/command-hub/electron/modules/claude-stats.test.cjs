// Tests for the Claude Stats scanner and price table. Run with `npm test`.

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { scanAll } = require('./claude-stats-scan.cjs')
const { findPrice, contextStep, normalizeModelId, table } = require('./claude-stats-prices.cjs')

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-stats-'))
}

let n = 0
function claudeLine(ts, model, extra = {}) {
  n++
  return JSON.stringify({
    type: 'assistant',
    timestamp: ts,
    sessionId: 's1',
    isSidechain: false,
    requestId: `req${n}`,
    message: {
      id: `msg${n}`,
      model,
      usage: { input_tokens: 10, output_tokens: 1000, cache_creation_input_tokens: 200, cache_read_input_tokens: 60000, cache_creation: { ephemeral_1h_input_tokens: 50 } },
    },
    ...extra,
  })
}

/** Fictional logs for all three sources. */
function writeFixtures(home) {
  const proj = path.join(home, '.claude', 'projects', '-home-demo-app')
  fs.mkdirSync(path.join(proj, 's1', 'subagents'), { recursive: true })
  const lines = [
    claudeLine('2026-11-01T10:00:00Z', 'claude-sonnet-4-5-20250929'),
    claudeLine('2026-11-01T10:05:00Z', 'claude-sonnet-4-5-20250929'),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: '2026-11-01T10:06:00Z', sessionId: 's1', compactMetadata: { trigger: 'manual', preTokens: 160000 } }),
    claudeLine('2026-11-01T10:07:00Z', 'claude-sonnet-4-5-20250929'),
  ]
  // A duplicate streaming line (same message id + request id) must count once.
  lines.push(lines[0])
  fs.writeFileSync(path.join(proj, 's1.jsonl'), lines.join('\n') + '\n')
  fs.writeFileSync(
    path.join(proj, 's1', 'subagents', 'agent-a.jsonl'),
    claudeLine('2026-11-01T10:06:30Z', 'claude-haiku-4-5-20251001', { isSidechain: true }) + '\n',
  )
  // A compaction before any request: model unknown, still counted.
  fs.writeFileSync(
    path.join(proj, 's2.jsonl'),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: '2026-11-02T09:00:00Z', sessionId: 's2', compactMetadata: { trigger: 'auto', preTokens: 90000 } }) + '\n',
  )

  const gem = path.join(home, '.gemini', 'tmp', 'abc123', 'chats')
  fs.mkdirSync(gem, { recursive: true })
  fs.writeFileSync(
    path.join(gem, 'session-1.json'),
    JSON.stringify({
      sessionId: 'g1',
      messages: [
        { type: 'user', timestamp: '2026-11-03T08:00:00Z', content: 'hi' },
        { type: 'gemini', timestamp: '2026-11-03T08:00:05Z', model: 'gemini-2.5-pro', tokens: { input: 5000, output: 300, cached: 4000, thoughts: 200, total: 5500 } },
      ],
    }),
  )

  const pi = path.join(home, '.pi', 'agent', 'sessions', '--home-demo-app--')
  fs.mkdirSync(pi, { recursive: true })
  fs.writeFileSync(
    path.join(pi, '2026-11-04_p1.jsonl'),
    [
      JSON.stringify({ type: 'session', id: 'p1', timestamp: '2026-11-04T07:00:00Z', cwd: '/home/demo/app' }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-11-04T07:00:10Z',
        message: { role: 'assistant', model: 'claude-sonnet-4-5', usage: { input: 100, output: 2000, cacheRead: 0, cacheWrite: 0, cost: { input: 0.0003, output: 0.03, cacheRead: 0, cacheWrite: 0, total: 0.0303 } } },
      }),
    ].join('\n') + '\n',
  )
}

test('scanner reads all three sources and reports missing ones as not found', async () => {
  const home = tmpHome()
  const empty = await scanAll({ env: {}, home })
  assert.deepEqual(
    empty.sources.map((s) => [s.id, s.found]),
    [
      ['claude-code', false],
      ['gemini-cli', false],
      ['pi', false],
    ],
  )

  writeFixtures(home)
  const r = await scanAll({ env: {}, home })
  assert.ok(r.sources.every((s) => s.found))

  const claude = r.requests.filter((x) => x.source === 'claude-code')
  const driverN = claude.filter((x) => x.role === 'driver').reduce((a, x) => a + x.n, 0)
  assert.equal(driverN, 3, 'duplicate streaming line is counted once')
  const sub = claude.find((x) => x.role === 'subagent')
  assert.equal(sub.model, 'claude-haiku-4-5-20251001')
  assert.equal(sub.cw1h, 50)
  assert.equal(sub.cw5m, 150)
  assert.equal(claude[0].step, contextStep(10 + 200 + 60000))

  const gem = r.requests.find((x) => x.source === 'gemini-cli')
  assert.equal(gem.input, 1000)
  assert.equal(gem.cacheRead, 4000)
  assert.equal(gem.output, 500)

  const pi = r.requests.find((x) => x.source === 'pi')
  assert.equal(pi.project, 'app')
  assert.ok(Math.abs(pi.logged.output - 0.03) < 1e-9)
})

test('compactions are counted with the model running before them, unknown when none', async () => {
  const home = tmpHome()
  writeFixtures(home)
  const r = await scanAll({ env: {}, home })
  const c = r.compactions.filter((x) => x.source === 'claude-code')
  assert.equal(c.length, 2)
  const manual = c.find((x) => x.trigger === 'manual')
  assert.equal(manual.model, 'claude-sonnet-4-5-20250929')
  assert.equal(manual.preTokens, 160000)
  const unknown = c.find((x) => x.trigger === 'auto')
  assert.equal(unknown.model, null)
})

test('turns restart after a compaction', async () => {
  const home = tmpHome()
  writeFixtures(home)
  const r = await scanAll({ env: {}, home })
  const t = r.turns.filter((x) => x.source === 'claude-code')
  assert.deepEqual(
    t.map((x) => [x.kind, x.turn]).sort(),
    [
      ['compaction', 1],
      ['start', 1],
      ['start', 2],
    ],
  )
})

test('price lookup strips dates and provider prefixes and applies tiers', () => {
  assert.equal(normalizeModelId('anthropic/claude-opus-4-1-20250805[1m]'), 'claude-opus-4-1')
  assert.equal(findPrice('claude-opus-4-1-20250805').key, 'claude-opus-4-1')
  assert.equal(findPrice('claude-opus-4-20250514').key, 'claude-opus-4')
  assert.equal(findPrice('gemini-2.5-pro-preview-06-05').key, 'gemini-2.5-pro')
  assert.equal(findPrice('gemini-2.5-flash-lite').key, 'gemini-2.5-flash-lite')
  assert.equal(findPrice('made-up-model'), undefined)
  const haiku = findPrice('claude-haiku-5-5')
  assert.equal(haiku.tier.above, 100000)
  assert.equal(haiku.cacheRead, 0.01)
  for (const [k, row] of Object.entries(table.models)) {
    if (row.tier) assert.equal(row.tier.above % 50000, 0, `${k} tier threshold must be a multiple of the 50K context step`)
  }
  assert.equal(contextStep(100000), 1)
  assert.equal(contextStep(100001), 2)
})

test('every model in this machine\'s logs has a price row', async () => {
  const r = await scanAll()
  const models = [...new Set(r.requests.map((x) => x.model))]
  const missing = models.filter((m) => !findPrice(m))
  assert.deepEqual(missing, [], `Add these models to electron/modules/claude-stats-prices.json: ${missing.join(', ')}`)
})

test('summary: last 30 days of cost, ccusage for Claude Code, logged pi cost, top models', () => {
  const { summarize } = require('./claude-stats.cjs')
  const now = new Date(2026, 10, 11, 12)
  const report = {
    generatedAt: now.toISOString(),
    daily: {
      projects: {
        demo: [
          { date: '2026-11-10', modelBreakdowns: [{ modelName: 'claude-opus-4-6', cost: 4 }] },
          { date: '2026-09-01', modelBreakdowns: [{ modelName: 'claude-opus-4-6', cost: 100 }] },
        ],
      },
    },
    scan: {
      requests: [
        // Claude Code rows are covered by ccusage and must not be counted twice.
        { date: '2026-11-10', source: 'claude-code', model: 'claude-opus-4-6', step: 0, n: 1, input: 1e6, output: 0, cw5m: 0, cw1h: 0, cacheRead: 0, logged: null },
        { date: '2026-11-11', source: 'pi', model: 'claude-sonnet-4-5', step: 0, n: 2, input: 0, output: 0, cw5m: 0, cw1h: 0, cacheRead: 0, logged: { input: 0.5, output: 1, cacheWrite: 0, cacheRead: 0, n: 2 } },
        { date: '2026-11-11', source: 'gemini-cli', model: 'gemini-2.5-flash', step: 0, n: 1, input: 0, output: 1e6, cw5m: 0, cw1h: 0, cacheRead: 0, logged: null },
      ],
    },
  }
  const s = summarize(report, now)
  assert.equal(s.days.length, 30)
  assert.equal(s.days.at(-1).date, '2026-11-11')
  assert.equal(s.days.find((d) => d.date === '2026-11-10').cost, 4)
  const flash = findPrice('gemini-2.5-flash').output
  assert.ok(Math.abs(s.total - (4 + 1.5 + flash)) < 1e-9)
  assert.deepEqual(s.topModels.map((m) => m.source).sort(), ['claude-code', 'gemini-cli', 'pi'])
  assert.ok(s.topModels.every((m, k) => k === 0 || s.topModels[k - 1].cost >= m.cost))
  assert.equal(s.topModels.find((m) => m.source === 'claude-code').cost, 4)
})

