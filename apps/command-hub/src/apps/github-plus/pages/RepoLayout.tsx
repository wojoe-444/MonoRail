import { Link, NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { RepoIcon, FolderIcon, CodeIcon, CommitIcon, BranchIcon, CompareIcon, BackupIcon, IssueOpenIcon } from '../components/Icons'
import { fileManagerName } from '../util'
import { backupsLink, commitsLink, compareLink, issuesLink, treeLink } from '../links'

export default function RepoLayout() {
  const { repo, refresh, pick, restoring } = useRepo()
  const nav = useNavigate()
  const { pathname } = useLocation()
  // Re-read the count when moving between pages, so creating or closing an issue updates the tab.
  const counts = useAsync(() => (repo ? api.issueCounts(repo.path) : Promise.resolve(null)), [repo?.path, pathname])
  if (!repo && restoring) return <div className="pad muted center">Opening repository…</div>
  if (!repo) return <Navigate to="/" replace />
  const ref = repo.defaultRef ?? 'HEAD'
  return (
    <div>
      <header className="topbar">
        <Link to="/" className="brand" title="GitHub+ home: open a repository">GitHub<span className="brand-plus">+</span></Link>
        <span className="spacer" />
        <button className="btn" onClick={() => api.openInExplorer(repo.path).catch((e) => window.alert(e instanceof Error ? e.message : String(e)))} title={`Open ${repo.path} in ${fileManagerName}`}><FolderIcon /> Open in {fileManagerName}</button>
        <button className="btn" onClick={() => refresh()} title="Re-read branches from disk">Refresh</button>
        <button className="btn" onClick={() => pick().then((ok) => ok && nav('/repo/tree'))}>Open…</button>
      </header>
      <div className="repo-head">
        <div className="repo-title"><RepoIcon /> <strong>{repo.name}</strong> <span className="badge">Local</span></div>
        <div className="muted small mono">{repo.path}</div>
        <nav className="tabs">
          <NavLink to={treeLink(ref, '')} className={({ isActive }) => (isActive ? 'active' : '')} end={false}><CodeIcon /> Code</NavLink>
          <NavLink to={commitsLink(ref)}><CommitIcon /> Commits</NavLink>
          <NavLink to={issuesLink()}><IssueOpenIcon /> Issues{counts.data?.open ? <span className="counter">{counts.data.open}</span> : null}</NavLink>
          <NavLink to="/repo/branches"><BranchIcon /> Branches</NavLink>
          <NavLink to={compareLink()}><CompareIcon /> Compare</NavLink>
          <NavLink to={backupsLink()}><BackupIcon /> Backups</NavLink>
        </nav>
      </div>
      <main className="repo-container">
        {repo.isEmpty && !/^\/repo\/issues/.test(pathname) ? <div className="box pad">This repository has no commits yet.</div> : <Outlet />}
      </main>
    </div>
  )
}
