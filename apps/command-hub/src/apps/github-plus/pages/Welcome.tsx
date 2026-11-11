import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import { api } from '../api'
import { BackupIcon, BranchIcon, CommitIcon, IssueOpenIcon, RepoIcon } from '../components/Icons'
import { Avatar } from '../components/CommitList'
import { commitLink, compareLink, issueLink, issuesLink, treeLink } from '../links'
import type { ActiveBranch, CommitSummary, RepoActivity } from '../types'
import { fullDate, timeAgo } from '../util'

const SIDEBAR_LIMIT = 8

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** The last dashboard shown, so coming back to Home paints at once while it refreshes. Memory only. */
let lastActivity: RepoActivity[] | null = null

const UNIT_LABEL = { hour: 'hourly', day: 'daily', week: 'weekly' } as const

/** GitHub+ home: a dashboard of the local repos you've opened, laid out like a code host's home page. */
export default function Welcome() {
  const { open, pick, error, recents: opened, linked, forget, initOffer, settings, saveSettings } = useRepo()
  const nav = useNavigate()
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  // Opened repos first, then repos other MonoRail apps created (Jira+), which are always listed.
  const recents = useMemo(() => [...opened, ...linked.map((l) => l.path).filter((p) => !opened.includes(p))], [opened, linked])
  const linkedBy = useMemo(() => new Map(linked.map((l) => [l.path, l])), [linked])
  const fetched = useAsync(() => api.getActivity(), [recents.join('\n')])
  useEffect(() => { if (fetched.data) lastActivity = fetched.data }, [fetched.data])
  const activity = { ...fetched, data: fetched.data ?? (fetched.error ? null : lastActivity) }
  const repos = useMemo(() => activity.data ?? [], [activity.data])

  const byPath = useMemo(() => new Map(repos.map((r) => [r.path, r])), [repos])
  const openAt = (path: string, to: (r: RepoActivity | undefined) => string) => {
    open(path).then(() => nav(to(byPath.get(path))), () => undefined)
  }
  const openPicker = () => pick().then((ok) => ok && nav('/repo/tree'), () => undefined)

  const nameOf = (p: string) => linkedBy.get(p)?.name ?? byPath.get(p)?.name ?? p.split(/[\\/]/).pop() ?? p
  const shown = recents.filter((p) => !filter || nameOf(p).toLowerCase().includes(filter.toLowerCase()) || p.toLowerCase().includes(filter.toLowerCase()))
  const listed = showAll || filter ? shown : shown.slice(0, SIDEBAR_LIMIT)

  const commits = useMemo(
    () =>
      repos
        .flatMap((r) => r.commits.map((c) => ({ repo: r, c })))
        .sort((a, b) => Date.parse(b.c.date) - Date.parse(a.c.date))
        .slice(0, 12),
    [repos],
  )
  const branches = useMemo(
    () =>
      repos
        .flatMap((r) => r.branches.filter((b) => !b.isDefault).map((b) => ({ repo: r, b })))
        .sort((a, b) => Date.parse(b.b.date) - Date.parse(a.b.date))
        .slice(0, 8),
    [repos],
  )
  const backedUp = repos.filter((r) => r.backup)
  const openIssues = useMemo(
    () =>
      repos
        .flatMap((r) => (r.issues ?? []).map((i) => ({ repo: r, i })))
        .sort((a, b) => Date.parse(b.i.updatedAt) - Date.parse(a.i.updatedAt))
        .slice(0, 6),
    [repos],
  )
  const issueTotal = repos.reduce((n, r) => n + (r.openIssues ?? 0), 0)

  return (
    <div className="home">
      <header className="topbar">
        <span className="brand">GitHub<span className="brand-plus">+</span></span>
        <span className="muted small">Home</span>
        <span className="spacer" />
        <button className="btn primary" onClick={openPicker}><RepoIcon /> Open repository…</button>
      </header>

      <div className="home-grid">
        <aside className="home-side">
          <div className="side-head">
            <h2>Recent repositories</h2>
          </div>
          <input className="search side-filter" placeholder="Find a repository…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find a repository" />
          {recents.length === 0 && <p className="muted small">Repositories you open show up here.</p>}
          <ul className="repo-list">
            {listed.map((p) => {
              const r = byPath.get(p)
              const l = linkedBy.get(p)
              return (
                <li key={p} className="repo-item">
                  <button className="repo-link" title={p} onClick={() => openAt(p, () => '/repo/tree')}>
                    <span className={`repo-dot${r?.error ? ' missing' : ''}`}><RepoIcon /></span>
                    <span className="ellipsis">{nameOf(p)}</span>
                    {l && <span className="badge" title={`Created by ${l.label}. Always listed while it exists.`}>{l.label}</span>}
                    {r?.error && <span className="badge">{/not inside a git repository/.test(r.error) ? 'not a repo' : 'unavailable'}</span>}
                  </button>
                  {!l && <button className="icon-btn" title="Remove from recent repositories" aria-label={`Remove ${nameOf(p)} from recent repositories`} onClick={() => forget(p)}>×</button>}
                </li>
              )
            })}
            {filter && shown.length === 0 && <li className="muted small pad-y">No repositories match.</li>}
          </ul>
          {!filter && shown.length > SIDEBAR_LIMIT && (
            <button className="link-btn small" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : 'Show more'}</button>
          )}
        </aside>

        <main className="home-main">
          <h1 className="greeting">{greeting()}!</h1>
          <p className="muted">What’s been happening in your local repositories. Everything here is read from this computer.</p>
          {error && !initOffer && <div className="flash error">{error}</div>}

          {recents.length === 0 ? (
            <div className="box pad center empty">
              <RepoIcon />
              <h3>Open your first repository</h3>
              <p className="muted">Pick any folder on this computer. A plain folder can be made into a git repository in one step.</p>
              <button className="btn primary big" onClick={openPicker}>Open a repository…</button>
            </div>
          ) : (
            <>
              <section className="feed">
                <div className="feed-head">
                  <h2>Active branches</h2>
                  <span className="muted small">Branches with recent work. Compare one with its default branch to review it like a pull request.</span>
                </div>
                <div className="box">
                  {activity.loading && !activity.data && <div className="pad muted">Loading…</div>}
                  {activity.data && branches.length === 0 && <div className="pad muted">No branches besides the default ones yet.</div>}
                  {branches.map(({ repo, b }) => <BranchRow key={repo.path + b.name} repo={repo} b={b} onOpen={() => openAt(repo.path, (r) => compareLink(r?.defaultRef ?? undefined, b.name))} />)}
                </div>
              </section>

              <section className="feed">
                <div className="feed-head"><h2>Recent commits</h2></div>
                <div className="box">
                  {activity.loading && !activity.data && <div className="pad muted">Loading…</div>}
                  {activity.data && commits.length === 0 && <div className="pad muted">No commits yet.</div>}
                  {commits.map(({ repo, c }) => <CommitRow key={repo.path + c.sha} repo={repo} c={c} onOpen={() => openAt(repo.path, () => commitLink(c.sha))} onBrowse={() => openAt(repo.path, () => treeLink(c.sha, ''))} />)}
                </div>
              </section>
            </>
          )}
        </main>

        <aside className="home-right">
          <div className="box card">
            <div className="card-title"><IssueOpenIcon /> Open issues{issueTotal > 0 && <span className="counter">{issueTotal}</span>}</div>
            {openIssues.length === 0 ? (
              <p className="muted small">No open issues. Open a repository and use its <strong>Issues</strong> tab to note a bug, an idea or a to-do.</p>
            ) : (
              <ul className="timeline">
                {openIssues.map(({ repo, i }) => (
                  <li key={repo.path + i.number}>
                    <button className="link-btn" onClick={() => openAt(repo.path, () => issueLink(i.number))}>{i.title}</button>
                    <div className="muted small">{repo.name} #{i.number} · <span title={fullDate(i.updatedAt)}>updated {timeAgo(i.updatedAt)}</span></div>
                  </li>
                ))}
              </ul>
            )}
            {issueTotal > openIssues.length && (
              <div className="small muted issue-repos">
                {repos.filter((r) => r.openIssues).map((r, k) => (
                  <span key={r.path}>{k > 0 && ' · '}<button className="link-btn" onClick={() => openAt(r.path, () => issuesLink())}>{r.name} ({r.openIssues})</button></span>
                ))}
              </div>
            )}
          </div>

          <div className="box card">
            <div className="card-title"><BackupIcon /> Backups</div>
            {backedUp.length === 0 ? (
              <p className="muted small">No backups set up. Open a repository and use its <strong>Backups</strong> tab to copy it to another folder on a schedule.</p>
            ) : (
              <ul className="timeline">
                {backedUp.map((r) => {
                  const s = r.backup!.schedule!
                  const last = r.backup!.lastResult
                  return (
                    <li key={r.path}>
                      <button className="link-btn" onClick={() => openAt(r.path, () => '/repo/backups')}>{r.name}</button>
                      <div className="muted small">
                        {s.enabled ? (s.times === 1 ? UNIT_LABEL[s.unit] : `${s.times}× per ${s.unit}`) : 'paused'}
                        {' · '}
                        {!last ? 'no backup yet' : last.ok ? <span title={fullDate(last.at)}>last {timeAgo(last.at)}</span> : <span className="del">last attempt failed</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="box card">
            <div className="card-title">Settings</div>
            <label className="check-row normal">
              <input type="checkbox" checked={settings.autoInitFolders} onChange={(e) => void saveSettings({ ...settings, autoInitFolders: e.target.checked })} />
              Make plain folders into git repositories without asking
            </label>
            <div className="small muted settings-hint">When off, GitHub+ explains what will happen and asks first. Large and secret-looking files are left out either way.</div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function BranchRow({ repo, b, onOpen }: { repo: RepoActivity; b: ActiveBranch; onOpen: () => void }) {
  return (
    <div className="feed-row">
      <span className="feed-icon add"><BranchIcon /></span>
      <div className="feed-main">
        <button className="feed-title" onClick={onOpen}>{b.name}</button>
        <div className="muted small ellipsis">
          {repo.name}
          {b.ahead !== undefined && <> · <span className="add">{b.ahead} ahead</span>, <span className="del">{b.behind} behind</span> {repo.defaultRef}</>}
          {' · '}updated <span title={fullDate(b.date)}>{timeAgo(b.date)}</span> by {b.author}
        </div>
      </div>
      <button className="btn" onClick={onOpen}>Compare</button>
    </div>
  )
}

function CommitRow({ repo, c, onOpen, onBrowse }: { repo: RepoActivity; c: CommitSummary; onOpen: () => void; onBrowse: () => void }) {
  return (
    <div className="feed-row">
      <span className="feed-icon"><CommitIcon /></span>
      <div className="feed-main">
        <button className="feed-title" onClick={onOpen}>{c.subject}</button>
        <div className="muted small ellipsis">
          {repo.name} · <span className="mono">{c.shortSha}</span> · <Avatar name={c.authorName} /> {c.authorName} committed <span title={fullDate(c.date)}>{timeAgo(c.date)}</span>
        </div>
      </div>
      <button className="btn" onClick={onBrowse} title="Browse the repository at this commit">&lt;&gt;</button>
    </div>
  )
}
