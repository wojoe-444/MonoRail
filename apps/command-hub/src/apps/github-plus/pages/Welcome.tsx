import { useNavigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { RepoIcon } from '../components/Icons'

export default function Welcome() {
  const { open, pick, error, recents, forget, initOffer, settings, saveSettings } = useRepo()
  const nav = useNavigate()
  const go = (dir: string): void => { open(dir).then(() => nav('/repo/tree'), () => undefined) }
  return (
    <div className="welcome">
      <h1>GitHub+</h1>
      <p className="muted">Browse any local git repository the way you would on GitHub. Nothing leaves this machine.</p>
      <button className="btn primary big" onClick={() => pick().then((ok) => ok && nav('/repo/tree'), () => undefined)}>Open a repository…</button>
      {error && !initOffer && <div className="flash error">{error}</div>}
      {recents.length > 0 && (
        <div className="box recents">
          <div className="box-head">Recent repositories</div>
          {recents.map((p) => (
            <div className="recent-row" key={p}>
              <button className="row-link" onClick={() => go(p)}><RepoIcon /> <span className="mono ellipsis">{p}</span></button>
              <button className="icon-btn" title="Remove from recent repositories" aria-label={`Remove ${p} from recent repositories`} onClick={() => forget(p)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="box recents">
        <div className="box-head">Settings</div>
        <div className="pad">
          <label className="check-row normal">
            <input type="checkbox" checked={settings.autoInitFolders} onChange={(e) => void saveSettings({ ...settings, autoInitFolders: e.target.checked })} />
            Make plain folders into git repositories without asking
          </label>
          <div className="small muted settings-hint">When off, GitHub+ explains what will happen and asks first. Large and secret-looking files are left out either way.</div>
        </div>
      </div>
    </div>
  )
}
