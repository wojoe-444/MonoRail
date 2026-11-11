import { useCallback, useSyncExternalStore } from 'react'

/**
 * Minimal hash router. Hash routing works with Electron's file:// loading and
 * needs no server config. Paths look like "/claude-stats" (URL "#/claude-stats").
 */

function readPath(): string {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw || raw === '/') return '/'
  return raw.startsWith('/') ? raw.replace(/\/+$/, '') : `/${raw}`
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function navigate(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`
  if (readPath() !== next) window.location.hash = next
}

/** Current route path and a navigate function. */
export function useRoute(): [string, (path: string) => void] {
  const path = useSyncExternalStore(subscribe, readPath, () => '/')
  const go = useCallback((p: string) => navigate(p), [])
  return [path, go]
}
