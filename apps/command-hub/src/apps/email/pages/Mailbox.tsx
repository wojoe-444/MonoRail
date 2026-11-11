import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Inbox, Paperclip, RefreshCw, Search, Star, X } from 'lucide-react'

import { api, ReauthError } from '../api'
import { Avatar } from '../components/Avatar'
import Sidebar from '../components/Sidebar'
import ThreadView from '../components/ThreadView'
import { useMail } from '../MailContext'
import type { ThreadSummary } from '../types'
import { listDate, nameOf } from '../util'

/** The mail view: folders, the thread list, and the open thread. */
export default function Mailbox() {
  const { folderId = 'INBOX', threadId } = useParams()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const nav = useNavigate()
  const { state, account, folders, version } = useMail()

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [search, setSearch] = useState(query)
  const [reload, setReload] = useState(0)

  useEffect(() => setSearch(query), [query])

  const accountId = account?.id
  useEffect(() => {
    if (!accountId) return
    let live = true
    setLoading(true)
    setError(null)
    // A search looks through all mail, like Gmail's search box.
    api.listThreads(accountId, query ? { query } : { folderId }).then(
      (r) => {
        if (!live) return
        setThreads(r.threads)
        setNext(r.nextPageToken)
        setLoading(false)
      },
      (e) => {
        if (!live) return
        setError(e)
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [accountId, folderId, query, version, reload])

  const more = async () => {
    if (!accountId || !next) return
    setLoading(true)
    try {
      const r = await api.listThreads(accountId, query ? { query, pageToken: next } : { folderId, pageToken: next })
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

  const suffix = query ? `?q=${encodeURIComponent(query)}` : ''
  const base = `/mail/${encodeURIComponent(folderId)}`
  const open = (id: string) => nav(`${base}/${encodeURIComponent(id)}${suffix}`)
  const close = () => nav(`${base}${suffix}`)

  if (state && state.accounts.length === 0) {
    return (
      <div className="eml-center">
        <p>No inbox connected yet.</p>
        <Link className="eml-btn primary" to="/setup">Connect an inbox</Link>
      </div>
    )
  }

  const folder = folders.find((f) => f.id === folderId)
  const title = query ? `Search: ${query}` : (folder?.name ?? (folderId === 'INBOX' ? 'Inbox' : ''))

  return (
    <div className={`eml-shell${threadId ? ' reading' : ''}`}>
      <Sidebar />

      <section className="eml-list">
        <form
          className="eml-search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = search.trim()
            nav(`${base}${q ? `?q=${encodeURIComponent(q)}` : ''}`)
          }}
        >
          <Search />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail (from:, subject:, has:attachment …)" aria-label="Search mail" />
          {query && (
            <button type="button" className="eml-icon-btn small" aria-label="Clear search" onClick={() => setParams({})}><X /></button>
          )}
        </form>
        <div className="eml-list-head">
          <h2 className="eml-ellipsis">{title}</h2>
          <button className="eml-icon-btn" title="Refresh" aria-label="Refresh" onClick={() => setReload((n) => n + 1)}><RefreshCw className={loading ? 'eml-spin' : ''} /></button>
        </div>

        {error && (
          <div className="eml-banner error">
            {error.message}
            {error instanceof ReauthError && <Link className="eml-btn small" to="/setup">Reconnect</Link>}
          </div>
        )}

        <ul className="eml-threads">
          {threads.map((t) => (
            <li key={t.id}>
              <button className={`eml-thread${t.unread ? ' unread' : ''}${t.id === threadId ? ' active' : ''}`} onClick={() => open(t.id)}>
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
                  <span className="eml-ellipsis eml-muted eml-thread-snippet">{t.snippet}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!loading && !error && threads.length === 0 && (
          <div className="eml-empty">
            <Inbox />
            <p>{query ? 'Nothing matches that search.' : 'Nothing here.'}</p>
          </div>
        )}
        {next && (
          <button className="eml-btn ghost eml-more" disabled={loading} onClick={() => void more()}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>

      {threadId ? (
        <ThreadView key={threadId} threadId={threadId} folderId={folderId} onClose={close} onPatch={patch} onRemoved={removed} />
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
