import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CommitSummary } from '../types'
import { useRepo } from '../RepoContext'
import RefSelector from '../components/RefSelector'
import CommitList from '../components/CommitList'
import { commitsLink } from '../links'
import { api } from '../api'

const PAGE = 30

export default function CommitsPage() {
  const { repo } = useRepo()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const ref = sp.get('ref') || repo!.defaultRef || 'HEAD'
  const path = sp.get('path') || undefined
  const rp = repo!.path
  const [commits, setCommits] = useState<CommitSummary[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  const load = (skip: number, reset: boolean): void => {
    setLoading(true)
    api.getLog(rp, { ref, path, skip, limit: PAGE, search: applied || undefined }).then(
      (r) => { setCommits((p) => (reset ? r.commits : [...p, ...r.commits])); setMore(r.hasMore); setError(null) },
      (e: Error) => setError(e.message)
    ).finally(() => setLoading(false))
  }
  useEffect(() => { load(0, true) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rp, ref, path, applied])

  return (
    <div>
      <div className="toolbar">
        <RefSelector value={ref} onChange={(r) => nav(commitsLink(r, path))} />
        {path && <span className="muted">History for <strong className="mono">{path}</strong></span>}
        <span className="spacer" />
        <form onSubmit={(e) => { e.preventDefault(); setApplied(search) }}>
          <input className="search" placeholder="Search commit messages" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>
      {error && <div className="flash error">{error}</div>}
      <CommitList commits={commits} />
      {!loading && commits.length === 0 && !error && <div className="box pad muted center">No commits found.</div>}
      {loading && <div className="pad muted center">Loading…</div>}
      {more && !loading && <div className="center pad"><button className="btn" onClick={() => load(commits.length, false)}>Load older commits</button></div>}
    </div>
  )
}
