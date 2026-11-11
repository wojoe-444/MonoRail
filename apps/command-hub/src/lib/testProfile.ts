import { useEffect, useState } from 'react'

import { activeProfileId, clearProfilePrefs, setActiveProfileId } from '@/lib/prefs'
import { invokeModule, isDesktop } from '@/modules/client'
import type { ProfilesView } from '@/modules/settings/types'

/**
 * Developer Mode's New User test profile (docs/developer-mode.md): a hidden
 * profile that starts blank every time you switch to it. Switching restarts
 * MonoRail, because every backend reads the active profile when it starts.
 */
export const NEW_USER_ID = 'new-user'

const EVENT = 'monorail:profiles'
let cached: ProfilesView | undefined

async function load(): Promise<ProfilesView | undefined> {
  if (!isDesktop()) return undefined
  try {
    cached = await invokeModule<ProfilesView>('profiles', 'getProfiles')
    window.dispatchEvent(new Event(EVENT))
  } catch {
    /* no backend */
  }
  return cached
}

/** The profiles as the backend sees them (undefined in the browser dev server). */
export function useProfiles(): ProfilesView | undefined {
  const [view, setView] = useState(cached)
  useEffect(() => {
    const on = () => setView(cached)
    window.addEventListener(EVENT, on)
    if (!cached) void load()
    return () => window.removeEventListener(EVENT, on)
  }, [])
  return view
}

/**
 * Switch to a profile and restart. To New User: its preferences are cleared
 * here and its folder is wiped at the start that follows, so it is blank.
 * Returns false when MonoRail could not restart (browser dev bridge).
 */
export async function switchProfile(id: string): Promise<boolean> {
  await invokeModule<ProfilesView>('profiles', 'switchTo', { id })
  if (id === NEW_USER_ID) clearProfilePrefs(NEW_USER_ID)
  setActiveProfileId(id)
  const { restarting } = await invokeModule<{ restarting: boolean }>('profiles', 'restart')
  return restarting
}

/**
 * At start-up: make the window's preferences follow the profile the backend
 * started in (e.g. after a restart that a crash cut short). Reloads once if
 * they disagree.
 */
export async function syncActiveProfile(): Promise<void> {
  const view = await load()
  if (!view) return
  if (view.activeId !== activeProfileId()) {
    setActiveProfileId(view.activeId)
    window.location.reload()
  }
}
