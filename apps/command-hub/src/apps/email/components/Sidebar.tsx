import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronDown, File, Inbox, Mail, Pencil, Plus, Send, Settings, ShieldAlert, Star, Tag, Trash2, Zap } from 'lucide-react'

import { api } from '../api'
import { useMail } from '../MailContext'
import type { FolderRole } from '../types'
import { Avatar } from './Avatar'

const ROLE_ICON: Record<FolderRole, typeof Inbox> = {
  inbox: Inbox,
  starred: Star,
  important: Zap,
  sent: Send,
  drafts: File,
  spam: ShieldAlert,
  trash: Trash2,
}

export default function Sidebar() {
  const { state, account, selectAccount, folders, foldersError, openCompose, reloadFolders, notify } = useMail()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const system = folders.filter((f) => f.kind === 'system')
  const labels = folders.filter((f) => f.kind === 'user')

  const newLabel = async () => {
    if (!account) return
    const name = window.prompt('New label name')
    if (!name?.trim()) return
    try {
      await api.createFolder(account.id, name.trim())
      reloadFolders()
      notify(`Label "${name.trim()}" created`)
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <aside className="eml-side">
      <div className="eml-brand"><span className="eml-brand-mark"><Mail /></span> Email</div>

      <div className="eml-account">
        <button className="eml-account-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          {account && <Avatar from={account.address} size={24} />}
          <span className="eml-ellipsis">{account?.address ?? 'No inbox'}</span>
          <ChevronDown />
        </button>
        {menu && (
          <div className="eml-menu" onMouseLeave={() => setMenu(false)}>
            {state?.accounts.map((a) => (
              <button key={a.id} className={a.id === account?.id ? 'active' : ''} onClick={() => { selectAccount(a.id); setMenu(false); nav('/mail/INBOX') }}>
                <Avatar from={a.address} size={20} /> <span className="eml-ellipsis">{a.address}</span>
              </button>
            ))}
            <hr />
            <button onClick={() => nav('/setup')}><Settings /> Manage inboxes</button>
          </div>
        )}
      </div>

      <button className="eml-compose-btn" onClick={() => openCompose()}><Pencil /> Compose</button>

      {foldersError && <p className="eml-side-error"><AlertCircle /> {foldersError}</p>}
      <nav className="eml-folders">
        {system.map((f) => {
          const Icon = (f.role && ROLE_ICON[f.role]) || Inbox
          return (
            <NavLink key={f.id} to={`/mail/${encodeURIComponent(f.id)}`} className={({ isActive }) => `eml-folder${isActive ? ' active' : ''}`}>
              <Icon /> <span className="eml-grow">{f.name}</span>
              {!!f.unread && <span className="eml-count">{f.unread}</span>}
            </NavLink>
          )
        })}
        <div className="eml-side-head">
          <span>Labels</span>
          <button className="eml-icon-btn small" title="New label" aria-label="New label" onClick={() => void newLabel()}><Plus /></button>
        </div>
        {labels.length === 0 && <p className="eml-muted small eml-side-note">No labels yet.</p>}
        {labels.map((f) => (
          <NavLink key={f.id} to={`/mail/${encodeURIComponent(f.id)}`} className={({ isActive }) => `eml-folder${isActive ? ' active' : ''}`}>
            <Tag style={f.color ? { color: f.color } : undefined} /> <span className="eml-grow eml-ellipsis">{f.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
