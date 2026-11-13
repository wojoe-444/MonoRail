import { useEffect, useMemo, useState } from 'react'
import { navigate } from '@/lib/router'
import { api } from '../api'
import type { GitHubRepo, GitHubRepos, LinkedTask } from '../types'
import { openInJiraPlus } from '../../jira-plus/handoff'
import { fullDate, timeAgo } from '../util'
import { CloudIcon, ExternalIcon, RefreshIcon } from './Icons'

const LIMIT = 8
type Show = 'all' | 'yours' | 'teams'
const RELATION_LABEL = { owner: '', organization: 'Organization', collaborator: 'Shared with you' } as const

/** The last list shown, so coming back to Home paints at once. Memory only, like the backend's copy. */
let lastRepos: GitHubRepos | null = null

/**
 * "On GitHub": the user's github.com repositories that are not on this
 * computer yet (owned, shared with them, and their organizations'). Nothing is
 * fetched until GitHub is set up on the Connections page.
 */
export default function GitHubRepoList({ filter, localGitHub, onCloned, taskCounts }: {
  filter: string
  /** tasks linked per lowercased "owner/name". */
  taskCounts?: Record<string, number>
  /** Lowercased "owner/name" of the github.com remotes of the local repos, to leave those out. */
  localGitHub: Set<string>
  /** Called with the cloned repo's path; the home page opens it. */
  onCloned(path: string): void
}) {
  const [data, setData] = useState<GitHubRepos | null>(lastRepos)
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState<Show>('all')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchList = (force: boolean) =>
    api.githubRepos(force).then(
      (d) => { lastRepos = d; setData(d) },
      (e: Error) => setError(e.message),
    ).finally(() => setLoading(false))
  const refresh = () => { setLoading(true); setError(null); void fetchList(true) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchList(false) }, [])

  const remote = useMemo(() => (data?.repos ?? []).filter((r) => !localGitHub.has(r.fullName.toLowerCase())), [data, localGitHub])
  const onComputer = (data?.repos.length ?? 0) - remote.length
  const q = filter.toLowerCase()
  const shown = remote.filter((r) =>
    (show === 'all' || (show === 'yours' ? r.relation === 'owner' : r.relation !== 'owner')) &&
    (!q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)))
  const listed = showAll || filter ? shown : shown.slice(0, LIMIT)

  const clone = async (r: GitHubRepo) => {
    setBusy(r.fullName); setError(null)
    try {
      const info = await api.cloneGitHubRepo(r.fullName)
      if (info) onCloned(info.path)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (data && !data.connected) {
    return (
      <div className="gh-section">
        <div className="side-head"><h2>On GitHub</h2></div>
        <p className="muted small">See your repositories on github.com here too, including your team’s. Set up GitHub on the Connections page first; nothing is fetched until you do.</p>
        <button className="btn" onClick={() => navigate('/connections')}>Set up GitHub…</button>
      </div>
    )
  }

  return (
    <div className="gh-section">
      <div className="side-head gh-head">
        <h2>On GitHub{data?.login && <span className="muted small"> · {data.login}</span>}</h2>
        <button className="icon-btn" title={data?.fetchedAt ? `Listed ${timeAgo(data.fetchedAt)}. Refresh` : 'Refresh'} aria-label="Refresh GitHub repositories" disabled={loading} onClick={refresh}><RefreshIcon /></button>
      </div>
      <div className="seg gh-seg" role="group" aria-label="Which repositories">
        {(['all', 'yours', 'teams'] as const).map((s) => (
          <button key={s} title={s === 'teams' ? 'Organization repositories and repositories shared with you' : undefined} className={show === s ? 'active' : ''} onClick={() => setShow(s)}>{s === 'all' ? 'All' : s === 'yours' ? 'Yours' : 'Teams'}</button>
        ))}
      </div>
      {!data && loading && <p className="muted small">Loading your repositories…</p>}
      {data?.error && <p className="small del">{data.error}</p>}
      {error && <p className="small del">{error}</p>}
      <ul className="repo-list">
        {listed.map((r) => {
          const open = selected === r.fullName
          return (
            <li key={r.fullName} className={`gh-item${open ? ' open' : ''}`}>
              <div className="repo-item">
                <button className="repo-link" title={r.description || r.fullName} aria-expanded={open} onClick={() => setSelected(open ? null : r.fullName)}>
                  <span className="repo-dot"><CloudIcon /></span>
                  <span className="ellipsis"><span className="gh-owner">{r.owner}/</span>{r.name}</span>
                  {r.private && <span className="badge">Private</span>}
                  {r.archived && <span className="badge">Archived</span>}
                  {(taskCounts?.[r.fullName.toLowerCase()] ?? 0) > 0 && <span className="badge" title="Tasks linked to this repository">{taskCounts![r.fullName.toLowerCase()]} task{taskCounts![r.fullName.toLowerCase()] === 1 ? '' : 's'}</span>}
                </button>
              </div>
              {open && (
                <div className="gh-detail small">
                  {r.description && <div className="muted">{r.description}</div>}
                  <div className="muted">
                    {[RELATION_LABEL[r.relation], r.fork && 'Fork', ].filter(Boolean).join(' · ')}
                    {r.pushedAt && <>{r.relation !== 'owner' || r.fork ? ' · ' : ''}<span title={fullDate(r.pushedAt)}>pushed {timeAgo(r.pushedAt)}</span></>}
                  </div>
                  {(taskCounts?.[r.fullName.toLowerCase()] ?? 0) > 0 && <RepoTasks fullName={r.fullName} />}
                  <div className="gh-actions">
                    <button className="btn" disabled={busy !== null} onClick={() => void clone(r)} title="Pick a folder; GitHub+ clones the repository into it and opens it">{busy === r.fullName ? 'Cloning…' : 'Clone…'}</button>
                    <button className="btn" onClick={() => void api.openOnGitHub(r.fullName).catch((e: Error) => setError(e.message))}>Open on GitHub <ExternalIcon /></button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
        {data && shown.length === 0 && (
          <li className="muted small pad-y">{filter ? 'No GitHub repositories match.' : remote.length === 0 && data.repos.length > 0 ? 'All of them are on this computer.' : 'No repositories here.'}</li>
        )}
      </ul>
      {!filter && shown.length > LIMIT && <button className="link-btn small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `Show all ${shown.length}`}</button>}
      {onComputer > 0 && <p className="muted small gh-note">{onComputer} more {onComputer === 1 ? 'is' : 'are'} already on this computer, listed above.</p>}
      {data?.truncated && <p className="muted small gh-note">Only your 1,000 most recently pushed repositories are listed.</p>}
    </div>
  )
}

/** tasks linked to a repo on GitHub, shown when its row is open. */
function RepoTasks({ fullName }: { fullName: string }) {
  const [tasks, setTasks] = useState<LinkedTask[] | null>(null)
  useEffect(() => {
    let live = true
    api.linkedTasksOnGitHub(fullName).then((t) => live && setTasks(t), () => live && setTasks([]))
    return () => { live = false }
  }, [fullName])
  if (!tasks?.length) return null
  return (
    <ul className="gh-tasks">
      {tasks.map((t) => (
        <li key={`${t.source}:${t.key}`}>
          <span className="mono muted">{t.key}</span>
          <button className="link-btn ellipsis" title="Open in Tasks" onClick={() => openInJiraPlus(t.source, t.key)}>{t.summary ?? t.key}</button>
        </li>
      ))}
    </ul>
  )
}
