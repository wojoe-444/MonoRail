import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light / dark theme for the whole app, apps included. Light is the default;
 * the choice is remembered in localStorage (inside the app's AppData folder in
 * Electron). The theme is applied as the `dark` class on <html>, which the
 * Tailwind tokens and app stylesheets key off.
 */
export type Theme = 'light' | 'dark'

const KEY = 'commandHub.theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

let theme: Theme = read()

function apply() {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
apply()

export function setTheme(next: Theme) {
  theme = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* storage unavailable: keep it for this session */
  }
  apply()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Current theme and a toggle. */
export function useTheme(): [Theme, () => void] {
  const t = useSyncExternalStore(subscribe, () => theme, () => 'light' as Theme)
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [])
  return [t, toggle]
}
