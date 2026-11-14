import { navigate } from '@/lib/router'

import type { SessionSource } from './types'

/**
 * Opening Chat from another page (the Agents overview): open one session, or
 * start a new chat in a repo with an SDK and a prefilled (unsent) prompt.
 * Kept in memory for the next Chat page mount only; nothing is stored.
 */
export type ChatHandoff = { open: string } | { newChat: { repo?: string; sdk?: SessionSource; prompt?: string } }

let pending: ChatHandoff | undefined

export function openInChat(handoff: ChatHandoff) {
  pending = handoff
  navigate('/agents')
}

/**
 * Read the pending handoff when the Chat page mounts. It is cleared after the
 * current render (React may call a state initializer twice in development).
 */
export function takeChatHandoff(): ChatHandoff | undefined {
  const h = pending
  if (h) setTimeout(() => {
    if (pending === h) pending = undefined
  }, 0)
  return h
}
