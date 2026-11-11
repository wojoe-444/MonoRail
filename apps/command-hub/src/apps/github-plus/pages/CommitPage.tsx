import { Link, useParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import DiffView from '../components/DiffView'
import { Avatar } from '../components/CommitList'
import { commitLink, treeLink } from '../links'
import { fullDate, timeAgo } from '../util'
import { api } from '../api'

export default function CommitPage() {
  const { repo } = useRepo()
  const { sha = '' } = useParams()
  const { data: c, error, loading } = useAsync(() => api.getCommit(repo!.path, sha), [repo!.path, sha])
  if (error) return <div className="flash error">{error}</div>
  if (loading || !c) return <div className="pad muted">Loading…</div>
  return (
    <div>
      <div className="box">
        <div className="box-head"><h2 className="commit-subject">{c.subject}</h2></div>
        {c.body && <pre className="pad plain">{c.body}</pre>}
        <div className="box-head commit-bar">
          <Avatar name={c.authorName} /> <strong>{c.authorName}</strong>
          <span className="muted">committed <span title={fullDate(c.date)}>{timeAgo(c.date)}</span></span>
          <span className="spacer" />
          {c.parents.length > 0 && (
            <span className="muted">{c.parents.length > 1 ? 'parents' : 'parent'}{' '}
              {c.parents.map((p) => <Link key={p} className="mono" to={commitLink(p)}>{p.slice(0, 7)} </Link>)}
            </span>
          )}
          <span className="muted">commit <span className="mono">{c.sha}</span></span>
          <Link className="btn" to={treeLink(c.sha, '')}>Browse files</Link>
        </div>
      </div>
      {c.parents.length > 1 && <div className="flash warn">Merge commit: showing changes relative to the first parent.</div>}
      <DiffView files={c.files} truncated={c.truncated} />
    </div>
  )
}
