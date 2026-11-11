import { useState } from 'react'
import type { DiffFile } from '../types'

function FileDiff({ file, id }: { file: DiffFile; id: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const name = file.status === 'renamed' ? `${file.oldPath} → ${file.newPath}` : file.newPath || file.oldPath
  return (
    <div className="diff-file" id={id}>
      <div className="diff-head" onClick={() => setCollapsed(!collapsed)}>
        <span className="caret">{collapsed ? '▸' : '▾'}</span>
        <span className={`status ${file.status}`}>{file.status}</span>
        <span className="mono">{name}</span>
        <span className="spacer" />
        <span className="add">+{file.additions}</span> <span className="del">−{file.deletions}</span>
      </div>
      {!collapsed && (
        file.binary ? <div className="pad muted">Binary file not shown</div>
        : file.hunks.length === 0 ? <div className="pad muted">No content changes</div>
        : (
          <table className="diff">
            <tbody>
              {file.hunks.map((h, hi) => [
                <tr key={`h${hi}`} className="hunk"><td className="ln" /><td className="ln" /><td className="lc">{h.header}</td></tr>,
                ...h.lines.map((l, li) => (
                  <tr key={`${hi}-${li}`} className={l.type}>
                    <td className="ln">{l.oldNo ?? ''}</td>
                    <td className="ln">{l.newNo ?? ''}</td>
                    <td className="lc">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : l.type === 'context' ? ' ' : ''}{l.content}</td>
                  </tr>
                ))
              ])}
            </tbody>
          </table>
        )
      )}
    </div>
  )
}

export default function DiffView({ files, truncated }: { files: DiffFile[]; truncated?: boolean }) {
  const adds = files.reduce((n, f) => n + f.additions, 0)
  const dels = files.reduce((n, f) => n + f.deletions, 0)
  return (
    <div>
      <div className="diff-summary">
        Showing <strong>{files.length} changed file{files.length === 1 ? '' : 's'}</strong> with{' '}
        <span className="add">{adds} additions</span> and <span className="del">{dels} deletions</span>.
      </div>
      <ul className="file-list">
        {files.map((f, i) => (
          <li key={i}><a href={`#f${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`f${i}`)?.scrollIntoView() }}>
            <span className={`status ${f.status}`}>{f.status[0].toUpperCase()}</span> {f.newPath || f.oldPath}
          </a></li>
        ))}
      </ul>
      {files.map((f, i) => <FileDiff key={i} id={`f${i}`} file={f} />)}
      {truncated && <div className="pad muted">Diff truncated: too large to display in full.</div>}
    </div>
  )
}
