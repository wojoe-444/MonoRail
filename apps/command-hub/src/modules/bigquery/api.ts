/**
 * One entry point for the page: the real backend in the desktop app
 * (electron/modules/bigquery.cjs), fictional sample data in the browser dev
 * server (sample.ts).
 */
import { invokeModule, isDesktop } from '@/modules/client'

import { SAMPLE_DATA, SAMPLE_PROJECT, SAMPLE_PROJECTS, sampleJob, sampleJobList, samplePage, sampleQuery, sampleTable } from './sample'
import type { BqDataset, BqDatasetInfo, BqJob, BqPreview, BqProject, BqQueryResult, BqStatus, BqTable, BqTableItem } from './types'

export interface QueryArgs {
  projectId: string
  query: string
  location?: string
  maximumBytesBilled?: number
  useQueryCache?: boolean
  maxResults?: number
}

const live = () => isDesktop()
const call = <T,>(method: string, args?: unknown) => invokeModule<T>('bigquery', method, args)

export const bq = {
  status: (): Promise<BqStatus> => (live() ? call('status') : Promise.resolve({ state: 'ok', defaultProject: SAMPLE_PROJECT })),

  listProjects: async (): Promise<{ projects: BqProject[]; truncated?: boolean }> => (live() ? call('listProjects') : { projects: SAMPLE_PROJECTS }),

  listDatasets: async (projectId: string): Promise<{ datasets: BqDataset[]; truncated?: boolean }> =>
    live() ? call('listDatasets', { projectId }) : { datasets: projectId === SAMPLE_PROJECT ? Object.keys(SAMPLE_DATA).map((id) => ({ id, location: 'US' })) : [] },

  getDataset: async (projectId: string, datasetId: string): Promise<BqDatasetInfo> =>
    live()
      ? call('getDataset', { projectId, datasetId })
      : { projectId, datasetId, location: 'US', description: 'Fictional sample dataset.', creationTime: '2026-01-20T10:00:00Z', lastModifiedTime: '2026-11-17T10:00:00Z' },

  listTables: async (projectId: string, datasetId: string): Promise<{ tables: BqTableItem[]; truncated?: boolean }> =>
    live()
      ? call('listTables', { projectId, datasetId })
      : { tables: Object.entries(SAMPLE_DATA[datasetId] ?? {}).map(([id, t]) => ({ id, type: t.meta.type, partitioned: !!t.meta.partitioning })) },

  getTable: async (projectId: string, datasetId: string, tableId: string): Promise<BqTable> =>
    live() ? call('getTable', { projectId, datasetId, tableId }) : sampleTable(datasetId, tableId),

  previewTable: async (projectId: string, datasetId: string, tableId: string, maxResults: number, pageToken?: string): Promise<BqPreview> => {
    if (live()) return call('previewTable', { projectId, datasetId, tableId, maxResults, pageToken })
    const t = sampleTable(datasetId, tableId)
    if (t.type === 'VIEW') return { fields: t.fields, rows: [], view: true }
    const rows = SAMPLE_DATA[datasetId][tableId].rows
    const start = Number(pageToken ?? 0)
    return { fields: t.fields, rows: rows.slice(start, start + maxResults), totalRows: rows.length, pageToken: start + maxResults < rows.length ? String(start + maxResults) : undefined }
  },

  dryRun: async (a: QueryArgs): Promise<BqQueryResult> => (live() ? call('dryRun', a) : sampleQuery(a.query, { dryRun: true })),

  runQuery: async (a: QueryArgs): Promise<BqQueryResult> => (live() ? call('runQuery', a) : sampleQuery(a.query, { pageSize: a.maxResults })),

  getQueryResults: async (a: { projectId: string; jobId: string; location?: string; maxResults: number; pageToken?: string; timeoutMs?: number }): Promise<BqQueryResult> =>
    live() ? call('getQueryResults', a) : samplePage(a.jobId, a.pageToken, a.maxResults),

  getJob: async (a: { projectId: string; jobId: string; location?: string }): Promise<BqJob> => {
    if (live()) return call('getJob', a)
    const j = sampleJob(a.jobId) ?? sampleJobList(true).find((x) => x.jobId === a.jobId)
    if (!j) throw new Error('Job not found.')
    return j
  },

  cancelJob: async (a: { projectId: string; jobId: string; location?: string }): Promise<BqJob> =>
    live() ? call('cancelJob', a) : { projectId: a.projectId, jobId: a.jobId, state: 'DONE', error: 'Job cancelled.' },

  listJobs: async (projectId: string, allUsers: boolean): Promise<{ jobs: BqJob[]; pageToken?: string }> =>
    live() ? call('listJobs', { projectId, allUsers, maxResults: 50 }) : { jobs: sampleJobList(allUsers) },
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
