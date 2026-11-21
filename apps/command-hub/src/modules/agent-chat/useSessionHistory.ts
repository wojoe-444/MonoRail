import { useEffect, useEffectEvent, useState } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

import { sampleTranscripts } from './sample'
import type { SessionSummary, SessionTranscript } from './types'

export function useSessionHistory(session: SessionSummary | undefined, skipHistory?: boolean, onAttach?: (turnId: string) => void) {
  const desktop = isDesktop()
  const noHistory = !session || skipHistory
  // The browser dev server has no backend: start from the fictional transcript.
  const [transcript, setTranscript] = useState<SessionTranscript | undefined>(() =>
    noHistory ? { id: session?.id ?? '', messages: [] } : desktop ? undefined : (sampleTranscripts[session.id] ?? { id: session.id, messages: [] }),
  )
  const [error, setError] = useState<Error>()
  const attach = useEffectEvent((turnId: string) => onAttach?.(turnId))

  // History is read once when the chat opens; turns sent from here are shown live after it.
  const sessionId = session?.id
  useEffect(() => {
    if (!desktop || noHistory || !sessionId) return
    let live = true
    invokeModule<SessionTranscript>('agent-chat', 'getSession', { id: sessionId }).then(
      (t) => live && setTranscript(t),
      (e: unknown) => live && setError(e instanceof Error ? e : new Error(String(e))),
    )
    invokeModule<string | null>('agent-chat', 'runningTurn', { chatId: sessionId }).then(
      (turnId) => live && turnId && attach(turnId),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [desktop, noHistory, sessionId])

  return { transcript, error }
}
