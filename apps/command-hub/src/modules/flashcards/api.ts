import { useCallback, useEffect, useRef, useState } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

import { sampleInvoke } from './sample'

/** Call the Flashcards backend; in the browser dev server, the in-memory sample. */
export function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  return isDesktop() ? invokeModule<T>('flashcards', method, args) : sampleInvoke<T>(method, args)
}

/** Load once and on reload(); keeps the previous data while reloading. */
export function useFlashcards<T>(method: string, args?: Record<string, unknown>) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const key = JSON.stringify(args ?? null)
  const seq = useRef(0)
  const reload = useCallback(async () => {
    const n = ++seq.current
    try {
      const r = await call<T>(method, key === 'null' ? undefined : JSON.parse(key))
      if (n === seq.current) {
        setData(r)
        setError(undefined)
      }
    } catch (e) {
      if (n === seq.current) setError(e instanceof Error ? e.message : String(e))
    }
  }, [method, key])
  useEffect(() => {
    void reload()
  }, [reload])
  return { data, setData, error, reload }
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
