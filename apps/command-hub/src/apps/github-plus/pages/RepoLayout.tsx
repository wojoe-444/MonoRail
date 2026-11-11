import { Link, NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { RepoIcon, CodeIcon, CommitIcon, BranchIcon, CompareIcon, BackupIcon } from '../components/Icons'
import { backupsLink, commitsLink, compareLink, treeLink } from '../links'

export default function RepoLayout() {
  const { repo, refresh, pick, restoring } = useRepo()
  const nav = useNavigate()
  if (!repo && restoring) return <div className="pad muted center">Opening repository…</div>
  if (!repo) return <Navigate to="/" replace />
  const ref = repo.defaultRef ?? 'HEAD'
  return (
    <div>
      <header className="topbar">
        <Link to="/" className="brand" title="GitHub+ home: open a repository">GitHub<span className="brand-plus">+</span></Link>
        <span className="spacer" />
        <button className="btn" onClick={() => refresh()} title="Re-read branches from disk">Refresh</button>
        <button className="btn" onClick={() => pick().then((ok) => ok && nav('/repo/tree'))}>Open…</button>
      </header>
      <div className="repo-head">
        <div className="repo-title"><RepoIcon /> <strong>{repo.name}</strong> <span className="badge">Local</span></div>
        <div className="muted small mono">{repo.path}</div>
        <nav className="tabs">
          <NavLink to={treeLink(ref, '')} className={({ isActive }) => (isActive ? 'active' : '')} end={false}><CodeIcon /> Code</NavLink>
          <NavLink to={commitsLink(ref)}><CommitIcon /> Commits</NavLink>
          <NavLink to="/repo/branches"><BranchIcon /> Branches</NavLink>
          <NavLink to={compareLink()}><CompareIcon /> Compare</NavLink>
          <NavLink to={backupsLink()}><BackupIcon /> Backups</NavLink>
        </nav>
      </div>
      <main className="repo-container">
        {repo.isEmpty ? <div className="box pad">This repository has no commits yet.</div> : <Outlet />}
      </main>
    </div>
  )
}
