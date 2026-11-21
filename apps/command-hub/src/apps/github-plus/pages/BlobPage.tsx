import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import Breadcrumb from '../components/Breadcrumb'
import FileTree from '../components/FileTree'
import CodeView from '../components/CodeView'
import LineHistoryPanel from '../components/LineHistory'
import Markdown from '../components/Markdown'
import { Avatar } from '../components/CommitList'
import { CopyIcon, HistoryIcon } from '../components/Icons'
import { blobLink, commitLink, commitsLink } from '../links'
import { basename, dirname, formatSize, timeAgo } from '../util'
import { api } from '../api'

export default function BlobPage() {
  const { repo } = useRepo()
  const [sp, setSp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || ''
  // wt=1: the file as it is in the working folder (a search result found there).
  const working = sp.get('wt') === '1'
  const line = Number(sp.get('line')) || null
  const rp = repo!.path
  const [raw, setRaw] = useState(false)
  const [copied, setCopied] = useState(false)
  const [historyLine, setHistoryLine] = useState<number | null>(null)

  const blob = useAsync(() => (working ? api.readWorkingBlob(rp, path) : api.readBlob(rp, ref, path)), [rp, ref, path, working])
  const latest = useAsync(() => api.getLog(rp, { ref, path, limit: 1 }), [rp, ref, path])
  const c = latest.data?.commits[0]
  const b = blob.data
  const isMd = /\.(md|markdown)$/i.test(path)
  const lines = b?.kind === 'text' ? b.content.split('\n').length - (b.content.endsWith('\n') ? 1 : 0) : 0
  // A linked line shows the code, not the Markdown preview.
  const showRaw = raw || !!line

  // oxlint-disable-next-line react/set-state-in-effect -- Clear the selected history line when the displayed blob changes.
  useEffect(() => setHistoryLine(null), [rp, ref, path, working])
  useEffect(() => {
    if (!line || b?.kind !== 'text') return
    document.getElementById(`L${line}`)?.scrollIntoView({ block: 'center' })
  }, [line, b])

  const selectLine = (n: number) => {
    const next = new URLSearchParams(sp)
    next.set('line', String(n))
    setSp(next, { replace: true })
  }

  return (
    <div className="ghp-code">
      <FileTree refName={ref} current={path} isFile />
      <div className="min-w-0">
      <div className="toolbar">
        <Breadcrumb refName={ref} path={path} isFile />
      </div>
      {working && (
        <div className="flash warn">
          This is the file as it is in the working folder now, including changes that are not committed.{' '}
          <Link to={blobLink(ref, path, line ?? undefined)}>Show it as committed on {ref}</Link>
        </div>
      )}
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
          {b?.kind === 'text' && <span className="muted small">Click a line number to see when that line changed.</span>}
          <span className="spacer" />
          {isMd && b?.kind === 'text' && (
            <span className="seg">
              <button className={!showRaw ? 'active' : ''} onClick={() => setRaw(false)} disabled={!!line}>Preview</button>
              <button className={showRaw ? 'active' : ''} onClick={() => setRaw(true)}>Code</button>
            </span>
          )}
          {b?.kind === 'text' && (
            <button className="btn" onClick={() => navigator.clipboard.writeText(b.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
              <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <Link className="btn" to={commitsLink(ref, path)}><HistoryIcon /> History</Link>
        </div>
        {historyLine && (
          <LineHistoryPanel repoPath={rp} refName={working ? 'HEAD' : ref} path={path} line={historyLine} working={working} onClose={() => setHistoryLine(null)} />
        )}
        {blob.loading && <div className="pad muted">Loading…</div>}
        {b?.kind === 'text' && (
          <>
            {b.truncated && <div className="flash warn">File is large; showing the first 1 MB.</div>}
            {isMd && !showRaw
              ? <div className="pad"><Markdown source={b.content} refName={ref} baseDir={dirname(path)} /></div>
              : <div className="code-wrap"><CodeView code={b.content} path={path} selected={line} onLine={(n) => { selectLine(n); setHistoryLine(n) }} /></div>}
          </>
        )}
        {b?.kind === 'image' && <div className="pad center"><img className="preview" src={b.dataUrl} alt={basename(path)} /></div>}
        {b?.kind === 'binary' && <div className="pad center muted">Binary file ({formatSize(b.size)}) — not shown</div>}
        {b?.kind === 'toolarge' && <div className="pad center muted">File is too large to display ({formatSize(b.size)})</div>}
      </div>
      </div>
    </div>
  )
}
