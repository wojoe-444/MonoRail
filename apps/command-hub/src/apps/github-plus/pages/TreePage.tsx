import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import RefSelector from '../components/RefSelector'
import Breadcrumb from '../components/Breadcrumb'
import Markdown from '../components/Markdown'
import { Avatar } from '../components/CommitList'
import { FileIcon, FolderIcon, HistoryIcon, SubmoduleIcon } from '../components/Icons'
import { blobLink, commitLink, commitsLink, treeLink } from '../links'
import { fullDate, timeAgo } from '../util'
import { api } from '../api'

const README_RE = /^readme(\.(md|markdown|txt|rst))?$/i

export default function TreePage() {
  const { repo } = useRepo()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || ''
  const rp = repo!.path

  const tree = useAsync(() => api.listTree(rp, ref, path), [rp, ref, path])
  // Filled in after the list shows: it walks history, the list doesn't.
  const lastCommits = useAsync(() => api.treeLastCommits(rp, ref, path), [rp, ref, path])
  const last = lastCommits.loading ? null : lastCommits.data
  const latest = useAsync(() => api.getLog(rp, { ref, path: path || undefined, limit: 1 }), [rp, ref, path])
  const count = useAsync(() => api.countCommits(rp, ref), [rp, ref])
  const readme = tree.data?.find((e) => e.type === 'file' && README_RE.test(e.name))
  const readmeBlob = useAsync(async () => (readme ? api.readBlob(rp, ref, readme.path) : null), [rp, ref, readme?.path])

  const c = latest.data?.commits[0]
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

  return (
    <div>
      <div className="toolbar">
        <RefSelector value={ref} onChange={(r) => nav(treeLink(r, path))} />
        <Breadcrumb refName={ref} path={path} />
        <span className="spacer" />
        <Link className="btn" to={commitsLink(ref, path)}><HistoryIcon /> {count.data !== null && !path ? `${count.data} commit${count.data === 1 ? "" : "s"}` : 'History'}</Link>
      </div>
      {tree.error && <div className="flash error">{tree.error}</div>}
      <div className="box">
        <div className="box-head commit-bar">
          {c ? (
            <>
              <Avatar name={c.authorName} /> <strong>{c.authorName}</strong>
              <Link to={commitLink(c.sha)} className="commit-title ellipsis">{c.subject}</Link>
              <span className="spacer" />
              <Link to={commitLink(c.sha)} className="mono muted">{c.shortSha}</Link>
              <span className="muted" title={fullDate(c.date)}>{timeAgo(c.date)}</span>
            </>
          ) : <span className="muted">{latest.loading ? 'Loading…' : ''}</span>}
        </div>
        <table className="files">
          <tbody>
            {path && (
              <tr><td className="icon" /><td colSpan={3}><Link to={treeLink(ref, parent)}>..</Link></td></tr>
            )}
            {tree.data?.map((e) => (
              <tr key={e.path}>
                <td className="icon">{e.type === 'dir' ? <span className="folder"><FolderIcon /></span> : e.type === 'submodule' ? <SubmoduleIcon /> : <FileIcon />}</td>
                <td className="name">
                  {e.type === 'dir' ? <Link to={treeLink(ref, e.path)}>{e.name}</Link>
                    : e.type === 'submodule' ? <span title="Submodule">{e.name}</span>
                    : <Link to={blobLink(ref, e.path)}>{e.name}</Link>}
                </td>
                <td className="msg muted ellipsis">{last?.[e.name] && <Link to={commitLink(last[e.name].sha)}>{last[e.name].subject}</Link>}</td>
                <td className="when muted">{last?.[e.name] && <span title={fullDate(last[e.name].date)}>{timeAgo(last[e.name].date)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readme && readmeBlob.data?.kind === 'text' && (
        <div className="box readme">
          <div className="box-head"><FileIcon /> <strong>{readme.name}</strong></div>
          <div className="pad">
            {/\.(md|markdown)$/i.test(readme.name)
              ? <Markdown source={readmeBlob.data.content} refName={ref} baseDir={path} />
              : <pre className="plain">{readmeBlob.data.content}</pre>}
          </div>
        </div>
      )}
    </div>
  )
}
