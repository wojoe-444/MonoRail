import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAsync, useRepo } from '../RepoContext'
import RefSelector from '../components/RefSelector'
import CommitList from '../components/CommitList'
import DiffView from '../components/DiffView'
import { compareLink } from '../links'
import { api } from '../api'

/** A local stand-in for GitHub's "Compare changes" / pull request view. */
export default function ComparePage() {
  const { repo } = useRepo()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const base = sp.get('base') || repo!.defaultRef || 'HEAD'
  const head = sp.get('head') || ''
  const res = useAsync(async () => (head ? api.compareRefs(repo!.path, base, head) : null), [repo!.path, base, head])
  return (
    <div>
      <h2>Compare changes</h2>
      <p className="muted">Pick a base and a compare ref to see what the compare ref adds (like a pull request, entirely local).</p>
      <div className="toolbar">
        <RefSelector label="base" value={base} onChange={(b) => nav(compareLink(b, head))} />
        <span className="muted">←</span>
        <RefSelector label="compare" value={head || 'select…'} onChange={(h) => nav(compareLink(base, h))} />
      </div>
      {res.error && <div className="flash error">{res.error}</div>}
      {res.loading && head && <div className="pad muted">Loading…</div>}
      {res.data && (
        res.data.commits.length === 0 && res.data.files.length === 0
          ? <div className="box pad center muted">There isn't anything to compare. <strong>{head}</strong> has no changes relative to <strong>{base}</strong>.</div>
          : <>
              <h3>{res.data.commits.length} commit{res.data.commits.length === 1 ? '' : 's'}</h3>
              <CommitList commits={res.data.commits} />
              <DiffView files={res.data.files} truncated={res.data.truncated} />
            </>
      )}
    </div>
  )
}
