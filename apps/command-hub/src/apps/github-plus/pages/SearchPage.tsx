import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useRepo } from '../RepoContext'
import { api } from '../api'
import { Avatar } from '../components/CommitList'
import { AlertIcon, BranchIcon, CodeIcon, CommitIcon, FileIcon, HistoryIcon, IssueClosedIcon, IssueOpenIcon, RepoIcon, TaskIcon } from '../components/Icons'
import { blobLink, commitLink, issueLink, searchAllLink, searchLink, tasksLink } from '../links'
import { EAGER_KINDS, KINDS, TIPS, errorOf, highlighter, isKind, marks, ok, savedSearches, useSavedSearches } from '../search'
import type { CodeFile, CommitSummary, HistoryCommit, LinkedSource, ParsedQuery, RepoSearchResults, SearchKind, SearchOptions } from '../types'
import { fullDate, timeAgo } from '../util'

type Scope = 'repo' | 'all'
interface Entry { path: string; name: string; linked?: LinkedSource; results: RepoSearchResults; error?: string }
interface State { query: ParsedQuery | null; entries: Entry[]; loading: boolean; error: string | null }
const EMPTY: State = { query: null, entries: [], loading: false, error: null }
const DEBOUNCE_MS = 400

/** Search in the open repo (under the repo tabs). */
export function RepoSearchPage() {
  return <SearchView scope="repo" />
}

/** Search every repo GitHub+ Home lists. */
export function AllSearchPage() {
  const nav = useNavigate()
  return (
    <div className="ghp-page">
      <header className="ghp-head">
        <div className="min-w-0">
          <div className="eyebrow"><Link to="/">GitHub+</Link> · Search</div>
          <h1>Search all repositories</h1>
          <p className="sub">Code, files, commits, changes and issues in every repository on GitHub+ Home, including work that is not committed yet. Nothing leaves this computer.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => nav('/')}>All repositories</button>
        </div>
      </header>
      <SearchView scope="all" />
    </div>
  )
}

function SearchView({ scope }: { scope: Scope }) {
  const { repo, refs, open } = useRepo()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const type: SearchKind = isKind(sp.get('type')) ? (sp.get('type') as SearchKind) : 'code'
  const where = sp.get('in') || 'working'
  const opts: SearchOptions = useMemo(
    () => ({ regex: sp.get('rx') === '1', caseSensitive: sp.get('cs') === '1', word: sp.get('w') === '1', in: scope === 'repo' ? where : undefined }),
    [sp, scope, where],
  )
  const [text, setText] = useState(q)
  const [tips, setTips] = useState(false)
  const [eager, setEager] = useState<State>(EMPTY)
  const [hist, setHist] = useState<State>(EMPTY)
  const input = useRef<HTMLInputElement>(null)
  const saved = useSavedSearches()
  const channel = scope === 'repo' ? 'ghp-repo' : 'ghp-all'
  const repoPath = repo?.path ?? null
  const defaultRef = repo?.defaultRef ?? 'HEAD'

  // Keep the box in step with the URL (back/forward, a link from elsewhere).
  useEffect(() => setText(q), [q])

  const setParam = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setSp(next, { replace })
  }

  // Search as you type, a moment after the last key.
  useEffect(() => {
    if (text === q) return
    const t = setTimeout(() => setParam({ q: text.trim() ? text : null }, true), DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const run = (kinds: SearchKind[], ch: string, set: (s: State) => void) => {
    if (!q.trim() || (scope === 'repo' && !repoPath)) {
      set(EMPTY)
      return () => undefined
    }
    let live = true
    set({ ...EMPTY, loading: true })
    const p = scope === 'repo'
      ? api.search(repoPath!, q, kinds, opts, ch).then((r) => ({ query: r.query, entries: [{ path: repoPath!, name: repo!.name, results: r.results }] }))
      : api.searchAll(q, kinds, opts, ch).then((r) => ({ query: r.query, entries: r.repos }))
    p.then(
      (r) => live && set({ ...r, loading: false, error: null }),
      (e: Error) => live && !/cancelled/i.test(e.message) && set({ ...EMPTY, error: e.message }),
    )
    return () => { live = false }
  }
  useEffect(() => run(EAGER_KINDS, channel, setEager), [q, opts, scope, repoPath]) // eslint-disable-line react-hooks/exhaustive-deps
  const wantHistory = type === 'history'
  useEffect(() => (wantHistory ? run(['history'], `${channel}-h`, setHist) : (setHist(EMPTY), undefined)), [q, opts, scope, repoPath, wantHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = eager.query ?? hist.query
  const hl = useMemo(() => highlighter(query), [query])
  const entries = type === 'history' ? hist.entries : eager.entries
  const state = type === 'history' ? hist : eager

  const go = (e: Entry, to: string) => {
    if (scope === 'repo') nav(to)
    else open(e.path).then(() => nav(to), () => undefined)
  }

  const count = (k: SearchKind): number | null => {
    const src = k === 'history' ? hist : eager
    if (!src.query) return null
    let n = 0
    for (const e of src.entries) {
      const r = e.results
      if (k === 'code') n += ok(r.code)?.matches ?? 0
      else if (k === 'files') n += ok(r.files)?.total ?? 0
      else if (k === 'commits') n += ok(r.commits)?.commits.length ?? 0
      else if (k === 'history') n += ok(r.history)?.commits.length ?? 0
      else n += (ok(r.issues)?.issues.length ?? 0) + (ok(r.issues)?.tasks?.length ?? 0)
    }
    return n
  }

  const isSaved = saved.includes(q.trim())
  const toggleSave = () => {
    if (isSaved) savedSearches.remove(q)
    else if (!savedSearches.add(q)) window.alert(`You can keep up to ${savedSearches.max} saved searches. Remove one first.`)
  }
  const toggle = (k: 'rx' | 'cs' | 'w', label: string, title: string) => (
    <button type="button" className={`ghp-toggle${sp.get(k) === '1' ? ' on' : ''}`} aria-pressed={sp.get(k) === '1'} title={title} onClick={() => setParam({ [k]: sp.get(k) === '1' ? null : '1' })}>{label}</button>
  )

  return (
    <div className="ghp-search">
      <form className="ghp-search-box" role="search" onSubmit={(e) => { e.preventDefault(); setParam({ q: text.trim() ? text : null }) }}>
        <input
          ref={input}
          className="search"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={scope === 'repo' ? `Search ${repo?.name ?? 'this repository'}…  (try path:, lang:, ref:, def:)` : 'Search every repository…  (try repo:, path:, lang:, def:)'}
          aria-label="Search"
        />
        {toggle('cs', 'Aa', 'Match case')}
        {toggle('w', 'ab', 'Whole words only')}
        {toggle('rx', '.*', 'Regular expression')}
        {scope === 'repo' && (
          <select className="ghp-select" value={where} onChange={(e) => setParam({ in: e.target.value === 'working' ? null : e.target.value })} aria-label="Where to search" title="Where to search when the query has no ref:">
            <option value="working">Working folder (with uncommitted work)</option>
            <optgroup label="Branches">
              {refs.filter((r) => r.type === 'branch').map((r) => <option key={`b:${r.name}`} value={r.name}>{r.name}</option>)}
            </optgroup>
            {refs.some((r) => r.type === 'tag') && (
              <optgroup label="Tags">
                {refs.filter((r) => r.type === 'tag').map((r) => <option key={`t:${r.name}`} value={r.name}>{r.name}</option>)}
              </optgroup>
            )}
          </select>
        )}
        <button type="button" className="btn" disabled={!q.trim()} onClick={toggleSave} title={isSaved ? 'Remove from saved searches' : 'Save this search; GitHub+ Home shows how many matches it has'}>
          {isSaved ? '★ Saved' : '☆ Save'}
        </button>
        <button type="button" className={`btn${tips ? ' active' : ''}`} onClick={() => setTips((t) => !t)} aria-expanded={tips}>Tips</button>
      </form>

      {query && <QueryChips q={query} where={scope === 'repo' ? where : null} />}

      {(tips || !q.trim()) && (
        <Tips scope={scope} saved={saved} onPick={(v) => { setText(v); setParam({ q: v }); input.current?.focus() }} />
      )}

      {q.trim() && (
        <>
          <div className="ghp-bar">
            <div className="ghp-tabs" role="tablist" aria-label="Results">
              {KINDS.map(({ kind, label }) => {
                const n = count(kind)
                return (
                  <button key={kind} role="tab" aria-selected={type === kind} className={type === kind ? 'active' : ''} onClick={() => setParam({ type: kind === 'code' ? null : kind }, true)}
                    title={kind === 'history' ? 'Commits whose changes added or removed the text, across the whole history' : undefined}>
                    {label}{n ? <span className="n">{n}</span> : null}
                  </button>
                )
              })}
            </div>
            <span className="grow" />
            {scope === 'repo' && <Link className="btn" to={searchAllLink(q, type === 'code' ? undefined : type)}><RepoIcon /> Search all repositories</Link>}
            {scope === 'all' && repo && <Link className="btn" to={searchLink(q, type === 'code' ? undefined : type)}>Only in {repo.name}</Link>}
          </div>

          {state.error && <div className="flash error">{state.error}</div>}
          {state.loading && <div className="pad muted center">{type === 'history' ? 'Reading the history… (this walks every change, so it can take a while)' : 'Searching…'}</div>}
          {!state.loading && !state.error && state.query && (
            <Results type={type} scope={scope} entries={entries} query={state.query} hl={hl} defaultRef={defaultRef} go={go} />
          )}
        </>
      )}
    </div>
  )
}

function QueryChips({ q, where }: { q: ParsedQuery; where: string | null }) {
  const chips: string[] = []
  if (q.def) chips.push(`definition of ${q.def}`)
  else if (q.text) chips.push(q.regex ? `regex /${q.text}/` : `"${q.text}"`)
  if (q.caseSensitive) chips.push('match case')
  if (q.word) chips.push('whole words')
  for (const r of q.repos) chips.push(`repo contains ${r}`)
  for (const p of q.paths) chips.push(`path ${p}`)
  for (const p of q.notPaths) chips.push(`not ${p}`)
  for (const l of q.langs) chips.push(`language ${l}`)
  if (q.refs.length) chips.push(`in ${q.refs.join(' + ')}`)
  else if (where) chips.push(where === 'working' ? 'in the working folder' : `in ${where}`)
  if (q.author) chips.push(`by ${q.author}`)
  if (q.after) chips.push(`after ${q.after}`)
  if (q.before) chips.push(`before ${q.before}`)
  if (q.state) chips.push(`${q.state} issues`)
  return <div className="ghp-chips" aria-label="Searching for">{chips.map((c) => <span key={c} className="ghp-chip">{c}</span>)}</div>
}

function Tips({ scope, saved, onPick }: { scope: Scope; saved: string[]; onPick: (q: string) => void }) {
  return (
    <div className="ghp-grid-2 ghp-tips">
      <div className="box">
        <div className="box-head"><strong>Search tips</strong><span className="muted small">Combine any of these</span></div>
        <table className="ghp-table">
          <tbody>
            {TIPS.filter(([ex]) => scope === 'all' || !ex.startsWith('repo:')).map(([ex, what]) => (
              <tr key={ex}>
                <td><button className="link-btn mono" onClick={() => onPick(ex)}>{ex}</button></td>
                <td className="muted">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="box">
        <div className="box-head"><strong>Saved searches</strong><span className="muted small">GitHub+ Home counts their matches</span></div>
        {saved.length === 0
          ? <div className="pad muted">None yet. Search for something, then press ☆ Save.</div>
          : (
            <ul className="ghp-saved">
              {saved.map((s) => (
                <li key={s}>
                  <button className="link-btn mono" onClick={() => onPick(s)}>{s}</button>
                  <button className="link-btn muted" onClick={() => savedSearches.remove(s)} aria-label={`Remove saved search ${s}`}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        <div className="pad muted small">
          Unlike github.com, this searches the working folder by default (edits you have not committed, and new files .gitignore does
          not hide), any branch, tag or commit, and the whole history under <b>Changes</b>.
        </div>
      </div>
    </div>
  )
}

function Mark({ text, hl }: { text: string; hl: RegExp | null }) {
  return <>{marks(text, hl).map((p, i) => (p.m ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}</>
}

interface ResultsProps {
  type: SearchKind
  scope: Scope
  entries: Entry[]
  query: ParsedQuery
  hl: RegExp | null
  defaultRef: string
  go: (e: Entry, to: string) => void
}

function Results(p: ResultsProps) {
  const { type, entries, scope } = p
  const blocks: ReactNode[] = []
  let any = false
  for (const e of entries) {
    const r = e.results
    const err = e.error ?? errorOf(r[type])
    const body = err ? <div className="flash error">{err}</div> : renderKind(p, e)
    if (!body && !err) continue
    any = true
    blocks.push(
      scope === 'all'
        ? (
          <section key={e.path} className="ghp-search-repo">
            <h2><RepoIcon /> {e.name}{e.linked && <span className="ghp-chip pri">{e.linked.label}</span>}<span className="mono muted small">{e.path}</span></h2>
            {body}
          </section>
        )
        : <div key={e.path}>{body}</div>,
    )
  }
  if (!any) {
    return (
      <div className="box pad muted center">
        {type === 'history' ? 'No commit added or removed this text.' : type === 'issues' ? 'No issues match.' : 'Nothing found.'}
        {type === 'code' && p.query.refs.length === 0 && ' Searched the working folder; ignored files are left out.'}
        {type === 'files' && !p.query.text && ' Type part of a file name.'}
      </div>
    )
  }
  return <>{type === 'code' && scope === 'repo' && p.query.refs.length > 1 && <RefSummary entries={entries} refs={p.query.refs} />}{blocks}</>
}

function renderKind(p: ResultsProps, e: Entry): ReactNode {
  const r = e.results
  if (p.type === 'code') {
    const c = ok(r.code)
    if (!c?.files.length) return null
    return (
      <>
        {c.files.map((f) => <CodeHit key={`${f.ref}:${f.path}`} f={f} {...p} e={e} />)}
        {c.truncated && <div className="flash warn">Showing the first {c.matches} matching lines. Narrow it down with path:, lang: or more text.</div>}
      </>
    )
  }
  if (p.type === 'files') {
    const f = ok(r.files)
    if (!f?.files.length) return null
    return (
      <div className="box">
        {f.files.map((x) => (
          <button key={x.path} className="ghp-hit-row" onClick={() => p.go(e, blobLink(x.ref ?? p.defaultRef, x.path, undefined, x.ref === null))}>
            <FileIcon /> <span className="mono"><Mark text={x.path} hl={p.query.regex ? p.hl : highlighter({ ...p.query, regex: false, word: false })} /></span>
            {x.ref && <span className="ghp-chip"><BranchIcon /> {x.ref}</span>}
          </button>
        ))}
        {f.truncated && <div className="pad muted small">{f.total} files match; showing the best {f.files.length}.</div>}
      </div>
    )
  }
  if (p.type === 'commits') {
    const c = ok(r.commits)
    if (!c?.commits.length) return null
    return (
      <div className="box">
        {c.commits.map((x) => <CommitHit key={x.sha} c={x} hl={p.hl} onOpen={() => p.go(e, commitLink(x.sha))} />)}
        {c.truncated && <div className="pad muted small">Showing the newest {c.commits.length}.</div>}
      </div>
    )
  }
  if (p.type === 'history') {
    const h = ok(r.history)
    if (!h?.commits.length) return null
    return (
      <>
        <p className="muted small ghp-search-note">
          Commits whose changes {p.query.regex ? 'touched a line matching' : 'added or removed'} <b className="mono">{p.query.def ?? p.query.text}</b>, newest first.
        </p>
        <div className="box">
          {h.commits.map((x: HistoryCommit) => (
            <CommitHit key={x.sha} c={x} hl={p.hl} onOpen={() => p.go(e, commitLink(x.sha))}>
              <div className="ghp-hit-files">
                {x.files.map((f) => <span key={f} className="ghp-chip mono"><FileIcon /> {f}</span>)}
                {x.moreFiles > 0 && <span className="muted small">and {x.moreFiles} more</span>}
              </div>
            </CommitHit>
          ))}
          {h.truncated && <div className="pad muted small">Showing the newest {h.commits.length}. Add path: or a date range to look further back.</div>}
        </div>
      </>
    )
  }
  const i = ok(r.issues)
  if (!i || (!i.issues.length && !i.tasks?.length)) return null
  return (
    <div className="box">
      {i.issues.map((x) => (
        <button key={x.number} className="ghp-hit-row ghp-hit-issue" onClick={() => p.go(e, issueLink(x.number))}>
          <span className={x.state === 'open' ? 'ok' : 'done'}>{x.state === 'open' ? <IssueOpenIcon /> : <IssueClosedIcon />}</span>
          <span className="min-w-0">
            <span className="title"><Mark text={x.title} hl={p.hl} /></span> <span className="muted">#{x.number}</span>
            <span className="muted small"> · {x.where === 'comment' ? 'in a comment' : x.where === 'description' ? 'in the description' : x.where === 'number' ? 'by number' : 'in the title'} · updated {timeAgo(x.updatedAt)}</span>
            {x.snippet && <span className="snippet"><Mark text={x.snippet} hl={p.hl} /></span>}
          </span>
        </button>
      ))}
      {i.tasks?.map((t) => (
        <button key={`${t.source}:${t.key}`} className="ghp-hit-row ghp-hit-issue" onClick={() => p.go(e, tasksLink())}>
          <span className="pri"><TaskIcon /></span>
          <span className="min-w-0">
            <span className="title"><Mark text={t.summary ?? t.key} hl={p.hl} /></span> <span className="muted mono">{t.key}</span>
            <span className="muted small"> · linked task{t.status ? ` · ${t.status}` : ''}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function CodeHit({ f, e, hl, go, defaultRef, query }: ResultsProps & { f: CodeFile; e: Entry }) {
  const link = (n?: number) => blobLink(f.ref ?? defaultRef, f.path, n, f.ref === null)
  const rows: ReactNode[] = []
  let prev = 0
  for (const l of f.lines) {
    if (prev && l.n > prev + 1) rows.push(<tr key={`gap-${l.n}`} className="gap"><td className="ln">…</td><td /></tr>)
    rows.push(
      <tr key={l.n} className={l.match ? 'hit' : undefined}>
        <td className="ln"><button className="link-btn" onClick={() => go(e, link(l.n))} title={`Open at line ${l.n}`}>{l.n}</button></td>
        <td className="lc">{l.match ? <Mark text={l.text} hl={hl} /> : l.text || ' '}</td>
      </tr>,
    )
    prev = l.n
  }
  return (
    <div className="box ghp-hit">
      <div className="box-head">
        <CodeIcon />
        <button className="link-btn mono ellipsis" onClick={() => go(e, link())} title={f.path}>{f.path}</button>
        {f.ref === null
          ? <span className="ghp-chip warn" title="As it is in the working folder now, uncommitted edits included">Working folder</span>
          : (query.refs.length > 0 || f.ref !== defaultRef) && <span className="ghp-chip"><BranchIcon /> {f.ref}</span>}
        <span className="spacer" />
        <span className="muted small">{f.matches} match{f.matches === 1 ? '' : 'es'}</span>
      </div>
      <div className="code-wrap"><table className="code ghp-hit-lines"><tbody>{rows}</tbody></table></div>
    </div>
  )
}

function CommitHit({ c, hl, onOpen, children }: { c: CommitSummary; hl: RegExp | null; onOpen: () => void; children?: ReactNode }) {
  return (
    <div className="ghp-hit-commit">
      <Avatar name={c.authorName} />
      <div className="min-w-0">
        <button className="link-btn title" onClick={onOpen}><Mark text={c.subject} hl={hl} /></button>
        <div className="muted small">
          <CommitIcon /> <span className="mono">{c.shortSha}</span> · {c.authorName} · <span title={fullDate(c.date)}>{timeAgo(c.date)}</span>
          {c.refs.length > 0 && <> · {c.refs.map((r) => r.replace('HEAD -> ', '')).join(', ')}</>}
        </div>
        {children}
      </div>
    </div>
  )
}

/** With ref:a,b: how many files match in each ref, and the files found in only one of them. */
function RefSummary({ entries, refs }: { entries: Entry[]; refs: string[] }) {
  const files = entries.flatMap((e) => ok(e.results.code)?.files ?? [])
  const by = new Map<string, Set<string>>(refs.map((r) => [r, new Set()]))
  for (const f of files) if (f.ref) by.get(f.ref)?.add(f.path)
  const known = refs.filter((r) => by.has(r))
  const truncated = entries.some((e) => ok(e.results.code)?.truncated)
  return (
    <div className="ghp-strip" aria-label="Where the matches are">
      <div><HistoryIcon /> Compared</div>
      {known.map((r) => {
        const mine = [...by.get(r)!]
        const only = mine.filter((p) => known.every((o) => o === r || !by.get(o)!.has(p)))
        return (
          <div key={r} title={only.length ? `Only in ${r}:\n${only.join('\n')}` : undefined}>
            <span className="mono fg">{r}</span> <b>{mine.length}</b> file{mine.length === 1 ? '' : 's'}
            {only.length > 0 && <span className="ghp-chip info">{only.length} only here</span>}
          </div>
        )
      })}
      {truncated && <div className="warn"><AlertIcon /> Results were cut off, so the comparison may be incomplete</div>}
    </div>
  )
}
