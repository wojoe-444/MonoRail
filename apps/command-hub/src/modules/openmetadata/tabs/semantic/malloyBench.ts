import { useCallback, useRef, useState } from 'react'

import { malloyCall, type MalloyRun, type MalloySql } from './malloyClient'

export interface MalloyBenchState {
  query?: string
  /** Which answer to show: the last button pressed. */
  last?: 'sql' | 'run'
  sql?: MalloySql
  result?: MalloyRun
  busy?: 'sql' | 'run'
  error?: string
}

/** Workbench state per model path, kept while the tab is open; late answers to an older request are dropped. */
export function useMalloyBench() {
  const [benches, setBenches] = useState<Record<string, MalloyBenchState>>({})
  const seq = useRef(new Map<string, number>())

  const patch = useCallback((path: string, p: Partial<MalloyBenchState>) => setBenches((b) => ({ ...b, [path]: { ...b[path], ...p } })), [])

  const call = useCallback(
    async (path: string, kind: 'sql' | 'run', query: string) => {
      const n = (seq.current.get(path) ?? 0) + 1
      seq.current.set(path, n)
      patch(path, { query, busy: kind, last: kind, error: undefined })
      try {
        const answer = kind === 'sql' ? await malloyCall('sql', { path, query }) : await malloyCall('run', { path, query })
        if (seq.current.get(path) !== n) return
        patch(path, kind === 'sql' ? { sql: answer, busy: undefined } : { result: answer as MalloyRun, busy: undefined })
      } catch (e) {
        if (seq.current.get(path) !== n) return
        patch(path, { busy: undefined, error: e instanceof Error ? e.message : String(e) })
      }
    },
    [patch],
  )

  const reset = useCallback(() => {
    seq.current.clear()
    setBenches({})
  }, [])

  return { benches, patch, call, reset }
}

export type MalloyBench = ReturnType<typeof useMalloyBench>
