import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowLeft, Inbox, MailOpen, Paperclip, Reply, ReplyAll, Send, Star, X } from 'lucide-react'

import { api, ReauthError } from '../api'
import { useMail } from '../MailContext'
import type { Draft, Message, Thread, ThreadSummary } from '../types'
import { addressOf, formatSize, fullDate, htmlToText, nameOf, quote, replySubject } from '../util'
import { Avatar } from './Avatar'
import DraftFields from './DraftFields'
import LabelMenu from './LabelMenu'
import MessageBody from './MessageBody'

interface Props {
  threadId: string
  onClose: () => void
  /** Keep the list in step with what happened here. */
  onPatch: (id: string, patch: Partial<ThreadSummary>) => void
  onRemoved: (id: string) => void
  /** The folder being viewed (archiving from it removes the thread from the list). */
  folderId: string
}

export default function ThreadView({ threadId, onClose, onPatch, onRemoved, folderId }: Props) {
  const { account, folders, notify, reloadFolders } = useMail()
  const [thread, setThread] = useState<Thread | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [reply, setReply] = useState<Draft | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const accountId = account?.id
  // Latest callbacks, so the load effect re-runs only for a new thread.
  const after = useRef({ onPatch, reloadFolders })
  useLayoutEffect(() => {
    after.current = { onPatch, reloadFolders }
  })

  useEffect(() => {
    if (!accountId) return
    let live = true
    setThread(null)
    setError(null)
    setReply(null)
    api.getThread(accountId, threadId).then(
      (t) => {
        if (!live) return
        setThread(t)
        const last = t.messages.at(-1)
        setExpanded(new Set(t.messages.filter((m) => m.unread || m === last).map((m) => m.id)))
        if (t.labelIds.includes('UNREAD')) {
          api.markRead(accountId, t.id, true).then(
            () => {
              after.current.onPatch(t.id, { unread: false })
              after.current.reloadFolders()
            },
            () => undefined,
          )
        }
      },
      (e) => live && setError(e),
    )
    return () => {
      live = false
    }
  }, [accountId, threadId])

  if (!account) return null
  if (error) {
    return (
      <section className="eml-reader">
        <div className="eml-reader-empty">
          <p className="eml-error">{error.message}</p>
          {error instanceof ReauthError && <Link className="eml-btn" to="/setup">Reconnect</Link>}
        </div>
      </section>
    )
  }
  if (!thread) return <section className="eml-reader"><div className="eml-reader-empty"><span className="eml-spinner" aria-label="Loading" /></div></section>

  const me = addressOf(account.address)
  const last = thread.messages.at(-1)!
  const has = (l: string) => thread.labelIds.includes(l)
  const userLabels = folders.filter((f) => f.kind === 'user' && has(f.id))

  const modify = async (add: string[], remove: string[], done?: string) => {
    try {
      await api.modifyThread(account.id, thread.id, add, remove)
      const next = [...new Set([...thread.labelIds.filter((l) => !remove.includes(l)), ...add])]
      setThread({ ...thread, labelIds: next })
      onPatch(thread.id, { labelIds: next, starred: next.includes('STARRED') })
      if (remove.includes(folderId)) onRemoved(thread.id)
      if (done) notify(done)
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    }
  }

  const archive = async () => {
    try {
      await api.archive(account.id, thread.id)
      notify('Archived')
      onRemoved(thread.id)
      reloadFolders()
      if (folderId === 'INBOX') onClose()
      else setThread({ ...thread, labelIds: thread.labelIds.filter((l) => l !== 'INBOX') })
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    }
  }

  const markUnread = async () => {
    try {
      await api.markRead(account.id, thread.id, false)
      onPatch(thread.id, { unread: true })
      reloadFolders()
      onClose()
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    }
  }

  const startReply = (all: boolean) => {
    // Answer the newest message that is not mine (else the newest).
    const target = [...thread.messages].reverse().find((m) => addressOf(m.from) !== me) ?? last
    const to = target.replyTo || target.from
    const others = all
      ? [...splitList(target.to), ...splitList(target.cc)].filter((a) => addressOf(a) !== me && addressOf(a) !== addressOf(to))
      : []
    const toList = addressOf(to) === me ? splitList(target.to) : [to]
    setReply({
      to: toList.join(', '),
      cc: others.join(', '),
      bcc: '',
      subject: replySubject(thread.subject),
      body: quote(target.from, target.date, target.text || htmlToText(target.html)),
      replyTo: { messageId: target.id },
    })
    setSendError(null)
  }

  const sendReply = async () => {
    if (!reply) return
    setSending(true)
    setSendError(null)
    try {
      await api.send(account.id, reply)
      setReply(null)
      notify('Reply sent')
      setThread(await api.getThread(account.id, thread.id))
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="eml-reader">
      <div className="eml-toolbar">
        <button className="eml-tool" title="Close" onClick={onClose}><ArrowLeft /></button>
        {has('INBOX') ? (
          <button className="eml-tool" title="Archive (remove from Inbox)" onClick={() => void archive()}><Archive /> <span>Archive</span></button>
        ) : (
          <button className="eml-tool" title="Move to Inbox" onClick={() => void modify(['INBOX'], [], 'Moved to Inbox')}><Inbox /> <span>Move to Inbox</span></button>
        )}
        <LabelMenu labelIds={thread.labelIds} onApply={(add, remove) => void modify(add, remove, 'Labels updated')} />
        <button className="eml-tool" title="Mark as unread" onClick={() => void markUnread()}><MailOpen /> <span>Unread</span></button>
        <button className={`eml-tool${has('STARRED') ? ' starred' : ''}`} title={has('STARRED') ? 'Unstar' : 'Star'} onClick={() => void (has('STARRED') ? modify([], ['STARRED']) : modify(['STARRED'], []))}>
          <Star />
        </button>
      </div>

      <div className="eml-reader-scroll">
        <h1 className="eml-subject">{thread.subject}</h1>
        {userLabels.length > 0 && (
          <div className="eml-chips">
            {userLabels.map((l) => (
              <span key={l.id} className="eml-chip">
                {l.name}
                <button aria-label={`Remove label ${l.name}`} onClick={() => void modify([], [l.id])}><X /></button>
              </span>
            ))}
          </div>
        )}

        <div className="eml-messages">
          {thread.messages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              open={expanded.has(m.id)}
              toggle={() =>
                setExpanded((s) => {
                  const n = new Set(s)
                  if (n.has(m.id)) n.delete(m.id)
                  else n.add(m.id)
                  return n
                })
              }
            />
          ))}
        </div>

        {reply ? (
          <form
            className="eml-reply"
            onSubmit={(e) => {
              e.preventDefault()
              void sendReply()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendReply()
            }}
          >
            <DraftFields draft={reply} onChange={setReply} showSubject={false} autoFocusBody />
            {sendError && <p className="eml-error">{sendError}</p>}
            <div className="eml-row">
              <button className="eml-btn primary" type="submit" disabled={sending || !reply.to.trim()}><Send /> {sending ? 'Sending…' : 'Send'}</button>
              <button className="eml-btn ghost" type="button" onClick={() => setReply(null)}>Discard</button>
              <span className="eml-muted small">Ctrl+Enter to send</span>
            </div>
          </form>
        ) : (
          <div className="eml-row eml-reply-actions">
            <button className="eml-btn" onClick={() => startReply(false)}><Reply /> Reply</button>
            <button className="eml-btn" onClick={() => startReply(true)}><ReplyAll /> Reply all</button>
          </div>
        )}
      </div>
    </section>
  )
}

function splitList(s: string): string[] {
  return s
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function MessageCard({ message: m, open, toggle }: { message: Message; open: boolean; toggle: () => void }) {
  return (
    <article className={`eml-msg${open ? ' open' : ''}`}>
      <header onClick={toggle}>
        <Avatar from={m.from} />
        <div className="eml-grow eml-min0">
          <div className="eml-msg-from">
            <b>{nameOf(m.from)}</b> <span className="eml-muted">&lt;{addressOf(m.from)}&gt;</span>
          </div>
          {open ? (
            <div className="eml-muted small eml-ellipsis">to {m.to}{m.cc ? `, cc ${m.cc}` : ''}</div>
          ) : (
            <div className="eml-muted eml-ellipsis">{m.snippet}</div>
          )}
        </div>
        <time className="eml-muted small" dateTime={m.date ?? undefined}>{fullDate(m.date)}</time>
      </header>
      {open && (
        <div className="eml-msg-body">
          <MessageBody message={m} />
          {m.attachments.length > 0 && (
            <ul className="eml-attachments">
              {m.attachments.map((a) => (
                <li key={`${a.id}-${a.filename}`} title="Open the message in Gmail to download attachments">
                  <Paperclip /> <span className="eml-ellipsis">{a.filename}</span> <span className="eml-muted small">{formatSize(a.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
