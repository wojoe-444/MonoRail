import { lazy } from 'react'
import { Shapes } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Semantic: a dbt project's semantic layer, browsed from its
 * target/semantic_manifest.json and queried with the user's own MetricFlow
 * (`mf`). Optional: nothing runs until the user adds the MetricFlow
 * connection, and a query only runs when they turned that on
 * (electron/modules/semantic.cjs).
 */
export const semanticModule: ModuleDefinition = {
  id: 'semantic',
  title: 'Semantic',
  description: 'Metrics and dimensions from your dbt project, queried with MetricFlow.',
  icon: Shapes,
  path: '/semantic',
  nav: { section: 'Insights' },
  component: lazy(() => import('./SemanticPage')),
  dataMethods: ['getProject', 'query', 'explain'],
}
