import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { LocalChip, Lozenge, ProjectAvatar, TypeIcon } from '../bits'
import { projectPath, useJira } from '../JiraContext'
import { useIssues } from '../useIssues'
import type { Issue } from '../types'
import { ErrorNote } from '../components/Modal'

/** Landing page: your projects as cards, then every open issue across private and team projects. */
export function YourWork() {
  const { projects, openIssue, openDialog } = useJira()
  const { issues, error } = useIssues('all')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tab = params.get('tab') === 'done' ? 'done' : 'open'

  const shown = useMemo(() => {
    const needle = q.toLowerCase()
    return (issues ?? []).filter(
      (i) =>
        (tab === 'done' ? i.statusCategory === 'done' : i.statusCategory !== 'done') &&
        (!needle || i.key.toLowerCase().includes(needle) || i.summary.toLowerCase().includes(needle) || i.labels.some((l) => l.toLowerCase().includes(needle))),
    )
  }, [issues, q, tab])

  const groups: [string, Issue[]][] =
    tab === 'done'
      ? [['Done recently', shown]]
      : [
          ['In progress', shown.filter((i) => i.statusCategory === 'in_progress')],
          ['To do', shown.filter((i) => i.statusCategory === 'todo')],
        ]

  const setTab = (t: 'open' | 'done') =>
    setParams((p) => {
      if (t === 'done') p.set('tab', 'done')
      else p.delete('tab')
      return p
    })

  return (
    <div className="mx-auto max-w-[1200px] px-10 py-8">
      <h1 className="text-2xl font-medium">Your work</h1>

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-semibold text-(--jp-subtle)">Projects</h2>
        <Link to="/projects" className="jp-link">
          View all projects
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {projects.slice(0, 7).map((p) => (
          <Link
            key={`${p.source}:${p.key}`}
            to={projectPath(p)}
            className="jp-focusable group flex flex-col overflow-hidden rounded-[3px] bg-(--jp-raised) shadow-(--jp-shadow-raised) outline-none hover:shadow-(--jp-shadow-overlay)"
          >
            <div className="flex gap-3 border-l-[24px] p-4 pl-3" style={{ borderColor: p.source === 'local' ? 'var(--jp-local)' : 'var(--jp-brand)' }}>
              <ProjectAvatar projectKey={p.key} size={32} local={p.source === 'local'} className="-ml-7" />
              <div className="min-w-0">
                <div className="truncate font-semibold group-hover:underline">{p.name}</div>
                <div className="text-xs text-(--jp-subtle)">{p.source === 'local' ? 'Private project' : 'Team project'}</div>
              </div>
            </div>
            <div className="px-4 pb-4 text-xs">
              <div className="jp-overline mb-1">Quick links</div>
              <div className="flex justify-between text-(--jp-subtle)">
                <span>Open issues</span>
                <span className="rounded-full bg-(--jp-hover) px-2 font-semibold">{p.openCount}</span>
              </div>
            </div>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => openDialog('project')}
          className="jp-focusable flex min-h-28 items-center justify-center rounded-[3px] border-2 border-dashed border-(--jp-border) text-(--jp-subtle) outline-none hover:bg-(--jp-hover)"
        >
          + Create private project
        </button>
      </div>

      <div className="mt-10 flex items-center gap-6 border-b-2 border-(--jp-border)">
        {(['open', 'done'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'jp-focusable -mb-0.5 border-b-2 pb-2 font-medium outline-none',
              tab === t ? 'border-(--jp-selected-fg) text-(--jp-selected-fg)' : 'border-transparent text-(--jp-subtle) hover:text-(--jp-text)',
            )}
          >
            {t === 'open' ? 'Assigned to me' : 'Done'}
            {t === 'open' && issues && <span className="ml-2 rounded-full bg-(--jp-hover) px-2 text-xs">{(issues ?? []).filter((i) => i.statusCategory !== 'done').length}</span>}
          </button>
        ))}
        {q && (
          <span className="ml-auto pb-2 text-(--jp-subtle)">
            Matching “{q}” ·{' '}
            <button type="button" className="jp-link" onClick={() => setParams({})}>
              Clear
            </button>
          </span>
        )}
      </div>

      <ErrorNote error={error} className="mt-4" />
      {!issues && !error && (
        <div className="flex items-center gap-2 py-8 text-(--jp-subtle)">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      )}
      {issues &&
        groups.map(([label, list]) =>
          list.length ? (
            <section key={label} className="mt-6">
              <h3 className="jp-overline mb-2">{label}</h3>
              <ul>
                {list.map((i) => (
                  <li key={`${i.source}:${i.key}`}>
                    <button
                      type="button"
                      onClick={() => openIssue(i.source, i.key)}
                      className="jp-focusable flex w-full items-center gap-3 rounded-[3px] px-2 py-2 text-left outline-none hover:bg-(--jp-hover)"
                    >
                      <TypeIcon type={i.type} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{i.summary}</span>
                        <span className="flex items-center gap-1.5 text-xs text-(--jp-subtle)">
                          {i.key} · {i.projectName ?? i.projectKey}
                          {i.source === 'local' && <LocalChip />}
                        </span>
                      </span>
                      <Lozenge status={i.status} category={i.statusCategory} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      {issues && shown.length === 0 && (
        <p className="py-12 text-center text-(--jp-subtle)">{tab === 'done' ? 'Nothing done in the last 14 days.' : 'Nothing open. Create an issue to get started.'}</p>
      )}
    </div>
  )
}
