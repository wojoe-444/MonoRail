import { expect, test } from 'vitest'
import { contextStep, findPrice, isAboveTier, normalizeModelId, priceTokens, type PriceRow } from './pricing'

test('strips provider and build identifiers and uses the longest matching price key', () => {
  expect(normalizeModelId('Provider/Anthropic.Claude-Sonnet-4-5-20250929[1M]')).toBe('claude-sonnet-4-5')
  expect(findPrice('models/gemini-2.5-flash-lite-preview-01')?.key).toBe('gemini-2.5-flash-lite')
  expect(findPrice('claude-sonnet-4unrecognized')).toBeUndefined()
})

test('charges the higher rates only above the tier and prices each cache bucket', () => {
  const row: PriceRow = {
    key: 'example',
    input: 2,
    output: 8,
    cacheWrite5m: 3,
    cacheWrite1h: 4,
    cacheRead: 1,
    tier: { above: 100_000, input: 4, output: 16, cacheWrite5m: 6, cacheWrite1h: 8, cacheRead: 2 },
  }
  const mix = { input: 50_000, output: 10_000, cw5m: 20_000, cw1h: 10_000, cacheRead: 20_000 }
  const atTier = contextStep(100_000)
  const aboveTier = contextStep(100_001)

  expect(contextStep(0)).toBe(0)
  expect([atTier, aboveTier]).toEqual([1, 2])
  expect(isAboveTier(row, atTier)).toBe(false)
  expect(isAboveTier(row, aboveTier)).toBe(true)
  expect(priceTokens(row, atTier, mix)).toEqual({
    input: expect.closeTo(0.1, 8), output: expect.closeTo(0.08, 8),
    cacheWrite: expect.closeTo(0.1, 8), cacheRead: expect.closeTo(0.02, 8),
  })
  expect(priceTokens(row, aboveTier, { ...mix, input: 50_001 })).toEqual({
    input: expect.closeTo(0.200004, 8), output: expect.closeTo(0.16, 8),
    cacheWrite: expect.closeTo(0.2, 8), cacheRead: expect.closeTo(0.04, 8),
  })
})
