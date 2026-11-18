import { lazy } from 'react'
import { Workflow } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Services: data sources as OpenMetadata services, and OpenMetadata's
 * ingestion pipelines that read them, run on this PC or on the user's
 * OpenMetadata server (electron/modules/ingestion.cjs, docs/ingestion.md).
 * The module id stays `ingestion`; the page is called Services.
 */
export const ingestionModule: ModuleDefinition = {
  id: 'ingestion',
  title: 'Services',
  description: 'Data sources and the ingestion pipelines that read them into a catalog.',
  icon: Workflow,
  path: '/services',
  nav: { section: 'Settings', group: 'Data', order: 100 },
  component: lazy(() => import('./ServicesPage')),
  dataMethods: ['overview', 'testConnection', 'listPipelines', 'savePipeline', 'deletePipeline', 'setFlags', 'run', 'kill', 'runs', 'serverOverview', 'serverRuns', 'serverAction', 'serverLogs', 'serverCreate', 'explore'],
}
