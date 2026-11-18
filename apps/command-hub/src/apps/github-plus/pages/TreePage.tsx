import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import Breadcrumb from '../components/Breadcrumb'
import Markdown from '../components/Markdown'
import FileTree from '../components/FileTree'
import { CardHead } from '../components/Dense'
import { useCollapsed } from '../components/collapsed'
import { FileIcon, FolderIcon, HistoryIcon, SubmoduleIcon } from '../components/Icons'
import { blobLink, commitLink, commitsLink, treeLink } from '../links'
import { fullDate, timeAgo } from '../util'
import { api } from '../api'

const README_RE = /^readme(\.(md|markdown|txt|rst))?$/i

export default function TreePage() {
  const { repo } = useRepo()
  const [sp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || ''
  const rp = repo!.path
  const [listClosed, toggleList] = useCollapsed('folder')
  const [readmeClosed, toggleReadme] = useCollapsed('readme')

  const tree = useAsync(() => api.listTree(rp, ref, path), [rp, ref, path])
  // Filled in after the list shows: it walks history, the list doesn't.
  const lastCommits = useAsync(() => api.treeLastCommits(rp, ref, path), [rp, ref, path])
  const last = lastCommits.loading ? null : lastCommits.data
  const count = useAsync(() => api.countCommits(rp, ref), [rp, ref])
  const readme = tree.data?.find((e) => e.type === 'file' && README_RE.test(e.name))
  const readmeBlob = useAsync(async () => (readme ? api.readBlob(rp, ref, readme.path) : null), [rp, ref, readme?.path])
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

  return (
    <div className="ghp-code">
      <FileTree refName={ref} current={path} />
      <div className="min-w-0">
        {tree.error && <div className="flash error">{tree.error}</div>}
        <div className="ghp-card">
          <CardHead title={<Breadcrumb refName={ref} path={path} />} collapse={{ closed: listClosed, toggle: toggleList, label: 'the folder listing' }}>
            {tree.data && <span className="hint">{tree.data.length} item{tree.data.length === 1 ? '' : 's'}</span>}
            <Link className="act" to={commitsLink(ref, path || undefined)}>
              <HistoryIcon /> {count.data !== null && !path ? `${count.data} commit${count.data === 1 ? '' : 's'}` : 'History of this folder'}
            </Link>
          </CardHead>
          {!listClosed && (
            <table className="ghp-table">
              <thead><tr><th>Name</th><th>Last commit</th><th>Commit</th><th className="num">When</th></tr></thead>
              <tbody>
                {path && (
                  <tr><td colSpan={4}><Link to={treeLink(ref, parent)} className="muted" title="Up one folder">..</Link></td></tr>
                )}
                {tree.loading && !tree.data && <tr><td colSpan={4} className="muted">Loading…</td></tr>}
                {tree.data?.map((e) => {
                  const lc = last?.[e.name]
                  return (
                    <tr key={e.path}>
                      <td>
                        <span className="name-cell">
                          <span className={`tree-icon${e.type === 'dir' ? ' folder' : ''}`}>{e.type === 'dir' ? <FolderIcon /> : e.type === 'submodule' ? <SubmoduleIcon /> : <FileIcon />}</span>
                          {e.type === 'dir' ? <Link to={treeLink(ref, e.path)}>{e.name}</Link>
                            : e.type === 'submodule' ? <span title="Submodule">{e.name}</span>
                            : <Link to={blobLink(ref, e.path)}>{e.name}</Link>}
                        </span>
                      </td>
                      <td className="fill muted">{lc ? <Link className="muted" to={commitLink(lc.sha)} title={lc.subject}>{lc.subject}</Link> : <span />}</td>
                      <td className="mono muted">{lc ? <Link className="muted" to={commitLink(lc.sha)}>{lc.sha.slice(0, 7)}</Link> : ''}</td>
                      <td className="num muted">{lc ? <span title={fullDate(lc.date)}>{timeAgo(lc.date)}</span> : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {readme && readmeBlob.data?.kind === 'text' && (
          <div className="ghp-card">
            <CardHead title={<span className="title-ico"><FileIcon /><h2>{readme.name}</h2></span>} hint={path ? `in ${path}` : undefined} collapse={{ closed: readmeClosed, toggle: toggleReadme, label: readme.name }}>
              <Link className="act" to={blobLink(ref, readme.path)}>Open</Link>
            </CardHead>
            {!readmeClosed && (
              <div className="ghp-card-pad">
                {/\.(md|markdown)$/i.test(readme.name)
                  ? <Markdown source={readmeBlob.data.content} refName={ref} baseDir={path} />
                  : <pre className="plain">{readmeBlob.data.content}</pre>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
