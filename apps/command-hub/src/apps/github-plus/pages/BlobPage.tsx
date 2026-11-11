import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import RefSelector from '../components/RefSelector'
import Breadcrumb from '../components/Breadcrumb'
import CodeView from '../components/CodeView'
import Markdown from '../components/Markdown'
import { Avatar } from '../components/CommitList'
import { CopyIcon, HistoryIcon } from '../components/Icons'
import { blobLink, commitLink, commitsLink } from '../links'
import { basename, dirname, formatSize, timeAgo } from '../util'
import { api } from '../api'

export default function BlobPage() {
  const { repo } = useRepo()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || ''
  const rp = repo!.path
  const [raw, setRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const blob = useAsync(() => api.readBlob(rp, ref, path), [rp, ref, path])
  const latest = useAsync(() => api.getLog(rp, { ref, path, limit: 1 }), [rp, ref, path])
  const c = latest.data?.commits[0]
  const b = blob.data
  const isMd = /\.(md|markdown)$/i.test(path)
  const lines = b?.kind === 'text' ? b.content.split('\n').length - (b.content.endsWith('\n') ? 1 : 0) : 0

  return (
    <div>
      <div className="toolbar">
        <RefSelector value={ref} onChange={(r) => nav(blobLink(r, path))} />
        <Breadcrumb refName={ref} path={path} isFile />
      </div>
      {blob.error && <div className="flash error">{blob.error}</div>}
      <div className="box">
        <div className="box-head commit-bar">
          {c && <>
            <Avatar name={c.authorName} /> <strong>{c.authorName}</strong>
            <Link to={commitLink(c.sha)} className="commit-title ellipsis">{c.subject}</Link>
            <span className="spacer" />
            <Link to={commitLink(c.sha)} className="mono muted">{c.shortSha}</Link>
            <span className="muted">{timeAgo(c.date)}</span>
          </>}
        </div>
        <div className="box-head file-bar">
          <span className="muted">{b?.kind === 'text' ? `${lines} lines · ` : ''}{b ? formatSize(b.size) : ''}</span>
          <span className="spacer" />
          {isMd && b?.kind === 'text' && (
            <span className="seg">
              <button className={!raw ? 'active' : ''} onClick={() => setRaw(false)}>Preview</button>
              <button className={raw ? 'active' : ''} onClick={() => setRaw(true)}>Code</button>
            </span>
          )}
          {b?.kind === 'text' && (
            <button className="btn" onClick={() => navigator.clipboard.writeText(b.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
              <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <Link className="btn" to={commitsLink(ref, path)}><HistoryIcon /> History</Link>
        </div>
        {blob.loading && <div className="pad muted">Loading…</div>}
        {b?.kind === 'text' && (
          <>
            {b.truncated && <div className="flash warn">File is large; showing the first 1 MB.</div>}
            {isMd && !raw
              ? <div className="pad"><Markdown source={b.content} refName={ref} baseDir={dirname(path)} /></div>
              : <div className="code-wrap"><CodeView code={b.content} path={path} /></div>}
          </>
        )}
        {b?.kind === 'image' && <div className="pad center"><img className="preview" src={b.dataUrl} alt={basename(path)} /></div>}
        {b?.kind === 'binary' && <div className="pad center muted">Binary file ({formatSize(b.size)}) — not shown</div>}
        {b?.kind === 'toolarge' && <div className="pad center muted">File is too large to display ({formatSize(b.size)})</div>}
      </div>
    </div>
  )
}
