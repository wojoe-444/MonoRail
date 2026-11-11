import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

import { LocalChip, ProjectAvatar } from '../bits'
import { projectPath, useJira } from '../JiraContext'

/** "Projects" directory: private and team projects in one table, as equals. */
export function ProjectsPage() {
  const { projects, overview, openDialog } = useJira()
  const connected = overview?.connection.connected
  return (
    <div className="mx-auto max-w-[1200px] px-10 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Projects</h1>
        <div className="flex gap-2">
          {!connected && (
            <button type="button" className="jp-btn" onClick={() => openDialog('connect')}>
              Connect team Jira
            </button>
          )}
          <button type="button" className="jp-btn jp-btn-primary" onClick={() => openDialog('project')}>
            Create private project
          </button>
        </div>
      </div>
      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-(--jp-border) text-left text-xs font-semibold text-(--jp-subtle)">
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Key</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2 text-right">Open issues</th>
            <th className="w-12 px-2 py-2"><span className="sr-only">Link</span></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={`${p.source}:${p.key}`} className="h-12 border-b border-(--jp-border) hover:bg-(--jp-hover)">
              <td className="px-2">
                <Link to={projectPath(p)} className="jp-link flex items-center gap-2">
                  <ProjectAvatar projectKey={p.key} local={p.source === 'local'} />
                  {p.name}
                </Link>
              </td>
              <td className="px-2 text-(--jp-subtle)">{p.key}</td>
              <td className="px-2">
                {p.source === 'local' ? (
                  <span className="flex items-center gap-2 text-(--jp-subtle)">
                    Private software project <LocalChip />
                  </span>
                ) : (
                  <span className="text-(--jp-subtle)">Team software project</span>
                )}
              </td>
              <td className="px-2 text-right tabular-nums">{p.openCount}</td>
              <td className="px-2">
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer" className="jp-btn jp-btn-subtle size-8 px-0" aria-label={`Open ${p.name} in Jira`}>
                    <ExternalLink />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!connected && (
        <p className="mt-6 text-(--jp-subtle)">
          Team projects appear here once you{' '}
          <button type="button" className="jp-link" onClick={() => openDialog('connect')}>
            connect your team Jira
          </button>
          .
        </p>
      )}
    </div>
  )
}
