import { useEffect, useState } from 'react'

import { prefs } from '@/lib/prefs'
import { invokeModule, isDesktop } from '@/modules/client'

import { malloyCall } from './malloyClient'

/**
 * Which engine the Semantic models and Query builder tabs use: real Malloy on
 * BigQuery (default) or the user's MetricFlow. The choice is a per-person
 * preference; with none saved, a one-time look at which of the two is set up
 * picks MetricFlow only when Malloy is not set up and MetricFlow is (kept in
 * memory, never saved).
 */
export type SemanticEngine = 'malloy' | 'metricflow'

const KEY = 'monorail.openmetadata.semanticEngine'
const listeners = new Set<(e: SemanticEngine) => void>()
let guessed: SemanticEngine | undefined
let guessing: Promise<SemanticEngine> | undefined

function saved(): SemanticEngine | undefined {
  const v = prefs.getItem(KEY)
  return v === 'malloy' || v === 'metricflow' ? v : undefined
}

async function guess(): Promise<SemanticEngine> {
  const status = await malloyCall('status').catch(() => undefined)
  if (status?.block !== 'not-set-up') return 'malloy'
  const project = await invokeModule('semantic', 'getProject').catch(() => undefined)
  return project && project.block !== 'not-set-up' ? 'metricflow' : 'malloy'
}

/** Switch the semantic tabs to an engine (a handoff from another tab), remembered like a pick. */
export function setSemanticEngine(e: SemanticEngine) {
  prefs.setItem(KEY, e)
  for (const l of listeners) l(e)
}

export function useSemanticEngine(): [SemanticEngine, (e: SemanticEngine) => void] {
  const [engine, setEngine] = useState<SemanticEngine>(() => saved() ?? guessed ?? 'malloy')

  useEffect(() => {
    listeners.add(setEngine)
    return () => void listeners.delete(setEngine)
  }, [])

  useEffect(() => {
    if (saved() || guessed || !isDesktop()) return
    let live = true
    guessing ??= guess()
    void guessing.then((e) => {
      guessed = e
      if (live && !saved()) setEngine(e)
    })
    return () => {
      live = false
    }
  }, [])

  return [engine, setSemanticEngine]
}
