import { formatRelative } from '@/lib/format'

import { Avatar, Lozenge, PriorityIcon, ProjectAvatar, TypeIcon } from '../bits'
import { formatDuration } from '../time'
import type { Issue } from '../types'
import { ParentChip } from './Parent'

interface IssueListProps {
  issues: Issue[]
  showProject?: boolean
  onOpen: (issue: Issue) => void
  empty?: string
}

/** Jira's list view: a dense table, one row per ticket. */
export function IssueList({ issues, showProject, onOpen, empty = 'No issues match.' }: IssueListProps) {
  if (!issues.length) {
    return <div className="rounded-[3px] border border-(--jp-border) px-6 py-12 text-center text-(--jp-subtle)">{empty}</div>
  }
  // Only show the Logged column once there is time to show.
  const logged = issues.some((i) => i.timeSpentSeconds)
  return (
    <div className="overflow-x-auto rounded-[3px] border border-(--jp-border)">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-(--jp-border) text-left text-xs font-semibold text-(--jp-subtle)">
            <th className="w-8 px-3 py-2"><span className="sr-only">Type</span></th>
            <th className="w-28 px-2 py-2">Key</th>
            <th className="px-2 py-2">Summary</th>
            {showProject && <th className="px-2 py-2">Project</th>}
            <th className="px-2 py-2">Expected end</th>
            <th className="px-2 py-2">Status</th>
            <th className="w-12 px-2 py-2">P</th>
            {logged && <th className="w-20 px-2 py-2 text-right">Logged</th>}
            <th className="px-2 py-2">Assignee</th>
            <th className="w-28 px-3 py-2 text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr
              key={`${i.source}:${i.key}`}
              tabIndex={0}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(i)
                }
              }}
              className="jp-focusable h-10 cursor-pointer border-b border-(--jp-border) outline-none last:border-b-0 hover:bg-(--jp-hover)"
            >
              <td className="px-3"><TypeIcon type={i.type} /></td>
              <td className="px-2 whitespace-nowrap"><span className="jp-link">{i.key}</span></td>
              <td className="max-w-0 px-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{i.summary}</span>
                  {i.parent && <ParentChip parent={i.parent} withSummary={false} className="shrink-0" />}
                </div>
              </td>
              {showProject && (
                <td className="px-2 whitespace-nowrap">
                  <span className="flex items-center gap-2 text-(--jp-subtle)">
                    <ProjectAvatar projectKey={i.projectKey} size={16} />
                    {i.projectName ?? i.projectKey}
                  </span>
                </td>
              )}
              <td className="px-2 whitespace-nowrap">{i.dueDate || "—"}</td>
              <td className="px-2 whitespace-nowrap"><Lozenge status={i.status} category={i.statusCategory} /></td>
              <td className="px-2"><PriorityIcon priority={i.priority} /></td>
              {logged && (
                <td className="px-2 text-right font-mono text-xs whitespace-nowrap text-(--jp-subtle) tabular-nums">
                  {i.timeSpentSeconds ? formatDuration(i.timeSpentSeconds) : ''}
                </td>
              )}
              <td className="px-2 whitespace-nowrap">
                <span className="flex items-center gap-2 text-(--jp-subtle)">
                  <Avatar name={i.assignee} />
                  <span className="hidden xl:inline">{i.assignee ?? 'Unassigned'}</span>
                </span>
              </td>
              <td className="px-3 text-right whitespace-nowrap text-(--jp-subtle) tabular-nums">{formatRelative(i.updated)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
