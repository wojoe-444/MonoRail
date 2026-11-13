import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, Inbox, Paperclip, RefreshCw, Search, Star, X } from 'lucide-react'

import { api, errorCode, toMailError } from '../api'
import { Avatar } from '../components/Avatar'
import Sidebar from '../components/Sidebar'
import ThreadView from '../components/ThreadView'
import { useMail } from '../MailContext'
import type { Account, ThreadSummary } from '../types'
import { accountLabel, listDate, nameOf } from '../util'
import { prefs } from '@/lib/prefs'

const SCOPE_KEY = 'monorail.email.searchAccounts'
const DAY_OPTIONS = [0, 1, 7, 30, 90, 365]

/** The mail view: folders, the thread list (with filters and search), and the open thread. */
export default function Mailbox() {
  const { folderId = 'INBOX', threadId } = useParams()
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  const daysBack = Number(params.get('d') ?? 0) || 0
  const unreadOnly = params.get('u') === '1'
  const allFolders = params.get('all') === '1'
  const threadAccountId = params.get('a')
  const nav = useNavigate()
  const { state, account, folders, version, connectorOf } = useMail()
  const accounts = useMemo(() => state?.accounts ?? [], [state])

  // Which accounts a search covers (remembered); the current one by default.
  const [scope, setScopeState] = useState<string[]>(() => JSON.parse(prefs.getItem(SCOPE_KEY) ?? '[]') as string[])
  const setScope = (ids: string[]) => {
    prefs.setItem(SCOPE_KEY, JSON.stringify(ids))
    setScopeState(ids)
  }
  const searchIds = useMemo(() => {
    const ids = scope.filter((id) => accounts.some((a) => a.id === id))
    return ids.length ? ids : account ? [account.id] : []
  }, [scope, accounts, account])
  const multi = !!query && (searchIds.length > 1 || (searchIds.length === 1 && searchIds[0] !== account?.id))
  const fullStoreAvailable = (multi ? searchIds.map((id) => accounts.find((a) => a.id === id)) : [account]).some((a) => connectorOf(a)?.capabilities.fullStoreSearch)

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [search, setSearch] = useState(query)
  const [reload, setReload] = useState(0)

  useEffect(() => setSearch(query), [query])

  const label = useCallback((id: string) => accountLabel(accounts.find((a) => a.id === id)), [accounts])
  const accountId = account?.id
  const filters = useMemo(() => ({ daysBack, unreadOnly, allFolders }), [daysBack, unreadOnly, allFolders])
  const searchKey = searchIds.join(',')

  useEffect(() => {
    if (!accountId) return
    let live = true
    setLoading(true)
    setError(null)
    setNotes([])
    const ids = searchKey.split(',')
    const req = multi
      ? api.searchAccounts(ids, { query, ...filters }).then((r) => ({
          threads: r.threads,
          nextPageToken: null,
          notes: [
            ...r.errors.map((e) => `${label(e.accountId)}: ${toMailError(e.error).message}`),
            ...r.partial.map((p) => `${label(p.accountId)}: ${p.message}`),
            ...(r.truncated ? ['Showing the newest 100 matches.'] : []),
          ],
        }))
      : api.listThreads(accountId, { folderId, query: query || undefined, ...filters }).then((r) => ({ threads: r.threads, nextPageToken: r.nextPageToken, notes: r.partial ? [r.partial] : [] }))
    req.then(
      (r) => {
        if (!live) return
        setThreads(r.threads)
        setNext(r.nextPageToken)
        setNotes(r.notes)
        setLoading(false)
      },
      (e) => {
        if (!live) return
        setThreads([])
        setNext(null)
        setError(e)
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [accountId, folderId, query, version, reload, multi, searchKey, filters, label])

  const more = async () => {
    if (!accountId || !next) return
    setLoading(true)
    try {
      const r = await api.listThreads(accountId, { folderId, query: query || undefined, pageToken: next, ...filters })
      setThreads((t) => [...t, ...r.threads.filter((x) => !t.some((y) => y.id === x.id))])
      setNext(r.nextPageToken)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }

  const patch = useCallback((id: string, p: Partial<ThreadSummary>) => setThreads((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x))), [])
  const removed = useCallback((id: string) => setThreads((t) => t.filter((x) => x.id !== id)), [])

  /** Query string without the thread's account. */
  const listParams = () => {
    const p = new URLSearchParams(params)
    p.delete('a')
    return p
  }
  const qs = (p: URLSearchParams) => (p.toString() ? `?${p}` : '')
  const base = `/mail/${encodeURIComponent(folderId)}`
  const open = (t: ThreadSummary) => {
    const p = listParams()
    if (t.accountId && t.accountId !== accountId) p.set('a', t.accountId)
    nav(`${base}/${encodeURIComponent(t.id)}${qs(p)}`)
  }
  const close = () => nav(`${base}${qs(listParams())}`)
  const setParam = (k: string, v: string | null) => {
    const p = listParams()
    if (v) p.set(k, v)
    else p.delete(k)
    nav(`${base}${qs(p)}`)
  }

  if (state && accounts.length === 0) {
    return (
      <div className="eml-center">
        <p>No inbox connected yet.</p>
        <Link className="eml-btn primary" to="/setup">Connect an inbox</Link>
      </div>
    )
  }

  const caps = connectorOf()?.capabilities ?? {}
  const folder = folders.find((f) => f.id === folderId)
  const title = query ? (multi ? `Search in ${searchIds.length} inboxes: ${query}` : `Search: ${query}`) : (folder?.name ?? (folderId === 'INBOX' ? 'Inbox' : ''))
  const threadAccount: Account | null = (threadAccountId && accounts.find((a) => a.id === threadAccountId)) || account
  const code = errorCode(error)

  return (
    <div className={`eml-shell${threadId ? ' reading' : ''}`}>
      <Sidebar />

      <section className="eml-list">
        <form
          className="eml-search"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', search.trim() || null)
          }}
        >
          <Search />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={caps.queryHint ?? 'Search mail'} aria-label="Search mail" />
          {query && (
            <button type="button" className="eml-icon-btn small" aria-label="Clear search" onClick={() => setParam('q', null)}><X /></button>
          )}
        </form>
        <div className="eml-filters">
          {accounts.length > 1 && <ScopePicker accounts={accounts} selected={searchIds} onChange={setScope} />}
          <label className="eml-select">
            <span className="sr-only">Days back</span>
            <select value={daysBack} onChange={(e) => setParam('d', e.target.value === '0' ? null : e.target.value)} aria-label="Days back">
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d === 0 ? 'Any time' : d === 1 ? 'Last day' : `Last ${d} days`}</option>
              ))}
            </select>
          </label>
          <button type="button" className={`eml-chip-btn${unreadOnly ? ' on' : ''}`} aria-pressed={unreadOnly} onClick={() => setParam('u', unreadOnly ? null : '1')}>Unread</button>
          {fullStoreAvailable && (
            <button
              type="button"
              className={`eml-chip-btn${allFolders ? ' on' : ''}`}
              aria-pressed={allFolders}
              title="Search every folder, not just the open one. Online-only shared mailboxes can be slow, so it stops after 60 seconds and shows what it found."
              onClick={() => setParam('all', allFolders ? null : '1')}
            >
              All folders
            </button>
          )}
        </div>
        <div className="eml-list-head">
          <h2 className="eml-ellipsis">{title}</h2>
          <button className="eml-icon-btn" title="Refresh" aria-label="Refresh" onClick={() => setReload((n) => n + 1)}><RefreshCw className={loading ? 'eml-spin' : ''} /></button>
        </div>
        {query && !multi && allFolders && caps.fullStoreSearch && <p className="eml-muted small eml-list-note">Searching every folder. This can take up to a minute.</p>}
        {query && !allFolders && caps.fullStoreSearch && <p className="eml-muted small eml-list-note">{multi ? 'Searching each Outlook inbox.' : `Searching ${folder?.name ?? 'this folder'}.`} Turn on All folders to search everywhere.</p>}

        {error && (
          <div className="eml-banner error">
            <span className="eml-grow">{error.message}</span>
            {code === 'reauth' && <Link className="eml-btn small" to="/setup">Reconnect</Link>}
            {(code === 'not-running' || code === 'timeout') && <button className="eml-btn small" onClick={() => setReload((n) => n + 1)}>Retry</button>}
            {code === 'store-missing' && <Link className="eml-btn small" to="/setup">Manage inboxes</Link>}
          </div>
        )}
        {notes.map((n) => (
          <div key={n} className="eml-banner warn"><AlertTriangle /> <span className="eml-grow">{n}</span></div>
        ))}

        <ul className="eml-threads">
          {threads.map((t) => (
            <li key={`${t.accountId ?? ''}:${t.id}`}>
              <button className={`eml-thread${t.unread ? ' unread' : ''}${t.id === threadId ? ' active' : ''}`} onClick={() => open(t)}>
                <Avatar from={t.from} />
                <span className="eml-thread-main">
                  <span className="eml-thread-top">
                    <span className="eml-ellipsis eml-thread-from">
                      {t.participants.length > 1 ? t.participants.slice(-3).join(', ') : nameOf(t.from)}
                      {t.messageCount > 1 && <span className="eml-muted"> {t.messageCount}</span>}
                    </span>
                    {t.starred && <Star className="eml-star" />}
                    {t.hasAttachments && <Paperclip className="eml-clip" />}
                    <time className="eml-thread-date">{listDate(t.date)}</time>
                  </span>
                  <span className="eml-ellipsis eml-thread-subject">{t.subject}</span>
                  {(multi || t.folder) && (
                    <span className="eml-ellipsis eml-thread-where">
                      {multi && t.accountId && <span className="eml-tag">{label(t.accountId)}</span>}
                      {!!t.alsoIn?.length && <span className="eml-tag" title={t.alsoIn.map(label).join(', ')}>+{t.alsoIn.length}</span>}
                      {t.folder && <span className="eml-muted">{t.folder}</span>}
                    </span>
                  )}
                  {t.snippet && <span className="eml-ellipsis eml-muted eml-thread-snippet">{t.snippet}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!loading && !error && threads.length === 0 && (
          <div className="eml-empty">
            <Inbox />
            <p>{query ? 'Nothing matches that search.' : daysBack || unreadOnly ? 'Nothing matches these filters.' : 'Nothing here.'}</p>
          </div>
        )}
        {next && (
          <button className="eml-btn ghost eml-more" disabled={loading} onClick={() => void more()}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>

      {threadId && threadAccount ? (
        <ThreadView key={`${threadAccount.id}:${threadId}`} account={threadAccount} threadId={threadId} folderId={folderId} onClose={close} onPatch={patch} onRemoved={removed} />
      ) : (
        <section className="eml-reader">
          <div className="eml-reader-empty eml-muted">
            <Inbox />
            <p>Pick a conversation to read it.</p>
          </div>
        </section>
      )}
    </div>
  )
}

/** Which inboxes a search covers. */
function ScopePicker({ accounts, selected, onChange }: { accounts: Account[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  const toggle = (id: string) => {
    const n = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    if (n.length) onChange(accounts.map((a) => a.id).filter((x) => n.includes(x)))
  }
  return (
    <div className="eml-pop-wrap" ref={ref}>
      <button type="button" className="eml-chip-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Inboxes a search looks in">
        Search in {selected.length === 1 ? accountLabel(accounts.find((a) => a.id === selected[0])) : `${selected.length} inboxes`} <ChevronDown />
      </button>
      {open && (
        <div className="eml-pop">
          <p className="eml-muted small">Search in</p>
          {accounts.map((a) => (
            <label key={a.id} className="eml-check">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
              <span className="eml-box"><Check /></span>
              <span className="eml-ellipsis">{accountLabel(a)}</span>
            </label>
          ))}
          <button type="button" className="eml-btn small" onClick={() => onChange(accounts.map((a) => a.id))}>All inboxes</button>
        </div>
      )}
    </div>
  )
}
