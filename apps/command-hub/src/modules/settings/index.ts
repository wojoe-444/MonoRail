import { lazy } from 'react'
import { Settings } from 'lucide-react'

import type { ModuleDefinition } from '../types'

export const settingsModule: ModuleDefinition = {
  id: 'settings',
  title: 'Settings',
  description: 'App version, updates and where MonoRail keeps its local data.',
  icon: Settings,
  path: '/settings',
  nav: { section: 'Configure', order: 900 },
  component: lazy(() => import('./SettingsPage')),
  dataMethods: ['getStatus', 'checkForUpdates', 'downloadUpdate', 'installAndRestart'],
}
