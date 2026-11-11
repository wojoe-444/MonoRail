import { lazy } from 'react'
import { KeyRound } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Connections: the accounts MonoRail signs in with (Google Cloud, Atlassian,
 * Claude), each with a live status. Connectors live in electron/connections;
 * other backends get credentials from there, never through the page.
 */
export const connectionsModule: ModuleDefinition = {
  id: 'connections',
  title: 'Connections',
  description: 'Accounts MonoRail signs in with, and whether each one still works.',
  icon: KeyRound,
  path: '/connections',
  nav: { section: 'Configure', order: 100 },
  component: lazy(() => import('./ConnectionsPage')),
  dataMethods: ['list', 'check', 'save', 'remove', 'runAction', 'getJob', 'cancelJob', 'listWindowsCredentials'],
}
