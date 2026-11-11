import { lazy } from 'react'
import { HardDrive } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Storage Manager: drive space and what MonoRail, agents, developer caches and
 * common folders take up. Read-only (electron/modules/storage.cjs).
 */
export const storageModule: ModuleDefinition = {
  id: 'storage',
  title: 'Storage',
  description: 'How full your drives are and which folders take up the space.',
  icon: HardDrive,
  path: '/storage',
  nav: { section: 'Utilities' },
  component: lazy(() => import('./StoragePage')),
  dataMethods: ['getDrives', 'getScan', 'startScan', 'openLocation', 'openStorageSettings'],
}
