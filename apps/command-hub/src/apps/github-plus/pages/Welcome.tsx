import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { AlertIcon, CloseIcon, CloudIcon, CodeIcon, CompareIcon, FolderIcon, PlusIcon, RefreshIcon, RepoIcon } from '../components/Icons'
import { Avatar } from '../components/CommitList'
import GitHubRepoList from '../components/GitHubRepoList'
import { AheadBehind, CardHead, StateCell, TableScroll } from '../components/Dense'
import { commitLink, compareLink, issueLink, treeLink } from '../links'
import type { RepoActivity, WorkingState } from '../types'
import { fileManagerName, fullDate, timeAgo } from '../util'
import { hasLocalScreen } from '@/modules/client'

/** The last dashboard shown, so coming back to Home paints at once while it refreshes. Memory only. */
let lastActivity: RepoActivity[] | null = null
let lastStates: Record<string, WorkingState | null> | null = null

const UNIT_LABEL = { hour: 'hourly', day: 'daily', week: 'weekly' } as const
const VIEWS = ['overview', 'repos', 'activity', 'issues', 'backups'] as const
type View = (typeof VIEWS)[number]

/** GitHub+ home: the local repos you've opened (and the ones other MonoRail apps made), as dense tables. */
export default function Welcome() {
  const { open, pick, error, recents: opened, linked, forget, initOffer, settings, saveSettings } = useRepo()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const view: View = (VIEWS as readonly string[]).includes(sp.get('view') ?? '') ? (sp.get('view') as View) : 'overview'
  const setView = (v: View) => setSp(v === 'overview' ? {} : { view: v }, { replace: true })
  const [filter, setFilter] = useState('')
  const [tick, setTick] = useState(0)

  // Opened repos first, then repos other MonoRail apps created (Tasks), which are always listed.
  const recents = useMemo(() => [...opened, ...linked.map((l) => l.path).filter((p) => !opened.includes(p))], [opened, linked])
  const linkedBy = useMemo(() => new Map(linked.map((l) => [l.path, l])), [linked])
  const key = recents.join('\n')
  const fetched = useAsync(() => api.getActivity(), [key, tick])
  const fetchedStates = useAsync(() => api.getWorkingStates(), [key, tick])
  useEffect(() => { if (fetched.data) lastActivity = fetched.data }, [fetched.data])
  useEffect(() => { if (fetchedStates.data) lastStates = fetchedStates.data }, [fetchedStates.data])
  const repos = useMemo(() => fetched.data ?? (fetched.error ? [] : lastActivity ?? []), [fetched.data, fetched.error])
  const states = fetchedStates.data ?? lastStates ?? {}
  const loadingStates = fetchedStates.loading && !fetchedStates.data
  const byPath = useMemo(() => new Map(repos.map((r) => [r.path, r])), [repos])

  // task links per repo (Tasks' links file; no Jira request).
  const linkCounts = useAsync(() => api.linkCounts(), [tick])
  const taskCount = (p: string) => {
    const k = p.replace(/\\/g, '/').replace(/\/+$/, '')
    const c = linkCounts.data?.paths
    return c ? (c[k] ?? c[k.toLowerCase()] ?? 0) : 0
  }
  const openAt = (path: string, to: (r: RepoActivity | undefined) => string) => {
    open(path).then(() => nav(to(byPath.get(path))), () => undefined)
  }
  const openPicker = () => pick().then((ok) => ok && nav('/repo/tree'), () => undefined)
  const showInExplorer = (p: string) => api.openInExplorer(p).catch((e) => window.alert(e instanceof Error ? e.message : String(e)))
  // Local repos whose github.com remote is known, so the GitHub list leaves them out.
  const localGitHub = useMemo(() => new Set(repos.map((r) => r.github?.toLowerCase()).filter((x): x is string => !!x)), [repos])

  const nameOf = (p: string) => linkedBy.get(p)?.name ?? byPath.get(p)?.name ?? p.split(/[\\/]/).pop() ?? p
  const f = filter.trim().toLowerCase()
  const has = (...s: (string | null | undefined)[]) => !f || s.some((x) => x?.toLowerCase().includes(f))

  const repoRows = recents.filter((p) => has(nameOf(p), p, byPath.get(p)?.currentBranch))
  const branches = useMemo(
    () => repos.flatMap((r) => r.branches.filter((b) => !b.isDefault).map((b) => ({ repo: r, b }))).sort((a, b) => Date.parse(b.b.date) - Date.parse(a.b.date)),
    [repos],
  ).filter(({ repo, b }) => has(b.name, repo.name, b.author))
  const commits = useMemo(
    () => repos.flatMap((r) => r.commits.map((c) => ({ repo: r, c }))).sort((a, b) => Date.parse(b.c.date) - Date.parse(a.c.date)),
    [repos],
  ).filter(({ repo, c }) => has(c.subject, c.shortSha, c.authorName, repo.name))
  const openIssues = useMemo(
    () => repos.flatMap((r) => (r.issues ?? []).map((i) => ({ repo: r, i }))).sort((a, b) => Date.parse(b.i.updatedAt) - Date.parse(a.i.updatedAt)),
    [repos],
  ).filter(({ repo, i }) => has(i.title, repo.name))
  const backedUp = repos.filter((r) => r.backup && has(r.name))
  const issueTotal = repos.reduce((n, r) => n + (r.openIssues ?? 0), 0)

  const stateList = recents.map((p) => states[p]).filter((s): s is WorkingState => !!s)
  const notPushed = stateList.filter((s) => (s.ahead ?? 0) > 0).length
  const dirty = stateList.filter((s) => s.changed + s.untracked > 0).length
  const failedBackups = repos.filter((r) => r.backup?.lastResult && !r.backup.lastResult.ok)
  const unreadable = repos.filter((r) => r.error)
  const loading = fetched.loading && !fetched.data && !lastActivity

  const views: { v: View; label: string; n?: number }[] = [
    { v: 'overview', label: 'Overview' },
    { v: 'repos', label: 'Repositories', n: recents.length },
    { v: 'activity', label: 'Activity' },
    { v: 'issues', label: 'Issues', n: issueTotal },
    { v: 'backups', label: 'Backups', n: repos.filter((r) => r.backup).length },
  ]

  const branchTable = (limit: number) => (
    <div className="ghp-card">
      <CardHead title="Active branches" count={branches.length} hint="behind | ahead of each repository's checked-out branch">
        {view === 'overview' && branches.length > limit && <button className="link-btn act" onClick={() => setView('activity')}>All branches</button>}
      </CardHead>
      {loading ? <div className="ghp-empty-row">Loading…</div> : branches.length === 0 ? <div className="ghp-empty-row">{f ? 'No branches match.' : 'No branches besides the checked-out ones yet.'}</div> : (
        <TableScroll label="Active branches">
          <table className="ghp-table">
            <thead><tr><th>Branch</th><th>Repository</th><th>Behind | ahead</th><th aria-label="Author" /><th className="num">Updated</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {branches.slice(0, limit).map(({ repo, b }) => {
                const go = () => openAt(repo.path, (r) => compareLink(r?.defaultRef ?? undefined, b.name))
                return (
                  <tr key={repo.path + b.name}>
                    <td className="fill mono strong"><button className="link-btn ghp-plain" title={`${b.name}: ${b.subject}`} onClick={go}>{b.name}</button></td>
                    <td className="muted">{repo.name}</td>
                    <td>{b.ahead !== undefined ? <AheadBehind ahead={b.ahead} behind={b.behind ?? 0} label={repo.defaultRef ?? undefined} /> : <span className="muted">—</span>}</td>
                    <td title={b.author}><Avatar name={b.author} /></td>
                    <td className="num muted" title={fullDate(b.date)}>{timeAgo(b.date)}</td>
                    <td className="num"><button className="btn xs" title={`Compare with ${repo.defaultRef}`} onClick={go}><CompareIcon /> Compare</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  )

  const commitTable = (limit: number) => (
    <div className="ghp-card">
      <CardHead title="Recent commits" hint="all repositories, every branch">
        {view === 'overview' && commits.length > limit && <button className="link-btn act" onClick={() => setView('activity')}>Activity</button>}
      </CardHead>
      {loading ? <div className="ghp-empty-row">Loading…</div> : commits.length === 0 ? <div className="ghp-empty-row">{f ? 'No commits match.' : 'No commits yet.'}</div> : (
        <TableScroll label="Recent commits">
          <table className="ghp-table">
            <thead><tr><th>Commit</th><th>Message</th><th>Repository</th><th>Author</th><th className="num">When</th><th aria-label="Browse" /></tr></thead>
            <tbody>
              {commits.slice(0, limit).map(({ repo, c }) => (
                <tr key={repo.path + c.sha}>
                  <td className="mono muted">{c.shortSha}</td>
                  <td className="fill"><button className="link-btn ghp-plain" title={c.subject} onClick={() => openAt(repo.path, () => commitLink(c.sha))}>{c.subject}</button></td>
                  <td className="muted">{repo.name}</td>
                  <td><span className="who"><Avatar name={c.authorName} /><span className="muted">{c.authorName}</span></span></td>
                  <td className="num muted" title={fullDate(c.date)}>{timeAgo(c.date)}</td>
                  <td className="num"><button className="ghp-icon-btn" title="Browse the repository at this commit" aria-label="Browse the repository at this commit" onClick={() => openAt(repo.path, () => treeLink(c.sha, ''))}><CodeIcon /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  )

  const backupCell = (r: RepoActivity | undefined) => {
    const last = r?.backup?.lastResult
    if (!r?.backup) return <span className="muted">—</span>
    if (!last) return <span className="muted" title="Set up, no backup yet"><span className="ghp-dot off" /> none yet</span>
    if (!last.ok) return <span className="del" title={last.error}><span className="ghp-dot bad" /> failed</span>
    return <span className="muted" title={`Last backup ${fullDate(last.at)}`}><span className="ghp-dot ok" /> {timeAgo(last.at)}</span>
  }

  const repoName = (p: string) => {
    const r = byPath.get(p)
    const l = linkedBy.get(p)
    return (
      <span className="name-cell">
        <span className="ellipsis strong">{nameOf(p)}</span>
        {r?.github && <span className="muted" title={`Also on GitHub: ${r.github}`} aria-label={`Also on GitHub: ${r.github}`}><CloudIcon /></span>}
        {l && <span className="badge" title={`Created by ${l.label}. Always listed while it exists.`}>{l.label}</span>}
        {r?.error && <span className="badge" title={r.error}>{/not inside a git repository/.test(r.error) ? 'not a repo' : 'unavailable'}</span>}
      </span>
    )
  }

  const repoTable = (full: boolean) => (
    <div className="ghp-card">
      <CardHead title="Repositories" count={recents.length}>
        <button className="ghp-icon-btn" title="Open a repository" aria-label="Open a repository" onClick={openPicker}><PlusIcon /></button>
      </CardHead>
      {repoRows.length === 0 ? <div className="ghp-empty-row">{f ? 'No repositories match.' : 'Repositories you open show up here.'}</div> : (
        <TableScroll label="Repositories">
          <table className="ghp-table">
            <thead>
              <tr>
                <th>Name</th>
                {full && <th>Folder</th>}
                <th>HEAD</th>
                <th>State</th>
                {full && <th className="num">Issues</th>}
                {full && <th className="num">Tasks</th>}
                <th>Backup</th>
                {full && <th className="num">Last commit</th>}
                {full && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {repoRows.map((p) => {
                const r = byPath.get(p)
                const l = linkedBy.get(p)
                const last = r?.commits[0]
                return (
                  <tr key={p} className="clickable" title={p} onClick={() => openAt(p, () => '/repo/tree')}>
                    <td className={full ? '' : 'fill'}>{repoName(p)}</td>
                    {full && <td className="fill mono muted"><span>{p}</span></td>}
                    <td className="mono muted">{r?.currentBranch ?? (r?.error ? '' : '—')}</td>
                    <td><StateCell s={states[p]} loading={loadingStates} /></td>
                    {full && <td className="num muted">{r?.openIssues || ''}</td>}
                    {full && <td className="num muted">{taskCount(p) || ''}</td>}
                    <td>{backupCell(r)}</td>
                    {full && <td className="num muted">{last ? <span title={`${last.subject} (${fullDate(last.date)})`}>{timeAgo(last.date)}</span> : ''}</td>}
                    {full && (
                      <td className="num" onClick={(e) => e.stopPropagation()}>
                        <span className="row-actions">
                          {!r?.error && hasLocalScreen() && <button className="ghp-icon-btn" title={`Open in ${fileManagerName}`} aria-label={`Open ${nameOf(p)} in ${fileManagerName}`} onClick={() => showInExplorer(p)}><FolderIcon /></button>}
                          {!l && <button className="ghp-icon-btn" title="Remove from this list (the folder is not touched)" aria-label={`Remove ${nameOf(p)} from the list`} onClick={() => forget(p)}><CloseIcon /></button>}
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </div>
  )

  const empty = (
    <div className="ghp-card ghp-empty">
      <RepoIcon />
      <h3>Open your first repository</h3>
      <p>Pick any folder on this computer. A plain folder can be made into a git repository in one step.</p>
      <button className="btn primary big" onClick={openPicker}>Open a repository…</button>
    </div>
  )

  return (
    <div className="ghp-page">
      <header className="ghp-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>GitHub+</h1>
          <p className="sub">Your local repositories, side by side with the ones on github.com. Everything here is read from this computer.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => setTick((t) => t + 1)} title="Read every repository again"><RefreshIcon /> Refresh</button>
          <button className="btn primary" onClick={openPicker}><PlusIcon /> Open repository</button>
        </div>
      </header>

      <div className="ghp-bar">
        <div className="ghp-tabs" role="tablist" aria-label="View">
          {views.map(({ v, label, n }) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {label}{n ? <span className="n">{n}</span> : null}
            </button>
          ))}
        </div>
        <span className="grow" />
        <input className="search" placeholder="Find a repository, branch or commit…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find a repository, branch or commit" />
      </div>

      {error && !initOffer && <div className="flash error">{error}</div>}

      {view === 'overview' && (recents.length === 0 ? empty : (
        <>
          <div className="ghp-strip" aria-label="Summary">
            <div><b>{recents.length}</b> repositor{recents.length === 1 ? 'y' : 'ies'}</div>
            <div><b>{issueTotal}</b> open issue{issueTotal === 1 ? '' : 's'}</div>
            <div title="Repositories with commits that are not on their upstream branch yet"><b>{loadingStates ? '…' : notPushed}</b> not pushed</div>
            <div title="Repositories with changed or new files that are not committed"><b>{loadingStates ? '…' : dirty}</b> with uncommitted changes</div>
            <span className="grow" />
            {failedBackups.map((r) => (
              <div key={r.path} className="bad" title={r.backup?.lastResult && !r.backup.lastResult.ok ? r.backup.lastResult.error : undefined}>
                <AlertIcon /><span><b>{r.name}</b> backup failed</span>
                <button className="link-btn" onClick={() => openAt(r.path, () => '/repo/backups')}>Open</button>
              </div>
            ))}
            {unreadable.length > 0 && (
              <div className="warn">
                <AlertIcon /><span><b>{unreadable.length}</b> can't be read</span>
                <button className="link-btn" onClick={() => setView('repos')}>Show</button>
              </div>
            )}
          </div>
          <div className="ghp-grid-2">
            {branchTable(8)}
            {repoTable(false)}
          </div>
          {commitTable(10)}
        </>
      ))}

      {view === 'repos' && (
        <div className="ghp-grid-side">
          <div>{recents.length === 0 ? empty : repoTable(true)}</div>
          <div>
            <div className="ghp-card ghp-card-pad ghp-gh-card">
              <GitHubRepoList taskCounts={linkCounts.data?.github} filter={filter} localGitHub={localGitHub} onCloned={(p) => openAt(p, () => '/repo/tree')} />
            </div>
            <div className="ghp-card ghp-card-pad">
              <label className="check-row normal">
                <input type="checkbox" checked={settings.autoInitFolders} onChange={(e) => void saveSettings({ ...settings, autoInitFolders: e.target.checked })} />
                Make plain folders into git repositories without asking
              </label>
              <div className="small muted settings-hint">When off, GitHub+ explains what will happen and asks first. Large and secret-looking files are left out either way.</div>
            </div>
          </div>
        </div>
      )}

      {view === 'activity' && (
        <>
          <div style={{ marginBottom: 16 }}>{branchTable(40)}</div>
          {commitTable(60)}
        </>
      )}

      {view === 'issues' && (
        <div className="ghp-card">
          <CardHead title="Open issues" count={issueTotal} hint="local issues, kept inside each repository; the newest five per repository are listed" />
          {openIssues.length === 0 ? <div className="ghp-empty-row">{f ? 'No issues match.' : 'No open issues. Open a repository and use its Issues tab to note a bug, an idea or a to-do.'}</div> : (
            <TableScroll label="Open issues">
              <table className="ghp-table">
                <thead><tr><th>Issue</th><th>Repository</th><th className="num">Comments</th><th className="num">Updated</th></tr></thead>
                <tbody>
                  {openIssues.map(({ repo, i }) => (
                    <tr key={repo.path + i.number} className="clickable" onClick={() => openAt(repo.path, () => issueLink(i.number))}>
                      <td className="fill"><span><span className="muted mono">#{i.number}</span> {i.title}</span></td>
                      <td className="muted">{repo.name}</td>
                      <td className="num muted">{i.comments || ''}</td>
                      <td className="num muted" title={fullDate(i.updatedAt)}>{timeAgo(i.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      )}

      {view === 'backups' && (
        <div className="ghp-card">
          <CardHead title="Backups" hint="each repository's schedule is set on its Backups tab" />
          {backedUp.length === 0 ? <div className="ghp-empty-row">No backups set up. Open a repository and use its Backups tab to copy it to another folder on a schedule.</div> : (
            <TableScroll label="Backups">
              <table className="ghp-table">
                <thead><tr><th>Repository</th><th>Schedule</th><th>Last backup</th><th className="num">Next</th></tr></thead>
                <tbody>
                  {backedUp.map((r) => {
                    const s = r.backup!.schedule!
                    return (
                      <tr key={r.path} className="clickable" onClick={() => openAt(r.path, () => '/repo/backups')}>
                        <td className="fill strong"><span>{r.name}</span></td>
                        <td className="muted">{s.enabled ? (s.times === 1 ? UNIT_LABEL[s.unit] : `${s.times}× per ${s.unit}`) : 'paused'}</td>
                        <td>{backupCell(r)}</td>
                        <td className="num muted">{s.enabled && r.backup!.nextDueAt ? <span title={fullDate(r.backup!.nextDueAt)}>{timeAgo(r.backup!.nextDueAt)}</span> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      )}
    </div>
  )
}
