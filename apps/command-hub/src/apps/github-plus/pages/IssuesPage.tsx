import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { CommentIcon, IssueClosedIcon, IssueOpenIcon } from '../components/Icons'
import { issueLink, newIssueLink } from '../links'
import { fullDate, timeAgo } from '../util'

/** Local issues for the open repo, kept inside the repo itself (refs/local-issues). */
export default function IssuesPage() {
  const { repo } = useRepo()
  const rp = repo!.path
  const [params, setParams] = useSearchParams()
  const state = params.get('state') === 'closed' ? 'closed' : 'open'
  const [filter, setFilter] = useState('')
  const counts = useAsync(() => api.issueCounts(rp), [rp])
  const list = useAsync(() => api.listIssues(rp, state), [rp, state])
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (list.data ?? []).filter((i) => !q || i.title.toLowerCase().includes(q) || `#${i.number}` === q || String(i.number) === q)
  }, [list.data, filter])

  return (
    <div>
      <div className="toolbar">
        <input className="search grow-input" placeholder="Filter issues by title or number" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter issues" />
        <span className="spacer" />
        <Link className="btn primary" to={newIssueLink()}>New issue</Link>
      </div>
      {list.error && <div className="flash error">{list.error}</div>}
      <div className="box">
        <div className="box-head issue-states">
          <button className={state === 'open' ? 'active' : ''} onClick={() => setParams({})}><IssueOpenIcon /> {counts.data?.open ?? '…'} Open</button>
          <button className={state === 'closed' ? 'active' : ''} onClick={() => setParams({ state: 'closed' })}><IssueClosedIcon /> {counts.data?.closed ?? '…'} Closed</button>
        </div>
        {list.loading && !list.data && <div className="pad muted">Loading…</div>}
        {list.data && shown.length === 0 && (
          <div className="pad center empty">
            <IssueOpenIcon />
            <h3>{filter ? 'No issues match' : state === 'open' ? 'No open issues' : 'No closed issues'}</h3>
            {!filter && state === 'open' && (
              <p className="muted">Issues are notes about bugs, ideas and to-dos for this repository. They are saved inside the repository, in its git history, and never leave this computer unless you copy the repository.</p>
            )}
          </div>
        )}
        {shown.map((i) => (
          <div key={i.number} className="issue-row">
            <span className={i.state === 'open' ? 'issue-open' : 'issue-closed'}>{i.state === 'open' ? <IssueOpenIcon /> : <IssueClosedIcon />}</span>
            <div className="feed-main">
              <Link className="issue-title" to={issueLink(i.number)}>{i.title}</Link>
              {i.github && <span className="badge" title={`Also created on GitHub as ${i.github.repo}#${i.github.number}`}>GitHub #{i.github.number}</span>}
              <div className="muted small">
                #{i.number}{' '}
                {i.state === 'open'
                  ? <>opened <span title={fullDate(i.createdAt)}>{timeAgo(i.createdAt)}</span> by {i.author}</>
                  : <>by {i.author} was closed <span title={fullDate(i.closedAt ?? i.updatedAt)}>{timeAgo(i.closedAt ?? i.updatedAt)}</span></>}
              </div>
            </div>
            {i.comments > 0 && <Link className="muted small issue-comments" to={issueLink(i.number)} title={`${i.comments} comments`}><CommentIcon /> {i.comments}</Link>}
          </div>
        ))}
      </div>
      <p className="muted small">
        Stored in this repository under <span className="mono">refs/local-issues</span>, so they are included in backups and are not sent by a normal <span className="mono">git push</span>.
      </p>
    </div>
  )
}
