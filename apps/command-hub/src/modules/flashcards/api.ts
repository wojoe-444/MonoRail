import { useCallback, useEffect, useRef, useState } from 'react'
import type { MethodCall, MethodResult } from '@/ipc/contract'

import { moduleClient } from '@/modules/client'

import { sampleInvoke } from './sample'

/** Call the Flashcards backend; in the browser dev server, the in-memory sample. */
export const call = moduleClient('flashcards', sampleInvoke)

/** Load once and on reload(); keeps the previous data while reloading. */
export function useFlashcards<C extends MethodCall<'flashcards'>>(...request: C) {
  const [method, args] = request
  type T = MethodResult<'flashcards', C>
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const key = JSON.stringify(args ?? null)
  const seq = useRef(0)
  const reload = useCallback(async () => {
    const n = ++seq.current
    try {
      const r = await call(...([method, key === 'null' ? undefined : JSON.parse(key)] as C))
      if (n === seq.current) {
        setData(r)
        setError(undefined)
      }
    } catch (e) {
      if (n === seq.current) setError(e instanceof Error ? e.message : String(e))
    }
  }, [method, key])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Reload the flashcard data when the request changes.
    void reload()
  }, [reload])
  return { data, setData, error, reload }
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
