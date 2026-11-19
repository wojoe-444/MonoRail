import { Link } from 'react-router-dom'
import { useAsync } from '../RepoContext'
import { api } from '../api'
import { Avatar } from './CommitList'
import { CloseIcon, HistoryIcon } from './Icons'
import { commitLink } from '../links'
import { fullDate, timeAgo } from '../util'

/** "Since when?" for one line: who last changed it, then every commit that changed it, with the lines it changed. */
export default function LineHistoryPanel({ repoPath, refName, path, line, working, onClose }: {
  repoPath: string
  refName: string
  path: string
  line: number
  working: boolean
  onClose: () => void
}) {
  const h = useAsync(() => api.lineHistory(repoPath, refName, path, line), [repoPath, refName, path, line])
  const d = h.data
  return (
    <section className="ghp-linehist" aria-label={`History of line ${line}`}>
      <div className="head">
        <HistoryIcon /> <strong>Line {line}</strong>
        {d?.last && (
          <span className="muted small">
            last changed by <b>{d.last.authorName}</b> <span title={fullDate(d.last.date)}>{timeAgo(d.last.date)}</span> in{' '}
            <Link to={commitLink(d.last.sha)} className="mono">{d.last.sha.slice(0, 7)}</Link>
          </span>
        )}
        <span className="spacer" />
        <button className="link-btn" onClick={onClose} aria-label="Close line history"><CloseIcon /></button>
      </div>
      {working && <div className="muted small pad-x">Read from the last commit (HEAD); line numbers can differ from the working file if it has uncommitted edits.</div>}
      {h.loading && <div className="pad muted">Reading the line's history…</div>}
      {h.error && <div className="flash error">{h.error}</div>}
      {d && d.commits.length === 0 && !h.loading && <div className="pad muted">No commit changed this line.</div>}
      {d && d.commits.length > 0 && (
        <ol className="list">
          {d.commits.map((c) => (
            <li key={c.sha}>
              <div className="row">
                <Avatar name={c.authorName} />
                <Link to={commitLink(c.sha)} className="title">{c.subject}</Link>
                <span className="spacer" />
                <span className="muted small">{c.authorName} · <span title={fullDate(c.date)}>{timeAgo(c.date)}</span></span>
                <Link to={commitLink(c.sha)} className="mono muted small">{c.shortSha}</Link>
              </div>
              {c.lines.length > 0 && (
                <pre className="diff">{c.lines.map((l, i) => <span key={i} className={l.kind}>{l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}{l.text}{'\n'}</span>)}</pre>
              )}
            </li>
          ))}
        </ol>
      )}
      {d?.truncated && <div className="pad muted small">Showing the newest {d.commits.length} changes.</div>}
    </section>
  )
}
