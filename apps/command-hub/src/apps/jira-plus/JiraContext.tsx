import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errorText, jiraApi } from './api'
import type { Overview, Project, Source } from './types'

type DialogKind = 'create' | 'create-epic' | 'create-subtask' | 'create-recurring' | 'project' | 'connect'

interface JiraContextValue {
  overview?: Overview
  overviewError?: string
  projects: Project[]
  priorities: string[]
  /** Bumped after every change so pages refetch their tickets. */
  version: number
  refresh: () => Promise<void>
  /** The ticket open in the issue dialog (?selectedIssue=local:ME-4). */
  selected?: { source: Source; key: string }
  openIssue: (source: Source, key: string) => void
  closeIssue: () => void
  /** parent: create the new issue under this key (from "Add child issue"). */
  dialog?: { kind: DialogKind; project?: Project; parent?: string }
  openDialog: (kind: DialogKind, project?: Project, parent?: string) => void
  closeDialog: () => void
}

const Ctx = createContext<JiraContextValue | undefined>(undefined)

export function JiraProvider({ children }: { children: ReactNode }) {
  const [overview, setOverview] = useState<Overview>()
  const [overviewError, setOverviewError] = useState<string>()
  const [version, setVersion] = useState(0)
  const [dialog, setDialog] = useState<JiraContextValue['dialog']>()
  const [params, setParams] = useSearchParams()

  const refresh = useCallback(async () => {
    try {
      setOverview(await jiraApi().getOverview())
      setOverviewError(undefined)
    } catch (e) {
      setOverviewError(errorText(e))
    }
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const raw = params.get('selectedIssue')
  const selected = useMemo(() => {
    const m = raw?.match(/^(local|jira):(.+)$/)
    return m ? { source: m[1] as Source, key: m[2] } : undefined
  }, [raw])

  const value: JiraContextValue = {
    overview,
    overviewError,
    projects: overview?.projects ?? [],
    priorities: overview?.local.priorities ?? ['Highest', 'High', 'Medium', 'Low', 'Lowest'],
    version,
    refresh,
    selected,
    openIssue: (source, key) =>
      setParams((p) => {
        p.set('selectedIssue', `${source}:${key}`)
        return p
      }),
    closeIssue: () =>
      setParams((p) => {
        p.delete('selectedIssue')
        return p
      }),
    dialog,
    openDialog: (kind, project, parent) => setDialog({ kind, project, parent }),
    closeDialog: () => setDialog(undefined),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useJira(): JiraContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useJira outside JiraProvider')
  return v
}

/** Route segment for a project: /projects/local/ME or /projects/jira/PLAT. */
export function projectPath(p: { source: Source; key: string }, view: 'board' | 'list' | 'epics' | 'recurring' = 'board'): string {
  return `/projects/${p.source}/${encodeURIComponent(p.key)}/${view}`
}
