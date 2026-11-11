import { contextStep } from './pricing'
import { addDays, isoDate } from './transform'
import type { RawPhase, ScanCompaction, ScanRequestRow, ScanSession, ScanTurnRow, SourceId, UsageReport } from './types'

/**
 * Fictional usage for the browser dev server and the "show sample data"
 * fallback, shaped like the backend's log scan. Deterministic (seeded) so
 * screenshots are stable. Not real data.
 */

interface Driver {
  source: SourceId
  model: string
  weight: number
  /** Days ago the model appears / disappears. */
  from: number
  to: number
  subagent?: string
}

const DRIVERS: Driver[] = [
  { source: 'claude-code', model: 'claude-opus-4-6', weight: 0.34, from: 120, to: 0, subagent: 'claude-haiku-4-5-20251001' },
  { source: 'claude-code', model: 'claude-sonnet-4-5-20250929', weight: 0.26, from: 120, to: 0, subagent: 'claude-haiku-4-5-20251001' },
  { source: 'claude-code', model: 'claude-opus-4-1-20250805', weight: 0.08, from: 120, to: 70 },
  { source: 'claude-code', model: 'claude-haiku-5-5', weight: 0.1, from: 45, to: 0 },
  { source: 'gemini-cli', model: 'gemini-2.5-pro', weight: 0.12, from: 100, to: 0 },
  { source: 'pi', model: 'claude-sonnet-4-5', weight: 0.1, from: 80, to: 0 },
]

const PROJECTS = ['C--Users-demo-Repos-atlas-api', 'C--Users-demo-Repos-garden-planner', 'C--Users-demo-Repos-MonoRail', 'C--Users-demo-Notes']

const PI_PRICE = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export function sampleReport(today = isoDate(new Date()), days = 120): UsageReport {
  const rand = rng(42)
  const reqRows = new Map<string, ScanRequestRow>()
  const turnRows = new Map<string, ScanTurnRow>()
  const compactions: ScanCompaction[] = []
  const sessions: ScanSession[] = []
  const phases: RawPhase[] = []
  let sid = 0

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay())
    const ramp = 0.6 + (1 - i / days)
    for (const d of DRIVERS) {
      if (i > d.from || i < d.to) continue
      const sessionsToday = Math.round(d.weight * 8 * ramp * (weekend ? 0.3 : 1) * (0.5 + rand()))
      for (let k = 0; k < sessionsToday; k++) {
        const sessionId = `sample-${++sid}`
        const project = d.source === 'gemini-cli' ? 'gemini:3f9a2c1b7d4e' : PROJECTS[Math.floor(rand() * PROJECTS.length)]
        const turns = 8 + Math.floor(rand() * 60)
        let prompt = 18_000 + rand() * 12_000
        let kind: 'start' | 'compaction' = 'start'
        let turn = 0
        const start = Date.parse(`${date}T09:00:00`) + Math.floor(rand() * 8) * 3_600_000
        const phaseFacts = new Map<string, RawPhase['facts'][number]>()
        // Claude Code logs an effort level, pi a thinking level; Gemini CLI neither.
        const effort = d.source === 'gemini-cli' ? undefined : (['medium', 'high', 'high', 'xhigh'] as const)[Math.floor(rand() * 4)]
        const add = (model: string, role: 'driver' | 'subagent', p: number, output: number, ts: number) => {
          const step = contextStep(p)
          const cacheRead = Math.round(p * 0.9)
          const cw = Math.round(p * 0.06)
          const input = Math.max(Math.round(p - cacheRead - cw), 0)
          const key = `${date}|${sessionId}|${model}|${role}|${step}|${effort}`
          let row = reqRows.get(key)
          if (!row) {
            row = { date, source: d.source, project, sessionId, model, role, step, effort, n: 0, input: 0, output: 0, cw5m: 0, cw1h: 0, cacheRead: 0, thinking: 0, thinkingEst: 0, logged: null }
            reqRows.set(key, row)
          }
          row.n++
          row.input += input
          row.output += output
          const thinking = Math.round(output * (effort === 'xhigh' ? 0.5 : effort === 'high' ? 0.35 : 0.2))
          row.thinking! += thinking
          if (d.source === 'pi') row.thinkingEst! += thinking
          row.cw5m += cw
          row.cacheRead += cacheRead
          if (d.source === 'pi') {
            const m = 1 / 1_000_000
            row.logged ??= { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, n: 0 }
            row.logged.input += input * PI_PRICE.input * m
            row.logged.output += output * PI_PRICE.output * m
            row.logged.cacheWrite += cw * PI_PRICE.cacheWrite * m
            row.logged.cacheRead += cacheRead * PI_PRICE.cacheRead * m
            row.logged.n++
          }
          const pk = `${model}|${role}`
          const pf = phaseFacts.get(pk) ?? { date, model, role, input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }
          pf.input += input
          pf.output += output
          pf.cacheCreate += cw
          pf.cacheRead += cacheRead
          phaseFacts.set(pk, pf)
          void ts
        }
        for (let t = 0; t < turns; t++) {
          const ts = start + t * 90_000
          turn++
          const tk = `${date}|${d.model}|${kind}|${turn}`
          const tr = turnRows.get(tk) ?? { date, source: d.source, model: d.model, kind, turn, n: 0, promptSum: 0 }
          tr.n++
          tr.promptSum += prompt
          turnRows.set(tk, tr)
          add(d.model, 'driver', prompt, Math.round(400 + rand() * 2600), ts)
          if (d.subagent && rand() < 0.15) add(d.subagent, 'subagent', 25_000 + rand() * 30_000, Math.round(800 + rand() * 2000), ts)
          prompt += 2_500 + rand() * 6_000
          const limit = d.model.includes('haiku-5') ? 140_000 : 165_000
          if (prompt > limit) {
            if (d.source === 'claude-code') {
              compactions.push({ date, source: d.source, model: d.model, trigger: rand() < 0.2 ? 'manual' : 'auto', preTokens: Math.round(prompt) })
            }
            prompt = 28_000 + rand() * 10_000
            kind = 'compaction'
            turn = 0
          }
        }
        const end = start + turns * 90_000
        sessions.push({ source: d.source, sessionId, project, first: new Date(start).toISOString(), last: new Date(end).toISOString() })
        phases.push({
          source: d.source,
          sessionId,
          project,
          driver: d.model,
          effort,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          facts: [...phaseFacts.values()],
        })
      }
    }
  }

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    source: 'sample',
    daily: { projects: {} },
    sessions: { sessions: [] },
    partners: { idleGapMinutes: 120, phases },
    scan: {
      sources: [
        { id: 'claude-code', label: 'Claude Code', found: true },
        { id: 'gemini-cli', label: 'Gemini CLI', found: true },
        { id: 'pi', label: 'pi', found: true },
      ],
      requests: [...reqRows.values()],
      turns: [...turnRows.values()],
      compactions,
      sessions,
    },
  }
}
