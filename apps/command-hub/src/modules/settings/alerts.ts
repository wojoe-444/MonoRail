import { useEffect, useSyncExternalStore } from 'react'

import { getExtensionList, subscribeExtensions } from '@/extensions/store'
import { invokeModule, isDesktop } from '@/modules/client'

import type { AppStatus, BackupStatus } from './types'

/**
 * Settings alerts: the few things in the user's setup that need them now.
 * Shown on the Settings home page and counted on the drawer's Settings
 * button. Usually there are none.
 *
 * Everything here is read from what MonoRail already knows: the last result
 * of each connection check (the `connections.summary` file, so no check is
 * ever run from here and connections that are not set up are never looked
 * at), the update state, the global backups' last results and the installed
 * extensions. Reading is cheap and has no side effects; it runs on start, when
 * the window gets focus (at most once a minute), every five minutes, and when
 * a page that changes one of the sources calls `refreshSettingsAlerts()`.
 */

export type AlertTone = 'warning' | 'destructive' | 'info'

export interface SettingsAlert {
  id: string
  tone: AlertTone
  title: string
  text: string
  /** The Settings page that fixes it. */
  path: string
  /** That page's name, shown on the alert. */
  where: string
  /** When the source last saw it (ISO). */
  at?: string
}

interface ConnectionSummary {
  title: string
  state: 'ok' | 'expired' | 'needs-setup' | 'error' | 'unavailable'
  summary: string
  hint?: string
  checkedAt?: string
}

const STATE_TITLE: Record<Exclude<ConnectionSummary['state'], 'ok'>, string> = {
  expired: 'sign-in expired',
  'needs-setup': 'is not signed in',
  error: 'check failed',
  unavailable: 'is not installed',
}

/** Fictional, for the browser dev server (matches the Connections sample). */
const SAMPLE: SettingsAlert[] = [
  {
    id: 'connection:gcloud',
    tone: 'warning',
    title: 'Google Cloud sign-in expired',
    text: 'Google sign-in needs renewing (application default credentials). Sign in again runs both logins.',
    path: '/connections',
    where: 'Connections',
    at: '2026-01-15T09:30:00.000Z',
  },
]

async function read(): Promise<SettingsAlert[]> {
  if (!isDesktop()) return SAMPLE
  const alerts: SettingsAlert[] = []

  const summaries = await invokeModule<Record<string, { summary?: { connections?: Record<string, ConnectionSummary> } }>>('home', 'getSummaries').catch(
    () => undefined,
  )
  for (const [kind, c] of Object.entries(summaries?.['connections.summary']?.summary?.connections ?? {})) {
    if (!c || c.state === 'ok') continue
    alerts.push({
      id: `connection:${kind}`,
      tone: c.state === 'error' ? 'destructive' : 'warning',
      title: `${c.title} ${STATE_TITLE[c.state] ?? 'needs attention'}`,
      text: [c.summary, c.hint].filter(Boolean).join(' '),
      path: '/connections',
      where: 'Connections',
      at: c.checkedAt,
    })
  }

  const app = await invokeModule<AppStatus>('settings', 'getStatus').catch(() => undefined)
  if (app && (app.state === 'available' || app.state === 'downloaded')) {
    alerts.push({
      id: 'update',
      tone: 'info',
      title: app.state === 'downloaded' ? `Version ${app.latestVersion} is ready to install` : `Version ${app.latestVersion} is available`,
      text: app.state === 'downloaded' ? 'Restart MonoRail to finish the update.' : `You have version ${app.currentVersion}.`,
      path: '/settings/general',
      where: 'General',
      at: app.lastChecked,
    })
  }

  const backups = await invokeModule<BackupStatus>('backups', 'getStatus').catch(() => undefined)
  if (backups?.settings.enabled) {
    for (const p of backups.pages) {
      const last = p.lastResult
      if (!p.included || !last || last.ok) continue
      alerts.push({
        id: `backup:${p.id}`,
        tone: 'destructive',
        title: `${p.title} backup failed`,
        text: last.error,
        path: '/settings/backups',
        where: 'Backups',
        at: last.at,
      })
    }
  }

  for (const e of getExtensionList().extensions) {
    if (e.status === 'needs-approval')
      alerts.push({
        id: `extension:${e.id}`,
        tone: 'warning',
        title: `${e.name} is waiting for your approval`,
        text: 'An update asks for new permissions. It stays off until you approve them.',
        path: '/settings/extensions',
        where: 'Extensions',
      })
    else if (e.status === 'broken' && e.enabled)
      alerts.push({
        id: `extension:${e.id}`,
        tone: 'destructive',
        title: `${e.name} could not load`,
        text: e.error ?? 'Open Extensions to see what went wrong.',
        path: '/settings/extensions',
        where: 'Extensions',
      })
  }

  const rank: Record<AlertTone, number> = { destructive: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => rank[a.tone] - rank[b.tone])
}

interface Snapshot {
  alerts: SettingsAlert[]
  loaded: boolean
}

let snapshot: Snapshot = { alerts: [], loaded: false }
const listeners = new Set<() => void>()
let seq = 0
let lastRead = 0

/** Read the alerts again (e.g. after a connection check or a backup run). */
export async function refreshSettingsAlerts(): Promise<void> {
  const id = ++seq
  lastRead = Date.now()
  const alerts = await read().catch(() => snapshot.alerts)
  if (id !== seq) return
  snapshot = { alerts, loaded: true }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

let started = false
function start() {
  if (started) return
  started = true
  void refreshSettingsAlerts()
  setInterval(() => void refreshSettingsAlerts(), 5 * 60_000)
  window.addEventListener('focus', () => {
    if (Date.now() - lastRead > 60_000) void refreshSettingsAlerts()
  })
  // Extensions turning on, off or waiting for approval.
  subscribeExtensions(() => void refreshSettingsAlerts())
}

/** The current alerts, shared by every caller; the first call starts reading. */
export function useSettingsAlerts(): Snapshot {
  useEffect(start, [])
  return useSyncExternalStore(subscribe, () => snapshot)
}
