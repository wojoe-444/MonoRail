import { useEffect, useState } from 'react'
import { Minus, Send, X } from 'lucide-react'

import { api } from '../api'
import { useMail } from '../MailContext'
import type { Draft } from '../types'
import DraftFields from './DraftFields'

const EMPTY: Draft = { to: '', cc: '', bcc: '', subject: '', body: '' }

/** New message: a panel docked bottom-right, like most mail clients. */
export default function Composer() {
  const { compose, closeCompose, account, notify, bump } = useMail()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [min, setMin] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (compose) {
      setDraft({ ...EMPTY, ...compose })
      setMin(false)
      setError(null)
    }
  }, [compose])

  if (!compose || !account || account.readOnly) return null
  const dirty = !!(draft.to || draft.subject || draft.body)

  const close = () => {
    if (dirty && !window.confirm('Discard this message?')) return
    closeCompose()
  }
  const send = async () => {
    setSending(true)
    setError(null)
    try {
      await api.send(account.id, draft)
      closeCompose()
      notify('Message sent')
      bump()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`eml-composer${min ? ' min' : ''}`} role="dialog" aria-label="New message">
      <header onClick={() => min && setMin(false)}>
        <span className="eml-grow">{draft.subject || compose.title || 'New message'}</span>
        <button className="eml-icon-btn small" title={min ? 'Expand' : 'Minimize'} onClick={(e) => { e.stopPropagation(); setMin((v) => !v) }}><Minus /></button>
        <button className="eml-icon-btn small" title="Close" onClick={(e) => { e.stopPropagation(); close() }}><X /></button>
      </header>
      {!min && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
          }}
        >
          <div className="eml-from">From <b>{account.address || account.name}</b></div>
          <DraftFields draft={draft} onChange={setDraft} />
          {error && <p className="eml-error">{error}</p>}
          <footer>
            <button className="eml-btn primary" type="submit" disabled={sending || !draft.to.trim()}>
              <Send /> {sending ? 'Sending…' : 'Send'}
            </button>
            <span className="eml-muted small">Ctrl+Enter</span>
          </footer>
        </form>
      )}
    </div>
  )
}
