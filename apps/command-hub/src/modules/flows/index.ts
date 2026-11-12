import { lazy } from 'react'
import { Workflow } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Flows (design preview): agents built as a graph of steps on a canvas.
 * Sample data only; no backend yet. See docs/flows-plan.md.
 */
export const flowsModule: ModuleDefinition = {
  id: 'flows',
  title: 'Flows',
  description: 'Build agents as a graph of steps and run them here, from Chat or as an MCP tool.',
  icon: Workflow,
  path: '/agents/flows',
  nav: { section: 'Workspace', parent: '/agents' },
  layout: 'full',
  component: lazy(() => import('./FlowsPage')),
}
