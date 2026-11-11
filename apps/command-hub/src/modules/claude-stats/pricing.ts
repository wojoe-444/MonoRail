// Renderer side of the price table (electron/modules/claude-stats-prices.json,
// shared with the backend's claude-stats-prices.cjs and its tests).
import priceTable from '../../../electron/modules/claude-stats-prices.json'

export const STEP = 50_000

export interface Prices {
  input: number
  output: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
}

export interface PriceRow extends Prices {
  key: string
  tier?: Prices & { above: number }
}

interface RawRow {
  input: number
  output: number
  cacheWrite5m?: number
  cacheWrite1h?: number
  cacheRead?: number
  tier?: Omit<RawRow, 'tier'> & { above: number }
}

const models = priceTable.models as Record<string, RawRow>
const keys = Object.keys(models).sort((a, b) => b.length - a.length)

export function normalizeModelId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^.*\//, '')
    .replace(/^(anthropic|google|models)[.:]/, '')
    .replace(/\[.*\]$/, '')
    .replace(/@.*$/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-v\d+(:\d+)?$/, '')
}

function fill(r: Omit<RawRow, 'tier'>): Prices {
  return {
    input: r.input,
    output: r.output,
    cacheWrite5m: r.cacheWrite5m ?? r.input * 1.25,
    cacheWrite1h: r.cacheWrite1h ?? r.input * 2,
    cacheRead: r.cacheRead ?? r.input * 0.1,
  }
}

const cache = new Map<string, PriceRow | undefined>()

/** Price row for a model id: exact match, else the longest row the id starts with. */
export function findPrice(rawModel: string): PriceRow | undefined {
  if (cache.has(rawModel)) return cache.get(rawModel)
  const id = normalizeModelId(rawModel)
  const key = models[id] ? id : keys.find((k) => id.startsWith(k) && /[-.]/.test(id[k.length] ?? ''))
  let row: PriceRow | undefined
  if (key) {
    const r = models[key]
    row = { key, ...fill(r) }
    if (r.tier) row.tier = { above: r.tier.above, ...fill({ ...r, ...r.tier }) }
  }
  cache.set(rawModel, row)
  return row
}

/** Context step (0-based): step k holds prompts in (k*50K, (k+1)*50K]. */
export function contextStep(promptTokens: number): number {
  return promptTokens > 0 ? Math.floor((promptTokens - 1) / STEP) : 0
}

export function stepLabel(step: number): string {
  return `${step * 50}K–${(step + 1) * 50}K`
}

/** Whether requests in this context step are above the model's price-tier threshold. */
export function isAboveTier(row: PriceRow | undefined, step: number): boolean {
  return !!row?.tier && (step + 1) * STEP > row.tier.above
}

export interface CostParts {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

/** List-price cost of a token mix in one context step. */
export function priceTokens(
  row: PriceRow,
  step: number,
  t: { input: number; output: number; cw5m: number; cw1h: number; cacheRead: number },
): CostParts {
  const p = isAboveTier(row, step) ? row.tier! : row
  const m = 1 / 1_000_000
  return {
    input: t.input * p.input * m,
    output: t.output * p.output * m,
    cacheWrite: (t.cw5m * p.cacheWrite5m + t.cw1h * p.cacheWrite1h) * m,
    cacheRead: t.cacheRead * p.cacheRead * m,
  }
}

export function sumParts(p: CostParts): number {
  return p.input + p.output + p.cacheWrite + p.cacheRead
}
