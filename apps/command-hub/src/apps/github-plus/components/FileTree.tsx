import { useEffect, useReducer, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { api } from '../api'
import { blobLink, searchLink, treeLink } from '../links'
import type { TreeEntry } from '../types'
import { ChevronDown, ChevronRight, FileIcon, FolderIcon, SubmoduleIcon } from './Icons'

// Folder listings and open folders, kept in memory so moving between the
// folder and file pages does not reload the tree. Listings are keyed by the
// commit the ref points at, so a new commit or a refresh shows fresh ones.
const listings = new Map<string, TreeEntry[] | 'loading' | { error: string }>()
const openDirs = new Map<string, Set<string>>()
const MAX_LISTINGS = 400

const ancestors = (p: string): string[] => {
  const parts = p.split('/').filter(Boolean)
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** The repo's folders as an expandable tree beside the folder or file being shown. */
export default function FileTree({ refName, current, isFile }: { refName: string; current: string; isFile?: boolean }) {
  const { repo, refs } = useRepo()
  const nav = useNavigate()
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [filter, setFilter] = useState('')
  const rp = repo!.path
  const sha = refs.find((r) => r.name === refName)?.sha ?? refName
  const keyOf = (dir: string) => `${rp}\0${sha}\0${dir}`
  const openKey = `${rp}\0${refName}`
  const open = openDirs.get(openKey) ?? new Set<string>()
  if (!openDirs.has(openKey)) openDirs.set(openKey, open)

  const load = (dir: string) => {
    const k = keyOf(dir)
    if (listings.has(k)) return
    if (listings.size > MAX_LISTINGS) listings.clear()
    listings.set(k, 'loading')
    api.listTree(rp, refName, dir).then(
      (entries) => { listings.set(k, entries); rerender() },
      (e: Error) => { listings.set(k, { error: e.message }); rerender() },
    )
  }

  // Open the folders around what is shown.
  const around = isFile ? ancestors(current).slice(0, -1) : ancestors(current)
  useEffect(() => {
    for (const d of around) open.add(d)
    load('')
    for (const d of open) load(d)
    rerender()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp, sha, current])

  const toggle = (dir: string) => {
    if (open.has(dir)) open.delete(dir)
    else { open.add(dir); load(dir) }
    rerender()
  }

  const row = (e: TreeEntry, depth: number) => {
    const isDir = e.type === 'dir'
    const isOpen = isDir && open.has(e.path)
    const isCurrent = e.path === current
    const go = () => {
      if (isDir) { if (!isOpen) toggle(e.path); nav(treeLink(refName, e.path)) }
      else if (e.type !== 'submodule') nav(blobLink(refName, e.path))
    }
    return (
      <button key={e.path} className={`ghp-tree-row${isCurrent ? ' current' : ''}`} style={{ paddingLeft: 6 + depth * 14 }} title={e.path} aria-current={isCurrent ? 'page' : undefined} onClick={go} disabled={e.type === 'submodule'}>
        <span className="chev" onClick={isDir ? (ev) => { ev.stopPropagation(); toggle(e.path) } : undefined} aria-hidden>
          {isDir ? (isOpen ? <ChevronDown /> : <ChevronRight />) : null}
        </span>
        <span className={`ico${isDir ? ' folder' : ''}`}>{isDir ? <FolderIcon /> : e.type === 'submodule' ? <SubmoduleIcon /> : <FileIcon />}</span>
        <span className="nm">{e.name}</span>
      </button>
    )
  }

  const renderDir = (dir: string, depth: number): ReactNode => {
    const l = listings.get(keyOf(dir))
    if (!l || l === 'loading') return <div key={`${dir}:loading`} className="note" style={{ paddingLeft: 26 + depth * 14 }}>Loading…</div>
    if ('error' in l) return <div key={`${dir}:error`} className="note" style={{ paddingLeft: 26 + depth * 14 }}>{l.error}</div>
    return l.flatMap((e) => [row(e, depth), e.type === 'dir' && open.has(e.path) ? <div key={`${e.path}:kids`}>{renderDir(e.path, depth + 1)}</div> : null])
  }

  // Filter: every file at this ref (not only the folders opened so far), fuzzy, best first.
  const q = filter.trim()
  const [found, setFound] = useState<{ q: string; paths: string[]; total: number; error?: string } | null>(null)
  useEffect(() => {
    if (!q) { setFound(null); return }
    let live = true
    const t = setTimeout(() => {
      api.search(rp, q, ['files'], { in: refName }, 'ghp-tree').then(
        (r) => {
          if (!live) return
          const f = r.results.files
          if (f && 'error' in f) setFound({ q, paths: [], total: 0, error: f.error })
          else setFound({ q, paths: (f?.files ?? []).map((x) => x.path), total: f?.total ?? 0 })
        },
        (e: Error) => live && !/cancelled/i.test(e.message) && setFound({ q, paths: [], total: 0, error: e.message }),
      )
    }, 150)
    return () => { live = false; clearTimeout(t) }
  }, [q, rp, refName])

  return (
    <aside className="ghp-card ghp-tree" aria-label="Files">
      <input
        className="search"
        placeholder="Find a file…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && found?.paths[0]) nav(blobLink(refName, found.paths[0])) }}
        aria-label="Find a file anywhere in this branch"
        title="Letters in order are enough: sfmt finds src/format.ts. Enter opens the first match."
      />
      {q ? (
        !found || found.q !== q ? <div className="note">Searching…</div>
          : found.error ? <div className="note">{found.error}</div>
          : found.paths.length ? (
            <>
              {found.paths.map((p) => (
                <button key={p} className={`ghp-tree-row${p === current ? ' current' : ''}`} style={{ paddingLeft: 6 }} title={p} onClick={() => nav(blobLink(refName, p))}>
                  <span className="ico"><FileIcon /></span>
                  <span className="nm">{p}</span>
                </button>
              ))}
              {found.total > found.paths.length && (
                <div className="note">
                  {found.total} files match; showing the best {found.paths.length}.{' '}
                  <button className="link-btn" onClick={() => nav(searchLink(`${q} ref:${refName}`, 'files'))}>See all</button>
                </div>
              )}
            </>
          ) : <div className="note">No file matches.</div>
      ) : renderDir('', 0)}
    </aside>
  )
}
