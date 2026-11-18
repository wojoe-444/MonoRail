import { useSyncExternalStore } from 'react'

import { prefs } from '@/lib/prefs'

/**
 * The new user tour (docs/guide/first-ten-minutes.md#take-the-tour): a few
 * steps that point at the parts of the app frame. It opens by itself once per
 * profile, the first time MonoRail starts, and again whenever someone asks for
 * it (Home's "Take the tour", Settings > General). Nothing else is stored.
 */
const SEEN_KEY = 'commandHub.tour.seen'

let open = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function startTour(): void {
  open = true
  emit()
}

/** Close the tour and remember it was seen, so it never opens by itself again. */
export function endTour(): void {
  open = false
  prefs.setItem(SEEN_KEY, '1')
  emit()
}

/** True the first time a profile starts MonoRail (until the tour is closed once). */
export function tourUnseen(): boolean {
  return prefs.getItem(SEEN_KEY) === null
}

export function useTourOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open,
  )
}
