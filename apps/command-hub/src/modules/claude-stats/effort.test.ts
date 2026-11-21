import { expect, test } from 'vitest'
import { costPerCall, effortKey, effortOrder, effortRows, NOT_LOGGED, thinkingShare } from './effort'
import type { UsageFact } from './types'

test('orders present effort levels by rank, then unknown levels, then missing effort', () => {
  const facts = [{}, { effort: 'zeta' }, { effort: 'high' }, { effort: 'low' }, { effort: 'alpha' }, { effort: 'high' }]

  expect(effortOrder(facts)).toEqual(['low', 'high', 'alpha', 'zeta', NOT_LOGGED])
})

test('keeps daily-only facts out of per-call cost and thinking-share denominators', () => {
  const fact: UsageFact = {
    date: '2026-01-10',
    project: 'example',
    model: 'Sonnet 4.5',
    source: 'claude-code',
    cost: 4,
    inputTokens: 50,
    outputTokens: 100,
    cacheCreationTokens: 10,
    cacheReadTokens: 20,
  }
  const scanned = { ...fact, requests: 2, thinkingTokens: 25, thinkingEstimated: 5 }
  const row = effortRows([scanned, { ...fact, cost: 10, outputTokens: 900 }], effortKey).get(NOT_LOGGED)

  expect(row).toMatchObject({ cost: 14, outputTokens: 1_000, cacheTokens: 60, calls: 2, thinkingEstimated: 5 })
  expect(costPerCall(row)).toBe(2)
  expect(thinkingShare(row)).toBe(0.25)

  const legacyRow = effortRows([fact], effortKey).get(NOT_LOGGED)
  expect(costPerCall(legacyRow)).toBeUndefined()
  expect(thinkingShare(legacyRow)).toBeUndefined()
})
