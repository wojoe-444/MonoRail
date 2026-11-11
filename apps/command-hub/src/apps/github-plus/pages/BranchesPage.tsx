import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { BranchIcon, TagIcon } from '../components/Icons'
import { commitLink, commitsLink, compareLink, treeLink } from '../links'
import { fullDate, timeAgo } from '../util'

export default function BranchesPage() {
  const { repo, refs } = useRepo()
  const [tab, setTab] = useState<'branch' | 'tag'>('branch')
  const base = repo!.defaultRef ?? 'HEAD'
  const list = refs.filter((r) => r.type === tab)
  // One git call for every branch (git 2.41+), asked for only on this page.
  const divergence = useAsync(() => api.branchDivergence(repo!.path, base), [repo!.path, base, refs])
  return (
    <div>
      <div className="toolbar">
        <span className="seg">
          <button className={tab === 'branch' ? 'active' : ''} onClick={() => setTab('branch')}><BranchIcon /> Branches ({refs.filter((r) => r.type === 'branch').length})</button>
          <button className={tab === 'tag' ? 'active' : ''} onClick={() => setTab('tag')}><TagIcon /> Tags ({refs.filter((r) => r.type === 'tag').length})</button>
        </span>
      </div>
      <div className="box">
        {list.map((r) => (
          <div className="branch-row" key={r.name}>
            <div className="branch-main">
              <Link className="branch-name mono" to={treeLink(r.name, '')}>{r.name}</Link>
              {r.isCurrent && <span className="badge">checked out</span>}
              {r.name === base && r.type === 'branch' && <span className="badge">default</span>}
              <div className="muted small ellipsis">
                <Link to={commitLink(r.sha)}>{r.subject}</Link> · {r.author} · <span title={fullDate(r.date)}>{timeAgo(r.date)}</span>
              </div>
            </div>
            {r.type === 'branch' && r.name !== base && (
              <span className="muted small" title={`vs ${base}`}>
                {divergence.data?.[r.name]
                  ? <><span className="add">{divergence.data[r.name].ahead} ahead</span> · <span className="del">{divergence.data[r.name].behind} behind</span></>
                  : divergence.loading ? '…' : null}
              </span>
            )}
            <Link className="btn" to={commitsLink(r.name)}>History</Link>
            {r.type === 'branch' && r.name !== base && <Link className="btn" to={compareLink(base, r.name)}>Compare</Link>}
          </div>
        ))}
        {list.length === 0 && <div className="pad muted center">None.</div>}
      </div>
    </div>
  )
}
