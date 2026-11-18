import { invokeModule, isDesktop } from '@/modules/client'

import { sampleInvoke } from './sample'
import type { PipelineState, PipelineType } from './types'

/** Call the ingestion backend; in the browser dev server, the fictional sample. */
export function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  return isDesktop() ? invokeModule<T>('ingestion', method, args) : sampleInvoke<T>(method)
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** OpenMetadata's pipeline types in plain words. */
export const TYPE_INFO: Record<PipelineType, { label: string; description: string }> = {
  metadata: { label: 'Metadata', description: 'Databases, schemas, tables, views, columns and tags.' },
  usage: { label: 'Usage', description: 'Who queries which tables, from query history.' },
  lineage: { label: 'Lineage', description: 'Table and column lineage from query history.' },
  profiler: { label: 'Profiler', description: 'Row counts, nulls and distinct values per column.' },
  autoClassification: { label: 'Auto classification', description: 'Tags columns that look like personal data.' },
  dbt: { label: 'dbt', description: 'Models, sources, columns, descriptions and lineage from a dbt project.' },
}

/** OpenMetadata's service categories in plain words. */
export const CATEGORY_LABELS: Record<string, string> = {
  databaseService: 'Database',
  dashboardService: 'Dashboard',
  messagingService: 'Messaging',
  pipelineService: 'Pipeline',
  mlmodelService: 'ML model',
  storageService: 'Storage',
  searchService: 'Search',
  apiService: 'API',
  metadataService: 'Metadata',
}

export const STATE_INFO: Record<PipelineState, { label: string; variant: 'success' | 'warning' | 'destructive' | 'info' | 'secondary' }> = {
  success: { label: 'Success', variant: 'success' },
  partialSuccess: { label: 'Partial success', variant: 'warning' },
  failed: { label: 'Failed', variant: 'destructive' },
  running: { label: 'Running', variant: 'info' },
  queued: { label: 'Queued', variant: 'secondary' },
}

export function when(ms?: number | string | null): string {
  if (ms === undefined || ms === null) return '—'
  const t = typeof ms === 'number' ? ms : Date.parse(ms)
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const abs = Math.abs(diff)
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  const rel = abs < 60_000 ? 'just now' : abs < 3_600_000 ? fmt(Math.round(abs / 60_000), 'minute') : abs < 86_400_000 ? fmt(Math.round(abs / 3_600_000), 'hour') : undefined
  if (rel) return rel === 'just now' ? rel : diff >= 0 ? `${rel} ago` : `in ${rel}`
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function duration(start?: number, end?: number): string {
  if (!start || !end || end < start) return ''
  const s = Math.round((end - start) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
