import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import Composer from './components/Composer'
import { MailProvider, useMail } from './MailContext'
import Mailbox from './pages/Mailbox'
import Setup from './pages/Setup'
import './styles.css'

/**
 * Email: read and send mail through pluggable inbox connectors (Gmail with
 * Google sign-in first). Its own look, scoped under `.eml` so nothing leaks
 * into the hub. Routes live under the app's hash path, e.g.
 * #/apps/email/mail/INBOX/<threadId>.
 */
export default function EmailApp({ basePath }: { basePath: string }) {
  return (
    <div className="eml">
      <HashRouter basename={basePath}>
        <MailProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/mail/:folderId" element={<Mailbox />} />
            <Route path="/mail/:folderId/:threadId" element={<Mailbox />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Composer />
          <Toast />
        </MailProvider>
      </HashRouter>
    </div>
  )
}

function Home() {
  const { state, stateError } = useMail()
  if (stateError) return <div className="eml-center"><p className="eml-error">{stateError}</p></div>
  if (!state) return <div className="eml-center"><span className="eml-spinner" aria-label="Loading" /></div>
  return <Navigate to={state.accounts.length ? '/mail/INBOX' : '/setup'} replace />
}

function Toast() {
  const { toast } = useMail()
  return toast ? <div className="eml-toast" role="status">{toast}</div> : null
}
