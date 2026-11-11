// Price table helpers for Claude Stats. The table itself is
// claude-stats-prices.json, shared with the renderer (src/modules/claude-stats/pricing.ts).

const table = require('./claude-stats-prices.json')

const STEP = 50_000

/** "anthropic/claude-opus-4-1-20250805[1m]" -> "claude-opus-4-1". */
function normalizeModelId(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/^.*\//, '')
    .replace(/^(anthropic|google|models)[.:]/, '')
    .replace(/\[.*\]$/, '')
    .replace(/@.*$/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-v\d+(:\d+)?$/, '')
}

const keys = Object.keys(table.models).sort((a, b) => b.length - a.length)

/** Price row for a model id, or undefined. Exact match first, then the longest row the id starts with. */
function findPrice(rawModel) {
  const id = normalizeModelId(rawModel)
  if (table.models[id]) return { key: id, ...withDefaults(table.models[id]) }
  const key = keys.find((k) => id.startsWith(k) && /[-.]/.test(id[k.length] ?? ''))
  return key ? { key, ...withDefaults(table.models[key]) } : undefined
}

function withDefaults(row) {
  const base = fill(row)
  return row.tier ? { ...base, tier: { above: row.tier.above, ...fill({ ...row, ...row.tier }) } } : base
}

function fill(r) {
  return {
    input: r.input,
    output: r.output,
    cacheWrite5m: r.cacheWrite5m ?? r.input * 1.25,
    cacheWrite1h: r.cacheWrite1h ?? r.input * 2,
    cacheRead: r.cacheRead ?? r.input * 0.1,
  }
}

/** Context step (0-based) for a prompt size: step k holds prompts in (k*50K, (k+1)*50K]. */
function contextStep(promptTokens) {
  return promptTokens > 0 ? Math.floor((promptTokens - 1) / STEP) : 0
}

module.exports = { table, STEP, normalizeModelId, findPrice, contextStep }
