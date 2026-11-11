import { formatRelative } from '@/lib/format'

import type { Issue } from '../types'
import { PersonAvatar, PriorityIcon, StatusBadge, TypeIcon } from './bits'

interface IssueTableProps {
  issues: Issue[]
  showProject?: boolean
  onOpen: (issue: Issue) => void
}

/** List view: one row per ticket, newest activity first. */
export function IssueTable({ issues, showProject, onOpen }: IssueTableProps) {
  if (!issues.length) {
    return <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">No tickets match.</div>
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-elevation-1">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-4 py-3 font-semibold">
              <span className="sr-only">Type</span>
            </th>
            <th className="w-28 px-2 py-3 font-semibold">Key</th>
            <th className="px-2 py-3 font-semibold">Summary</th>
            {showProject && <th className="hidden px-2 py-3 font-semibold lg:table-cell">Project</th>}
            <th className="px-2 py-3 font-semibold">Status</th>
            <th className="w-10 px-2 py-3 font-semibold">
              <span className="sr-only">Priority</span>
            </th>
            <th className="w-10 px-2 py-3 font-semibold">
              <span className="sr-only">Assignee</span>
            </th>
            <th className="hidden w-28 px-4 py-3 text-right font-semibold md:table-cell">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {issues.map((i) => (
            <tr
              key={i.key}
              tabIndex={0}
              onClick={() => onOpen(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpen(i)
                }
              }}
              className="cursor-pointer transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent"
            >
              <td className="px-4 py-2.5">
                <TypeIcon type={i.type} />
              </td>
              <td className="px-2 py-2.5 font-medium whitespace-nowrap text-muted-foreground">{i.key}</td>
              <td className="max-w-0 px-2 py-2.5">
                <div className="truncate font-medium">{i.summary}</div>
              </td>
              {showProject && (
                <td className="hidden px-2 py-2.5 whitespace-nowrap text-muted-foreground lg:table-cell">{i.projectName ?? i.projectKey}</td>
              )}
              <td className="px-2 py-2.5 whitespace-nowrap">
                <StatusBadge status={i.status} category={i.statusCategory} />
              </td>
              <td className="px-2 py-2.5">
                <PriorityIcon priority={i.priority} />
              </td>
              <td className="px-2 py-2.5">
                <PersonAvatar name={i.assignee} />
              </td>
              <td className="hidden px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                {formatRelative(i.updated)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
