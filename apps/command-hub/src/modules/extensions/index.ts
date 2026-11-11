import { lazy } from 'react'
import { Puzzle } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Settings > Extensions: install, update, turn off and remove MonoRail
 * extensions (separately built modules and apps, see electron/extensions).
 */
export const extensionsModule: ModuleDefinition = {
  id: 'extensions',
  title: 'Extensions',
  description: 'Add modules and apps built in other repositories, and control what they may access.',
  icon: Puzzle,
  path: '/settings/extensions',
  nav: { section: 'Configure', order: 850 },
  component: lazy(() => import('./ExtensionsPage')),
  dataMethods: ['list', 'inspect', 'confirm', 'cancel', 'uninstall', 'setEnabled', 'approve', 'reload', 'checkUpdates', 'stageUpdate', 'revokeFolder', 'logs', 'openFolder', 'requestFolder', 'openExternal'],
}
