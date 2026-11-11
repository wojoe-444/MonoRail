import { useNavigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { RepoIcon } from '../components/Icons'

export default function Welcome() {
  const { open, pick, error, recents, forget } = useRepo()
  const nav = useNavigate()
  const go = (dir: string): void => { open(dir).then(() => nav('/repo/tree'), () => undefined) }
  return (
    <div className="welcome">
      <h1>GitHub+</h1>
      <p className="muted">Browse any local git repository the way you would on GitHub. Nothing leaves this machine.</p>
      <button className="btn primary big" onClick={() => pick().then((ok) => ok && nav('/repo/tree'), () => undefined)}>Open a repository…</button>
      {error && <div className="flash error">{error}</div>}
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
    </div>
  )
}
