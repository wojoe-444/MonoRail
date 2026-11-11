import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { formatSize } from '../util'

/**
 * Shown when the user opens a plain folder: explains what "make this a git
 * repo" does, previews what the first snapshot would hold, and flags large or
 * sensitive-looking files before anything is written.
 */
export default function InitOffer() {
  const { initOffer: p, confirmInit, cancelInit, error } = useRepo()
  const nav = useNavigate()
  const [excludeLarge, setExcludeLarge] = useState(true)
  const [excludeSensitive, setExcludeSensitive] = useState(true)
  const [always, setAlways] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!p) return null

  const go = async () => {
    setBusy(true)
    try {
      await confirmInit({ excludeLarge, excludeSensitive }, always)
      nav('/repo/tree')
    } catch {
      /* error shown below */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ghp-init-title">
      <div className="modal box">
        <div className="box-head"><strong id="ghp-init-title">“{p.name}” isn’t a git repository yet</strong></div>
        <div className="pad">
          <p className="muted small mono ellipsis" title={p.path}>{p.path}</p>
          <p>GitHub+ can make it one, so you can browse its history here.</p>
          <ul className="explain">
            <li>Adds one hidden <span className="mono">.git</span> folder. Your files stay where they are and are not changed.</li>
            <li>Takes a first snapshot of {p.truncated ? 'more than ' : ''}<strong>{p.fileCount.toLocaleString()} files</strong> ({formatSize(p.totalBytes)}). The snapshot roughly doubles the space those files use.</li>
            <li>Stays on this computer: no remote, nothing is uploaded.</li>
            <li>To undo, delete the <span className="mono">.git</span> folder.</li>
          </ul>

          {(p.large.length > 0 || p.sensitive.length > 0) && (
            <div className="flash warn">
              {p.large.length > 0 && (
                <label className="check-row">
                  <input type="checkbox" checked={excludeLarge} onChange={(e) => setExcludeLarge(e.target.checked)} />
                  Leave out {p.large.length} large file{p.large.length === 1 ? '' : 's'} (over {formatSize(p.largeThresholdBytes)})
                </label>
              )}
              {p.large.length > 0 && <ul className="file-names">{p.large.slice(0, 5).map((f) => <li key={f.path}><span className="mono">{f.path}</span> · {formatSize(f.size)}</li>)}</ul>}
              {p.sensitive.length > 0 && (
                <label className="check-row">
                  <input type="checkbox" checked={excludeSensitive} onChange={(e) => setExcludeSensitive(e.target.checked)} />
                  Leave out {p.sensitive.length} file{p.sensitive.length === 1 ? '' : 's'} that may hold secrets
                </label>
              )}
              {p.sensitive.length > 0 && <ul className="file-names">{p.sensitive.slice(0, 5).map((f) => <li key={f} className="mono">{f}</li>)}</ul>}
              <div className="small muted">Left-out files are listed in <span className="mono">.gitignore</span> and stay in the folder.</div>
            </div>
          )}

          <label className="check-row normal">
            <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
            Do this automatically for plain folders from now on
          </label>
          {error && <div className="flash error">{error}</div>}
        </div>
        <div className="box-foot">
          <button className="btn" onClick={cancelInit} disabled={busy}>Cancel</button>
          <button className="btn primary" onClick={go} disabled={busy}>{busy ? 'Setting up…' : 'Make this a git repo'}</button>
        </div>
      </div>
    </div>
  )
}
