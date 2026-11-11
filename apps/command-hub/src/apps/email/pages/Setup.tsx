import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, KeyRound, Lock, Mail, RefreshCw, Server, Trash2 } from 'lucide-react'

import { api } from '../api'
import { Avatar } from '../components/Avatar'
import { useMail } from '../MailContext'
import type { ConnectorInfo } from '../types'

/** "Add an inbox": connector setup (the Google OAuth client) and connected accounts. */
export default function Setup() {
  const { state, stateError, setState, reloadState, selectAccount, notify, bump } = useMail()
  const nav = useNavigate()
  const [kind, setKind] = useState('gmail')

  if (stateError) return <div className="eml-center"><p className="eml-error">{stateError}</p></div>
  if (!state) return <div className="eml-center"><span className="eml-spinner" aria-label="Loading" /></div>

  const connector = state.connectors.find((c) => c.kind === kind)
  const remove = async (id: string, address: string) => {
    if (!window.confirm(`Disconnect ${address}? MonoRail forgets its sign-in. Your mail stays in your account.`)) return
    setState(await api.removeAccount(id))
    notify(`Disconnected ${address}`)
  }

  return (
    <div className="eml-setup">
      <header className="eml-setup-head">
        {state.accounts.length > 0 && (
          <Link to="/mail/INBOX" className="eml-btn ghost"><ArrowLeft /> Back to mail</Link>
        )}
        <div className="eml-brand"><span className="eml-brand-mark"><Mail /></span> Email</div>
      </header>

      <div className="eml-setup-body">
        <h1>{state.accounts.length ? 'Inboxes' : 'Connect an inbox'}</h1>
        <p className="eml-lede">Email reads and sends mail through an inbox connector. Sign-ins and settings are kept encrypted on this PC; mail is fetched when you open it and never saved to disk.</p>

        {!state.encryptionAvailable && (
          <div className="eml-banner warn"><Lock /> Windows encryption is not available, so MonoRail cannot save sign-ins right now.</div>
        )}

        {state.accounts.length > 0 && (
          <section className="eml-card">
            <h2>Connected</h2>
            <ul className="eml-accounts">
              {state.accounts.map((a) => (
                <li key={a.id}>
                  <Avatar from={a.address} />
                  <div className="eml-grow">
                    <div className="eml-strong">{a.address}</div>
                    <div className="eml-muted">{state.connectors.find((c) => c.kind === a.kind)?.label ?? a.kind}{a.needsReauth ? ' · sign-in expired' : ''}</div>
                  </div>
                  {a.needsReauth && <SignInButton connector={state.connectors.find((c) => c.kind === a.kind)} label="Reconnect" />}
                  <button className="eml-btn ghost" onClick={() => { selectAccount(a.id); nav('/mail/INBOX') }}>Open</button>
                  <button className="eml-icon-btn" title="Disconnect" aria-label={`Disconnect ${a.address}`} onClick={() => void remove(a.id, a.address)}><Trash2 /></button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="eml-card">
          <h2>Add an inbox</h2>
          <div className="eml-connectors">
            {state.connectors.map((c) => (
              <button key={c.kind} className={`eml-connector${c.kind === kind ? ' active' : ''}`} onClick={() => setKind(c.kind)}>
                <GoogleMark />
                <span><span className="eml-strong">{c.label}</span><span className="eml-muted">{c.description}</span></span>
              </button>
            ))}
            <div className="eml-connector disabled" aria-disabled>
              <Server />
              <span><span className="eml-strong">IMAP</span><span className="eml-muted">Other mail providers. Coming later.</span></span>
            </div>
          </div>
          {connector?.kind === 'gmail' && (
            <GmailSetup
              connector={connector}
              onSaved={(s) => setState(s)}
              onSignedIn={async (id) => {
                await reloadState()
                selectAccount(id)
                bump()
                nav('/mail/INBOX')
              }}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function GmailSetup({ connector, onSaved, onSignedIn }: { connector: ConnectorInfo; onSaved: (s: Awaited<ReturnType<typeof api.getState>>) => void; onSignedIn: (accountId: string) => void }) {
  const [clientId, setClientId] = useState(connector.config.values.clientId ?? '')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const secretSet = !!connector.config.secretsSet.clientSecret
  const savedId = connector.config.values.clientId ?? ''
  const ready = !!savedId && secretSet
  const dirty = clientId.trim() !== savedId || clientSecret.trim() !== ''
  const [showSteps, setShowSteps] = useState(!ready)

  useEffect(() => setClientId(connector.config.values.clientId ?? ''), [connector.config.values.clientId])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      onSaved(await api.saveConnectorConfig('gmail', { clientId, clientSecret }))
      setClientSecret('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="eml-gmail">
      <button className="eml-steps-toggle" onClick={() => setShowSteps((v) => !v)}>
        {showSteps ? 'Hide' : 'Show'} the one-time Google Cloud setup
      </button>
      {showSteps && <GoogleSteps />}

      <div className="eml-form">
        <div className="eml-step-title"><KeyRound /> Your OAuth client</div>
        <label className="eml-field">
          <span>OAuth client ID</span>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234567890-abc.apps.googleusercontent.com" spellCheck={false} autoComplete="off" />
        </label>
        <label className="eml-field">
          <span>Client secret {secretSet && <em className="eml-saved"><Check /> saved, encrypted</em>}</span>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={secretSet ? 'Leave empty to keep the saved secret' : 'GOCSPX-…'} spellCheck={false} autoComplete="off" />
        </label>
        {error && <p className="eml-error">{error}</p>}
        <div className="eml-row">
          <button className="eml-btn" disabled={saving || !dirty || !clientId.trim()} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
          <SignInButton connector={connector} disabled={!ready || dirty} onSignedIn={onSignedIn} />
        </div>
        {!ready && <p className="eml-muted small">Save the client ID and secret, then sign in.</p>}
      </div>
    </div>
  )
}

function SignInButton({ connector, label = 'Sign in with Google', disabled, onSignedIn }: { connector?: ConnectorInfo; label?: string; disabled?: boolean; onSignedIn?: (id: string) => void }) {
  const { reloadState, notify, bump } = useMail()
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!connector) return null

  const start = async () => {
    setWaiting(true)
    setError(null)
    try {
      const account = await api.signIn(connector.kind)
      notify(`Connected ${account.address}`)
      if (onSignedIn) onSignedIn(account.id)
      else {
        await reloadState()
        bump()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWaiting(false)
    }
  }

  return (
    <span className="eml-signin">
      {waiting ? (
        <>
          <span className="eml-muted"><RefreshCw className="eml-spin" /> Finish signing in in your browser…</span>
          <button className="eml-btn ghost" onClick={() => void api.cancelSignIn()}>Cancel</button>
        </>
      ) : (
        <button className="eml-btn google" disabled={disabled} onClick={() => void start()}><GoogleMark /> {label}</button>
      )}
      {error && <span className="eml-error">{error}</span>}
    </span>
  )
}

const CONSOLE = 'https://console.cloud.google.com'

/** Exact Google Cloud steps for a Desktop OAuth client with the user as a test user. */
function GoogleSteps() {
  return (
    <ol className="eml-steps">
      <li>
        <b>Create a project.</b> Open the <a href={`${CONSOLE}/projectcreate`} target="_blank" rel="noreferrer">Google Cloud console <ExternalLink /></a>, name it (for example "MonoRail Email") and create it. Make sure it is the selected project in the top bar.
      </li>
      <li>
        <b>Turn on the Gmail API.</b> Open <a href={`${CONSOLE}/apis/library/gmail.googleapis.com`} target="_blank" rel="noreferrer">Gmail API <ExternalLink /></a> and click <i>Enable</i>.
      </li>
      <li>
        <b>Set up the consent screen.</b> Open <a href={`${CONSOLE}/auth/overview`} target="_blank" rel="noreferrer">Google Auth Platform <ExternalLink /></a> and click <i>Get started</i>. App name: <code>MonoRail</code>, support email: yours. Audience: <i>External</i>. Contact email: yours. Agree and click <i>Create</i>.
      </li>
      <li>
        <b>Add yourself as a test user.</b> In <a href={`${CONSOLE}/auth/audience`} target="_blank" rel="noreferrer">Audience <ExternalLink /></a>, under <i>Test users</i>, click <i>Add users</i>, enter the Gmail address you will sign in with, and save. Leave the app in <i>Testing</i>.
      </li>
      <li>
        <b>Create the client.</b> In <a href={`${CONSOLE}/auth/clients`} target="_blank" rel="noreferrer">Clients <ExternalLink /></a>, click <i>Create client</i>. Application type: <i>Desktop app</i>, name: <code>MonoRail</code>. Click <i>Create</i>, then copy the <i>Client ID</i> and <i>Client secret</i> into the fields below. Do not put them anywhere else.
      </li>
      <li>
        <b>Sign in.</b> Save, then click <i>Sign in with Google</i>. Your browser opens; pick your account. Google warns that it has not verified the app: click <i>Continue</i> (it is your own client). Tick the box that lets MonoRail read, compose, send and label your mail, and continue.
      </li>
      <li className="eml-muted">
        While the app is in Testing, Google ends the sign-in after 7 days. Email then shows a <i>Reconnect</i> button; it takes a few seconds.
      </li>
    </ol>
  )
}

export function GoogleMark() {
  return (
    <svg className="eml-google" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
