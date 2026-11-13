import { useSyncExternalStore } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

/**
 * Developer Mode (Settings > Developer Mode, docs/developer-mode.md): extra
 * tools for testing MonoRail and giving feedback on it. Off by default.
 *
 * Kept in localStorage under a machine-wide key, not in `prefs`, on purpose:
 * it must stay on while the New User test profile is open, so the way back
 * to your own profile is always there.
 */
const KEY = 'commandHub.devMode'
const EVENT = 'monorail:devmode'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function isDevMode(): boolean {
  return read()
}

export function setDevMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb()
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}

// ---------- the element inspector's on/off state (in memory only) ----------

let inspecting = false
const inspectListeners = new Set<() => void>()

export function isInspecting(): boolean {
  return inspecting
}

export function setInspecting(on: boolean): void {
  if (inspecting === on) return
  inspecting = on
  for (const cb of inspectListeners) cb()
}

export function useInspecting(): boolean {
  return useSyncExternalStore(
    (cb) => {
      inspectListeners.add(cb)
      return () => inspectListeners.delete(cb)
    },
    () => inspecting,
    () => false,
  )
}

/** Open or close Chromium's DevTools for the window (desktop only). */
export function openDevTools(): void {
  if (isDesktop()) void invokeModule('developer', 'toggleDevTools').catch(() => {})
}
