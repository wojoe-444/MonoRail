import { useSyncExternalStore } from 'react'

import { invokeModule, isDesktop } from '@/modules/client'

import type { ExtensionList, ExtensionSummary } from './types'

/**
 * The installed extensions, loaded from the "extensions" backend and kept
 * fresh: the main process pushes 'extension:changed' whenever something is
 * installed, removed, toggled, reloaded, or a backend starts or stops.
 */

let list: ExtensionList = { apiVersion: '', extensions: [] }
let loaded = false
const listeners = new Set<() => void>()
let inflight: Promise<void> | undefined
let again = false

function emit() {
  listeners.forEach((l) => l())
}

export function refreshExtensions(): Promise<void> {
  if (!isDesktop()) return Promise.resolve()
  if (inflight) {
    again = true
    return inflight
  }
  inflight = invokeModule<ExtensionList>('extensions', 'list')
    .then((next) => {
      list = next
      loaded = true
      emit()
    })
    .catch(() => {})
    .finally(() => {
      inflight = undefined
      if (again) {
        again = false
        void refreshExtensions()
      }
    })
  return inflight
}

if (typeof window !== 'undefined' && window.commandHub) {
  window.commandHub.on?.('extension:changed', () => void refreshExtensions())
  void refreshExtensions()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getExtensionList(): ExtensionList {
  return list
}

export function extensionsLoaded(): boolean {
  return loaded
}

/** Installed extensions (all states). Re-renders when the set changes. */
export function useExtensionList(): ExtensionList {
  return useSyncExternalStore(subscribe, getExtensionList, getExtensionList)
}

/** Only extensions whose pages and apps should appear in the hub. */
export function activeExtensions(l: ExtensionList = list): ExtensionSummary[] {
  return l.extensions.filter((e) => e.status === 'active')
}
