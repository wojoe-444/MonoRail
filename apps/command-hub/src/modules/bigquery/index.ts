import { lazy } from 'react'
import { DatabaseZap } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * BigQuery: a BigQuery console inside MonoRail (explorer, SQL editor tabs with
 * dry-run estimates, results, job information, execution details, history).
 * Optional: nothing runs until the user adds the Google Cloud connection
 * (electron/modules/bigquery.cjs). Guide: docs/guide/workspace/bigquery.md.
 */
export const bigQueryModule: ModuleDefinition = {
  id: 'bigquery',
  title: 'BigQuery',
  description: 'Browse BigQuery datasets and run SQL with your own Google Cloud account: editor tabs, cost estimates, results, charts and query history.',
  icon: DatabaseZap,
  path: '/bigquery',
  nav: { section: 'Workspace', parent: '/tools' },
  layout: 'full',
  component: lazy(() => import('./BigQueryPage')),
  dataMethods: ['status', 'listProjects', 'listDatasets', 'getDataset', 'listTables', 'getTable', 'previewTable', 'dryRun', 'runQuery', 'getQueryResults', 'getJob', 'cancelJob', 'listJobs'],
}
