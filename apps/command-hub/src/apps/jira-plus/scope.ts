import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { errorText, jiraApi } from './api'
import { useJira } from './JiraContext'
import type { Issue, Project, Source, StatusCategory } from './types'
import { useIssues } from './useIssues'

/** The views of the Tasks page. Project-only views come after Calendar. */
export type TaskView = 'overview' | 'list' | 'board' | 'calendar' | 'epics' | 'recurring' | 'on-trigger'
export const MAIN_VIEWS: TaskView[] = ['overview', 'list', 'board', 'calendar']
export const PROJECT_VIEWS: TaskView[] = ['list', 'board', 'calendar', 'epics', 'recurring', 'on-trigger']

/** Routes: "/" and "/list|board|calendar" for every project, "/projects/<source>/<key>/<view>" for one. */
export function viewPath(view: TaskView, project?: { source: Source; key: string }): string {
  if (project) return `/projects/${project.source}/${encodeURIComponent(project.key)}/${view === 'overview' ? 'board' : view}`
  return view === 'overview' || !MAIN_VIEWS.includes(view) ? '/' : `/${view}`
}

/** Which project (if any) and view the current route shows. */
export function useScope(): { view: TaskView; project?: Project; projectRef?: { source: Source; key: string } } {
  const { projects } = useJira()
  const { pathname } = useLocation()
  const m = pathname.match(/^\/projects\/(local|jira)\/([^/]+)\/([a-z-]+)/)
  if (m) {
    const ref = { source: m[1] as Source, key: decodeURIComponent(m[2]) }
    const view = (PROJECT_VIEWS.includes(m[3] as TaskView) ? m[3] : 'board') as TaskView
    return { view, projectRef: ref, project: projects.find((p) => p.source === ref.source && p.key === ref.key) }
  }
  const v = pathname.replace(/^\//, '') as TaskView
  return { view: MAIN_VIEWS.includes(v) ? v : 'overview' }
}

/** The search box's text (?q=), shared by every view. */
export function useQuery(): [string, (q: string) => void] {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const set = (next: string) =>
    setParams(
      (p) => {
        if (next) p.set('q', next)
        else p.delete('q')
        return p
      },
      { replace: true },
    )
  return [q, set]
}

export function matches(i: Issue, q: string): boolean {
  const needle = q.trim().toLowerCase()
  return !needle || i.key.toLowerCase().includes(needle) || i.summary.toLowerCase().includes(needle) || i.labels.some((l) => l.toLowerCase().includes(needle))
}

/** Private workflow: which status a card lands in when dropped on a column. */
const LOCAL_STATUS_FOR: Record<StatusCategory, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }

/** Tasks in scope (one project or all), plus moving a task to another status category. */
export function useScopedIssues(projectRef?: { source: Source; key: string }) {
  const { refresh } = useJira()
  const { issues, setIssues, error } = useIssues(projectRef?.source ?? 'all', projectRef?.key)
  const [busyKey, setBusyKey] = useState<string>()
  const [moveError, setMoveError] = useState<string>()

  async function move(issue: Issue, to: StatusCategory) {
    setBusyKey(issue.key)
    setMoveError(undefined)
    // Optimistic: show the card in its new column while the change lands.
    setIssues((list) => list?.map((i) => (i.key === issue.key && i.source === issue.source ? { ...i, statusCategory: to } : i)))
    try {
      let transitionId: string | undefined
      if (issue.source === 'local') transitionId = LOCAL_STATUS_FOR[to]
      else {
        const detail = await jiraApi().getIssue({ source: issue.source, key: issue.key })
        transitionId = detail.transitions.find((t) => t.toCategory === to)?.id
        if (!transitionId) throw new Error(`${issue.key} has no transition to ${LOCAL_STATUS_FOR[to]} in its Jira workflow.`)
      }
      await jiraApi().transitionIssue({ source: issue.source, key: issue.key, transitionId })
    } catch (e) {
      setMoveError(errorText(e))
    } finally {
      setBusyKey(undefined)
      void refresh()
    }
  }

  return { issues, error: error ?? moveError, busyKey, move }
}
