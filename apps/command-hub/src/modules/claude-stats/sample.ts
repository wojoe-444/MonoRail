import { addDays, isoDate } from './transform'
import type { CcusageDailyRow, CcusageModelBreakdown, CcusageSessionRow, UsageReport } from './types'

/**
 * Fictional usage for the browser dev server and the "show sample data"
 * fallback. Deterministic (seeded) so screenshots are stable. Not real data.
 */

const MODELS = [
  { name: 'claude-opus-4-6', weight: 0.42, price: [5, 25, 6.25, 0.5] },
  { name: 'claude-sonnet-4-5-20250929', weight: 0.33, price: [3, 15, 3.75, 0.3] },
  { name: 'claude-haiku-4-5-20251001', weight: 0.12, price: [1, 5, 1.25, 0.1] },
  { name: 'claude-opus-4-1-20250805', weight: 0.08, price: [15, 75, 18.75, 1.5] },
  { name: 'claude-sonnet-4-20250514', weight: 0.05, price: [3, 15, 3.75, 0.3] },
] as const

const PROJECTS = [
  { name: 'C--Users-demo-Repos-atlas-api', weight: 0.34 },
  { name: 'C--Users-demo-Repos-garden-planner', weight: 0.24 },
  { name: 'C--Users-demo-Repos-MonoRail', weight: 0.2 },
  { name: 'C--Users-demo-Notes', weight: 0.12 },
  { name: 'C--Users-demo-Repos-pixel-forge', weight: 0.1 },
]

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function sampleReport(today = isoDate(new Date()), days = 120): UsageReport {
  const rand = rng(42)
  const projects: Record<string, CcusageDailyRow[]> = {}
  const sessions: CcusageSessionRow[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const dow = new Date(`${date}T12:00:00`).getDay()
    const weekend = dow === 0 || dow === 6
    const ramp = 0.5 + (1 - i / days) // usage grows over time
    for (const p of PROJECTS) {
      if (rand() > (weekend ? 0.3 : 0.8)) continue
      const breakdowns: CcusageModelBreakdown[] = []
      for (const m of MODELS) {
        // Older models fade out, newer ones fade in.
        const era = m.name.includes('4-1') || m.name.includes('sonnet-4-2') ? i / days : 1
        if (rand() > m.weight * 2.2 * era) continue
        const output = Math.round(40_000 * ramp * p.weight * (0.4 + rand() * 1.6) * 6)
        const input = Math.round(output * 0.05)
        const cacheCreate = Math.round(output * (2 + rand() * 4))
        const cacheRead = Math.round(output * (30 + rand() * 40))
        const [pi, po, pw, pr] = m.price
        const cost = (input * pi + output * po + cacheCreate * pw + cacheRead * pr) / 1_000_000
        breakdowns.push({
          modelName: m.name,
          inputTokens: input,
          outputTokens: output,
          cacheCreationTokens: cacheCreate,
          cacheReadTokens: cacheRead,
          cost,
        })
      }
      if (!breakdowns.length) continue
      const sum = (k: keyof CcusageModelBreakdown) => breakdowns.reduce((a, b) => a + (b[k] as number), 0)
      const row: CcusageDailyRow = {
        date,
        project: p.name,
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        cacheCreationTokens: sum('cacheCreationTokens'),
        cacheReadTokens: sum('cacheReadTokens'),
        totalTokens: sum('inputTokens') + sum('outputTokens') + sum('cacheCreationTokens') + sum('cacheReadTokens'),
        totalCost: sum('cost'),
        modelsUsed: breakdowns.map((b) => b.modelName),
        modelBreakdowns: breakdowns,
      }
      ;(projects[p.name] ??= []).push(row)
      sessions.push({
        ...row,
        sessionId: `sample-${date}-${p.name.split('-').pop()}`,
        projectPath: p.name,
        firstActivity: `${date}T09:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00.000Z`,
        lastActivity: `${date}T17:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00.000Z`,
      })
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'sample',
    daily: { projects },
    sessions: { sessions },
  }
}
