import { lazy } from 'react'
import { Workflow } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Flows: agents built as a graph of steps on a canvas.
 * Backend: electron/modules/flows.cjs. Docs: docs/flows.md.
 */
export const flowsModule: ModuleDefinition = {
  id: 'flows',
  title: 'Flows',
  description: 'Build agents as a graph of steps and run them here, from Chat or as an MCP tool.',
  icon: Workflow,
  path: '/agents/flows',
  nav: { section: 'Workspace', parent: '/agents' },
  layout: 'full',
  dataMethods: ['list', 'get', 'create', 'save', 'flush', 'remove', 'history', 'version', 'options', 'run', 'pollRun', 'stopRun', 'runningRun', 'runs'],
  component: lazy(() => import('./FlowsPage')),
}
