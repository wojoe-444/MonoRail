import { lazy } from 'react'
import { Shapes } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * OpenMetadata: every entity type of an OpenMetadata 2.0.x server on one
 * page, the way OpenMetadata stores it. Optional: nothing runs until the user
 * adds the OpenMetadata connection (electron/modules/openmetadata.cjs). It
 * has the drawer's Insights slot (the shapes icon), which the Semantic page
 * held before it was emptied.
 */
export const openMetadataModule: ModuleDefinition = {
  id: 'openmetadata',
  title: 'OpenMetadata',
  description: 'Your metadata catalog: glossary, lineage, data quality, the semantic layer and every entity type OpenMetadata knows.',
  icon: Shapes,
  path: '/openmetadata',
  nav: { section: 'Insights' },
  component: lazy(() => import('./OpenMetadataPage')),
  dataMethods: ['status', 'counts', 'list', 'get', 'versions', 'recent', 'setDescription'],
}
