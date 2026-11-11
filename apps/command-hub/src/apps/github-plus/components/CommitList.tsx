import { Link } from 'react-router-dom'
import type { CommitSummary } from '../types'
import { commitLink, treeLink } from '../links'
import { dayKey, fullDate, timeAgo } from '../util'

export function Avatar({ name }: { name: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return <span className="avatar" style={{ background: `hsl(${h} 45% 40%)` }}>{(name[0] ?? '?').toUpperCase()}</span>
}

export default function CommitList({ commits }: { commits: CommitSummary[] }) {
  const groups: [string, CommitSummary[]][] = []
  for (const c of commits) {
    const k = dayKey(c.date)
    const last = groups[groups.length - 1]
    if (last && last[0] === k) last[1].push(c)
    else groups.push([k, [c]])
  }
  return (
    <div>
      {groups.map(([day, list]) => (
        <section key={day} className="commit-group">
          <h3 className="muted">Commits on {day}</h3>
          <div className="box">
            {list.map((c) => (
              <div className="commit-row" key={c.sha}>
                <div className="commit-main">
                  <Link className="commit-title" to={commitLink(c.sha)}>{c.subject}</Link>
                  {c.refs.map((r) => <span className="badge" key={r}>{r.replace('HEAD -> ', '')}</span>)}
                  <div className="muted small"><Avatar name={c.authorName} /> <strong>{c.authorName}</strong> committed <span title={fullDate(c.date)}>{timeAgo(c.date)}</span></div>
                </div>
                <div className="commit-actions">
                  <Link className="btn mono" to={commitLink(c.sha)}>{c.shortSha}</Link>
                  <Link className="btn" to={treeLink(c.sha, '')} title="Browse repository at this point">&lt;&gt;</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
