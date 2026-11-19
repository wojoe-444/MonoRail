import { Link } from 'react-router-dom'
import { useAsync } from '../RepoContext'
import { api } from '../api'
import { searchAllLink } from '../links'
import { savedSearches, useSavedSearches } from '../search'
import { CardHead, TableScroll } from './Dense'

/**
 * GitHub+ Home: the saved searches with how many lines match across every
 * repository right now (e.g. TODOs). Counted when Home opens or refreshes;
 * searches that name a committed ref are reused while the repos' refs are
 * unchanged. Shown only when there is at least one.
 */
export default function SavedSearches({ tick }: { tick: number }) {
  const saved = useSavedSearches()
  const counts = useAsync(() => (saved.length ? api.searchCounts(saved) : Promise.resolve([])), [saved.join('\n'), tick])
  if (!saved.length) return null
  const by = new Map((counts.data ?? []).map((c) => [c.query, c]))
  return (
    <div className="ghp-card">
      <CardHead title="Saved searches" count={saved.length} hint="matching lines across every repository, uncommitted work included" />
      <TableScroll label="Saved searches">
        <table className="ghp-table">
          <thead><tr><th>Search</th><th className="num">Matches</th><th className="num">Repositories</th><th aria-label="Remove" /></tr></thead>
          <tbody>
            {saved.map((s) => {
              const c = by.get(s)
              return (
                <tr key={s}>
                  <td><Link className="mono" to={searchAllLink(s)}>{s}</Link></td>
                  <td className="num mono" title={c?.error ?? undefined}>{counts.loading && !c ? '…' : c?.error ? '!' : (c?.total ?? 0)}</td>
                  <td className="num mono muted">{c ? c.repos : ''}</td>
                  <td className="num"><button className="link-btn muted" onClick={() => savedSearches.remove(s)} aria-label={`Remove saved search ${s}`}>Remove</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableScroll>
    </div>
  )
}
