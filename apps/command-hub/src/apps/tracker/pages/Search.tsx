import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'

import { IssueBrowser } from '../components/IssueBrowser'
import { PageTop } from '../components/PageTop'
import { useTracker } from '../TrackerContext'

/** Every issue whose identifier, title or description holds the search words. An exact identifier opens the issue. */
export function SearchPage() {
  const { snap, idx, openIssue } = useTracker()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const exact = idx.byIdentifier.get(q.trim().toUpperCase())
  return (
    <>
      <PageTop title="Search" icon={<Search className="size-4 text-muted-foreground" />}>
        <input
          autoFocus
          defaultValue={q}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const v = (e.target as HTMLInputElement).value
            setParams((p) => {
              const n = new URLSearchParams(p)
              n.set('q', v)
              return n
            })
            const hit = idx.byIdentifier.get(v.trim().toUpperCase())
            if (hit) openIssue(hit)
          }}
          placeholder="Words, or an identifier like ENG-12"
          className="h-8 w-80 rounded-md border bg-card px-2 text-sm"
          aria-label="Search"
        />
        {exact && <span className="text-xs text-muted-foreground">Press Enter to open {q.toUpperCase()}</span>}
      </PageTop>
      <IssueBrowser key={q} issues={snap.issues} storageKey="" initialFilters={{ query: q }} initialDisplay={{ groupBy: 'none', orderBy: 'updated' }} />
    </>
  )
}
