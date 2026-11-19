import { useEffect } from 'react'

import { isDesktop, useModuleQuery } from '@/modules/client'
import { sampleProject } from '@/modules/semantic/sample'
import type { SemanticProject } from '@/modules/semantic/types'

// The semantic tabs (Semantic models, Metrics, Query builder) all read the
// Semantic backend's getProject: files only, nothing runs until the MetricFlow
// connection is added. The last answer is kept in memory so switching tabs
// paints at once; each tab still reads the project again when it opens.

const cache: { project?: SemanticProject } = {}

export interface ProjectState {
  project: SemanticProject | undefined
  error: string | undefined
  fetching: boolean
  reload: () => void
}

export function useSemanticProject(): ProjectState {
  const q = useModuleQuery<SemanticProject>('semantic', 'getProject')
  useEffect(() => {
    if (q.data) cache.project = q.data
  }, [q.data])
  const project = isDesktop() ? (q.data ?? cache.project) : sampleProject
  return { project, error: q.error?.message, fetching: q.fetching, reload: () => void q.refresh() }
}
