import { lazy } from 'react'
import { Archive, House, Palette, SlidersHorizontal } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Settings is a group of pages behind the one Settings button pinned to the
 * bottom of the drawer. Every module with `nav.section: 'Settings'` is one of
 * its pages (Connections, Agent access and Extensions join from their own
 * modules); SettingsLayout draws the menu and search beside them.
 */

/** Settings home: only what needs the user (src/modules/settings/alerts.ts). Usually empty. */
export const settingsHomeModule: ModuleDefinition = {
  id: 'settings-home',
  title: 'Settings',
  description: 'Anything in your setup that needs you.',
  icon: House,
  path: '/settings',
  nav: { section: 'Settings', order: 0 },
  component: lazy(() => import('./SettingsHomePage')),
}

/** General: version and updates, about, profile, developer mode. Owns the settings backend. */
export const settingsModule: ModuleDefinition = {
  id: 'settings',
  title: 'General',
  description: 'Your profile, app version, updates and where MonoRail keeps its local data.',
  icon: SlidersHorizontal,
  path: '/settings/general',
  nav: { section: 'Settings', group: 'App', order: 10 },
  component: lazy(() => import('./SettingsPage')),
  dataMethods: ['getStatus', 'checkForUpdates', 'downloadUpdate', 'installAndRestart'],
}

export const appearanceModule: ModuleDefinition = {
  id: 'appearance',
  title: 'Appearance',
  description: 'Color scheme and light or dark mode.',
  icon: Palette,
  path: '/settings/appearance',
  nav: { section: 'Settings', group: 'App', order: 20 },
  component: lazy(() => import('./AppearancePage')),
}

/** The global backup folder (backend: electron/modules/backups.cjs). */
export const backupsModule: ModuleDefinition = {
  id: 'backups',
  title: 'Backups',
  description: 'One folder that every page backs up into, and how often.',
  icon: Archive,
  path: '/settings/backups',
  nav: { section: 'Settings', group: 'App', order: 30 },
  component: lazy(() => import('./BackupsPage')),
  dataMethods: ['getStatus', 'save', 'runAll', 'pickFolder', 'openFolder'],
}
