import { lazy } from 'react'
import { Library } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * OpenMetadata: every entity type of an OpenMetadata 2.0.x server on one
 * page, the way OpenMetadata stores it. Optional: nothing runs until the user
 * adds the OpenMetadata connection (electron/modules/openmetadata.cjs). Sits
 * right under Home and Explore.
 */
export const openMetadataModule: ModuleDefinition = {
  id: 'openmetadata',
  title: 'OpenMetadata',
  description: 'Every entity in your OpenMetadata server, the way OpenMetadata stores it.',
  icon: Library,
  path: '/openmetadata',
  nav: { section: '', order: 2 },
  component: lazy(() => import('./OpenMetadataPage')),
  dataMethods: ['status', 'counts', 'list', 'get', 'versions', 'recent', 'setDescription'],
}
