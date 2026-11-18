import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { AlertIcon, BackupIcon, BranchIcon, CloudIcon, CodeIcon, CompareIcon, FolderIcon, HistoryIcon, IssueOpenIcon, RefreshIcon, TaskIcon } from '../components/Icons'
import { Avatar } from '../components/CommitList'
import { AheadBehind } from '../components/Dense'
import RefSelector from '../components/RefSelector'
import { fileManagerName, fullDate, timeAgo } from '../util'
import { hasLocalScreen } from '@/modules/client'
import { backupsLink, blobLink, commitLink, commitsLink, compareLink, issuesLink, tasksLink, treeLink } from '../links'

/** Pages whose content follows the ref in the URL: the branch picker in the tab row switches it. */
const REF_PAGES: Record<string, (ref: string, path: string) => string> = {
  '/repo/tree': treeLink,
  '/repo/blob': blobLink,
  '/repo/commits': (ref, path) => commitsLink(ref, path || undefined),
}

export default function RepoLayout() {
  const { repo, refresh, restoring } = useRepo()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [sp] = useSearchParams()
  const [tick, setTick] = useState(0)
  // Re-read the counts when moving between pages, so creating or closing an issue updates the tab.
  const counts = useAsync(() => (repo ? api.issueCounts(repo.path) : Promise.resolve(null)), [repo?.path, pathname])
  const taskCount = useAsync(() => (repo ? api.linkedTaskCount(repo.path) : Promise.resolve(0)), [repo?.path, pathname])
  const remote = useAsync(() => (repo ? api.githubTarget(repo.path) : Promise.resolve(null)), [repo?.path])
  if (!repo && restoring) return <div className="ghp-page muted">Opening repository…</div>
  if (!repo) return <Navigate to="/" replace />
  const ref = repo.defaultRef ?? 'HEAD'
  const refPage = REF_PAGES[pathname]
  const shownRef = sp.get('ref') || ref
  const tab = (to: string, icon: ReactNode, label: string, n?: number | null, title?: string, match?: RegExp) => (
    <NavLink to={to} title={title} className={() => ((match ?? new RegExp(`^${to.split('?')[0]}`)).test(pathname) ? 'active' : '')}>
      {icon} {label}{n ? <span className="n">{n}</span> : null}
    </NavLink>
  )
  return (
    <div className="ghp-page">
      <header className="ghp-head">
        <div className="min-w-0">
          <div className="eyebrow"><Link to="/" title="All repositories">GitHub+</Link> · Repository</div>
          <h1>
            {repo.name}
            <span className="ghp-chip">Local</span>
            {remote.data?.repo && <span className="ghp-chip info" title="Its github.com remote"><CloudIcon /> {remote.data.repo}</span>}
            {repo.linked && <span className="ghp-chip pri" title={`Created by ${repo.linked.label}`}>{repo.linked.label}</span>}
          </h1>
          <p className="sub mono">{repo.path}</p>
        </div>
        <div className="actions">
          {hasLocalScreen() && <button className="btn" onClick={() => api.openInExplorer(repo.path).catch((e) => window.alert(e instanceof Error ? e.message : String(e)))} title={`Open ${repo.path} in ${fileManagerName}`}><FolderIcon /> {fileManagerName}</button>}
          <button className="btn" onClick={() => { void refresh(); setTick((t) => t + 1) }} title="Read branches and the working folder again"><RefreshIcon /> Refresh</button>
          <button className="btn" onClick={() => nav('/')}>All repositories</button>
        </div>
      </header>

      <div className="ghp-bar">
        <nav className="ghp-tabs" aria-label="Repository">
          {tab(treeLink(ref, ''), <CodeIcon />, 'Code', null, undefined, /^\/repo\/(tree|blob)/)}
          {tab(commitsLink(ref), <HistoryIcon />, 'History', null, undefined, /^\/repo\/(commits|commit\/)/)}
          {tab(issuesLink(), <IssueOpenIcon />, 'Issues', counts.data?.open)}
          {tab(tasksLink(), <TaskIcon />, 'Tasks', taskCount.data, 'Tasks linked to this repository')}
          {tab('/repo/branches', <BranchIcon />, 'Branches')}
          {tab(compareLink(), <CompareIcon />, 'Compare')}
          {tab(backupsLink(), <BackupIcon />, 'Backups')}
        </nav>
        <span className="grow" />
        {refPage && <RefSelector value={shownRef} onChange={(r) => nav(refPage(r, sp.get('path') || ''))} />}
      </div>

      <StatusStrip repoPath={repo.path} defaultRef={ref} tick={tick} />

      {repo.isEmpty && !/^\/repo\/issues/.test(pathname) ? <div className="box pad">This repository has no commits yet.</div> : <Outlet />}
    </div>
  )
}

/** Facts about the working folder: against main, against its upstream, uncommitted files, backup, newest commit. */
function StatusStrip({ repoPath, defaultRef, tick }: { repoPath: string; defaultRef: string; tick: number }) {
  const ws = useAsync(() => api.workingState(repoPath), [repoPath, tick])
  const backup = useAsync(() => api.getBackup(repoPath), [repoPath, tick])
  const latest = useAsync(() => api.getLog(repoPath, { ref: defaultRef, limit: 1 }), [repoPath, defaultRef, tick])
  const s = ws.data
  const c = latest.data?.commits[0]
  const b = backup.data
  const dirty = s ? s.changed + s.untracked : 0
  return (
    <div className="ghp-strip" aria-label="Repository status">
      {ws.error && <div className="warn"><AlertIcon /> Could not read the working folder</div>}
      {!s && !ws.error && <div>Reading the working folder…</div>}
      {s?.base && (
        <div><AheadBehind ahead={s.base.ahead} behind={s.base.behind} label={s.base.name} max={Math.max(6, s.base.ahead, s.base.behind)} /> vs {s.base.name}</div>
      )}
      {s && (
        !s.upstream ? <div title="This branch does not track a branch on a remote">{s.branch ? 'Not tracking a remote branch' : 'No branch checked out'}</div>
          : s.ahead || s.behind ? (
            <div title={`Compared with ${s.upstream}, as of the last fetch`}>
              {s.ahead ? <span><span className="add mono">↑{s.ahead}</span> not pushed</span> : null}
              {s.behind ? <span><span className="del mono">↓{s.behind}</span> to pull</span> : null}
              <span className="mono">{s.upstream}</span>
            </div>
          ) : <div title="As of the last fetch">In step with <span className="mono">{s.upstream}</span></div>
      )}
      {s && (dirty
        ? <div className="fg" title={`${s.changed} changed, ${s.untracked} new`}><span className="ghp-dot warn" /><b>{dirty}</b> uncommitted file{dirty === 1 ? '' : 's'}</div>
        : <div>No uncommitted changes</div>)}
      {b && (!b.schedule
        ? <div><BackupIcon /> <Link to={backupsLink()}>No backup set up</Link></div>
        : b.lastResult && !b.lastResult.ok
          ? <div className="bad" title={b.lastResult.error}><AlertIcon /> <Link to={backupsLink()}>Backup failed {timeAgo(b.lastResult.at)}</Link></div>
          : <div><BackupIcon /> {b.lastSuccessAt ? <span title={fullDate(b.lastSuccessAt)}>Backed up {timeAgo(b.lastSuccessAt)}</span> : 'No backup yet'}</div>)}
      <span className="grow" />
      {c && (
        <div>
          <Avatar name={c.authorName} />
          <Link className="commit-link" to={commitLink(c.sha)} title={c.subject}>{c.subject}</Link>
          <Link className="mono muted" to={commitLink(c.sha)}>{c.shortSha}</Link>
          <span title={fullDate(c.date)}>{timeAgo(c.date)}</span>
        </div>
      )}
    </div>
  )
}
