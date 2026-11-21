import { expect, test } from 'vitest'
import { buildFacts, modelSeriesKey } from './facts'
import type { CcusageDailyRow, ScanRequestRow, UsageReport } from './types'

const model = 'claude-sonnet-4-5'
const date = '2026-01-10'
const request: ScanRequestRow = {
  date,
  source: 'claude-code',
  project: '-home-demo-example',
  sessionId: 'claude-session',
  model: `${model}-20250929`,
  role: 'driver',
  step: 0,
  n: 1,
  input: 0,
  output: 1_000,
  cw5m: 0,
  cw1h: 0,
  cacheRead: 0,
  thinking: 250,
  logged: null,
}
const daily: CcusageDailyRow = {
  date,
  inputTokens: 5_000,
  outputTokens: 3_000,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 8_000,
  totalCost: 3,
  modelsUsed: [model],
  modelBreakdowns: [{
    modelName: model,
    inputTokens: 5_000,
    outputTokens: 3_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    cost: 3,
  }],
}

test('allocates ccusage spend for the day and model by each row’s list-price share', () => {
  const first = `${date}T09:00:00Z`
  const last = `${date}T10:00:00Z`
  const report: UsageReport = {
    version: 1,
    source: 'ccusage',
    daily: { projects: { example: [daily] } },
    sessions: { sessions: [] },
    scan: {
      sources: [{ id: 'claude-code', label: 'Claude Code', found: true }],
      requests: [{ ...request, input: 5_000 }, { ...request, role: 'subagent', n: 2, output: 2_000, thinking: 500 }],
      sessions: [{ source: request.source, sessionId: request.sessionId, project: request.project, first, last }],
      turns: [],
      compactions: [],
    },
  }

  const { facts, sessions, unpriced } = buildFacts(report)
  expect(facts).toHaveLength(2)
  expect(facts[0].parts?.input).toBeCloseTo(0.75)
  expect(facts[0].parts?.output).toBeCloseTo(0.75)
  expect(facts[1].cost).toBeCloseTo(1.5)
  expect(facts[0].partsEstimated).toBe(true)
  expect(modelSeriesKey(facts[0], true)).toBe('Sonnet 4.5 ≤200K')
  expect(sessions).toHaveLength(1)
  expect(sessions[0]).toMatchObject({
    project: 'example', firstActivity: first, lastActivity: last, models: ['Sonnet 4.5'],
    outputTokens: 3_000, totalTokens: 8_000, thinkingTokens: 750,
  })
  expect(sessions[0].cost).toBeCloseTo(3)
  expect(unpriced).toEqual([])
})

test('uses logged pi cost only when it covers every request in the row', () => {
  const logged = { n: 2, input: 1, output: 2, cacheWrite: 3, cacheRead: 4 }
  const pi = { ...request, source: 'pi', sessionId: 'pi-session', model, n: 2, logged } as const
  const { facts, unpriced } = buildFacts({
    version: 1,
    source: 'ccusage',
    daily: {},
    sessions: { sessions: [] },
    scan: {
      sources: [],
      requests: [pi, { ...pi, n: 3 }, { ...pi, model: 'example-unpriced-model', logged: null }],
      sessions: [],
      turns: [],
      compactions: [],
    },
  })

  expect(facts[0]).toMatchObject({ partsEstimated: false, cost: 10, parts: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 } })
  expect(facts[1].partsEstimated).toBe(true)
  expect(facts[1].cost).toBeCloseTo(0.015, 6)
  expect(facts[2]).toMatchObject({ priced: false, cost: 0 })
  expect(unpriced).toEqual(['example-unpriced-model'])
})

test('falls back to daily ccusage totals in older reports without a scan', () => {
  const { facts, sources } = buildFacts({
    version: 1,
    source: 'ccusage',
    daily: { daily: [daily] },
    sessions: { sessions: [] },
  })

  expect(facts).toHaveLength(1)
  expect(facts[0]).toMatchObject({ date, model: 'Sonnet 4.5', cost: 3, outputTokens: 3_000 })
  expect(facts[0].requests).toBeUndefined()
  expect(sources).toEqual([{ id: 'claude-code', label: 'Claude Code', found: true }])
})
