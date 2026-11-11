import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ChevronDown, ChevronRight, File, Folder as FolderIcon, Inbox, Lock, Mail, Pencil, Plus, RefreshCw, Send, Settings, ShieldAlert, Star, Tag, Trash2, Zap } from 'lucide-react'

import { api, errorCode } from '../api'
import { useMail } from '../MailContext'
import type { Folder, FolderRole } from '../types'
import { accountAvatar, accountLabel } from '../util'
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
const ROLE_ORDER: FolderRole[] = ['inbox', 'starred', 'important', 'drafts', 'sent', 'spam', 'trash']

export default function Sidebar() {
  const { state, account, selectAccount, folders, foldersError, foldersTimedOut, openCompose, reloadFolders, notify, caps } = useMail()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const readOnly = !!account?.readOnly
  const noun = caps.labels ? 'label' : 'folder'

  const newFolder = async () => {
    if (!account) return
    const name = window.prompt(`New ${noun} name`)
    if (!name?.trim()) return
    try {
      await api.createFolder(account.id, name.trim())
      reloadFolders()
      notify(`${caps.labels ? 'Label' : 'Folder'} "${name.trim()}" created`)
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <aside className="eml-side">
      <div className="eml-brand"><span className="eml-brand-mark"><Mail /></span> Email</div>

      <div className="eml-account">
        <button className="eml-account-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
          {account && <Avatar from={accountAvatar(account)} size={24} />}
          <span className="eml-ellipsis">{account ? accountLabel(account) : 'No inbox'}</span>
          {readOnly && <Lock className="eml-ro" aria-label="Read-only" />}
          <ChevronDown />
        </button>
        {menu && (
          <div className="eml-menu" onMouseLeave={() => setMenu(false)}>
            {state?.accounts.map((a) => (
              <button key={a.id} className={a.id === account?.id ? 'active' : ''} onClick={() => { selectAccount(a.id); setMenu(false); nav('/mail/INBOX') }}>
                <Avatar from={accountAvatar(a)} size={20} /> <span className="eml-ellipsis">{accountLabel(a)}</span>
                {a.readOnly && <Lock className="eml-ro" aria-label="Read-only" />}
              </button>
            ))}
            <hr />
            <button onClick={() => nav('/setup')}><Settings /> Manage inboxes</button>
          </div>
        )}
      </div>

      {readOnly ? (
        <p className="eml-muted small eml-side-note eml-ro-note"><Lock /> Read-only. Change it under Manage inboxes.</p>
      ) : (
        <button className="eml-compose-btn" onClick={() => openCompose()}><Pencil /> Compose</button>
      )}

      {foldersError && (
        <div className="eml-side-error">
          <AlertCircle /> <span className="eml-grow">{foldersError.message}</span>
          {errorCode(foldersError) && errorCode(foldersError) !== 'reauth' && (
            <button className="eml-icon-btn small" title="Try again" aria-label="Try again" onClick={reloadFolders}><RefreshCw /></button>
          )}
        </div>
      )}
      {caps.folderTree ? (
        <nav className="eml-folders">
          <div className="eml-side-head">
            <span>Folders</span>
            {!readOnly && <button className="eml-icon-btn small" title="New folder" aria-label="New folder" onClick={() => void newFolder()}><Plus /></button>}
          </div>
          <FolderTree folders={folders} accountId={account?.id ?? ''} />
          {foldersTimedOut && <p className="eml-muted small eml-side-note">Outlook was slow, so some folders are not listed. Skip big folders under Manage inboxes.</p>}
        </nav>
      ) : (
        <FlatFolders folders={folders} readOnly={readOnly} onNew={() => void newFolder()} />
      )}
    </aside>
  )
}

function FolderLink({ f, depth = 0, toggle, open }: { f: Folder; depth?: number; toggle?: () => void; open?: boolean }) {
  const Icon = (f.role && ROLE_ICON[f.role]) || (f.kind === 'user' ? FolderIcon : Inbox)
  return (
    <NavLink to={`/mail/${encodeURIComponent(f.id)}`} className={({ isActive }) => `eml-folder${isActive ? ' active' : ''}`} style={depth ? { paddingLeft: 12 + depth * 16 } : undefined} title={f.path}>
      {toggle ? (
        <span
          className="eml-twisty"
          role="button"
          aria-label={open ? `Collapse ${f.name}` : `Expand ${f.name}`}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggle()
          }}
        >
          {open ? <ChevronDown /> : <ChevronRight />}
        </span>
      ) : (
        depth > 0 && <span className="eml-twisty" />
      )}
      <Icon /> <span className="eml-grow eml-ellipsis">{f.name}</span>
      {!!f.unread && <span className="eml-count">{f.unread}</span>}
    </NavLink>
  )
}

/** Folders as a collapsible tree (Outlook). Open folders are remembered per account. */
function FolderTree({ folders, accountId }: { folders: Folder[]; accountId: string }) {
  const { folderId = 'INBOX' } = useParams()
  const storeKey = `monorail.email.openFolders.${accountId}`
  const [open, setOpen] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(storeKey) ?? '["INBOX"]') as string[]))
  useEffect(() => setOpen(new Set(JSON.parse(localStorage.getItem(storeKey) ?? '["INBOX"]') as string[])), [storeKey])

  const { roots, children, byId } = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    const children = new Map<string, Folder[]>()
    const roots: Folder[] = []
    for (const f of folders) {
      if (f.parentId && byId.has(f.parentId)) children.set(f.parentId, [...(children.get(f.parentId) ?? []), f])
      else roots.push(f)
    }
    const rank = (f: Folder) => (f.role ? ROLE_ORDER.indexOf(f.role) : ROLE_ORDER.length)
    roots.sort((a, b) => rank(a) - rank(b))
    return { roots, children, byId }
  }, [folders])

  // Keep the open folder's parents expanded.
  useEffect(() => {
    let p = byId.get(folderId)?.parentId
    const add: string[] = []
    while (p && byId.has(p)) {
      add.push(p)
      p = byId.get(p)?.parentId
    }
    if (add.some((x) => !open.has(x))) setOpen((s) => new Set([...s, ...add]))
  }, [folderId, byId, open])

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      localStorage.setItem(storeKey, JSON.stringify([...n]))
      return n
    })

  const render = (f: Folder, depth: number): React.ReactNode => {
    const kids = children.get(f.id)
    const isOpen = open.has(f.id)
    return (
      <div key={f.id}>
        <FolderLink f={f} depth={depth} toggle={kids ? () => toggle(f.id) : undefined} open={isOpen} />
        {kids && isOpen && kids.map((k) => render(k, depth + 1))}
      </div>
    )
  }
  return <>{roots.map((f) => render(f, 0))}</>
}

/** System folders, then labels (Gmail). */
function FlatFolders({ folders, readOnly, onNew }: { folders: Folder[]; readOnly: boolean; onNew: () => void }) {
  const system = folders.filter((f) => f.kind === 'system')
  const labels = folders.filter((f) => f.kind === 'user')
  return (
    <nav className="eml-folders">
      {system.map((f) => (
        <FolderLink key={f.id} f={f} />
      ))}
      <div className="eml-side-head">
        <span>Labels</span>
        {!readOnly && <button className="eml-icon-btn small" title="New label" aria-label="New label" onClick={onNew}><Plus /></button>}
      </div>
      {labels.length === 0 && <p className="eml-muted small eml-side-note">No labels yet.</p>}
      {labels.map((f) => (
        <NavLink key={f.id} to={`/mail/${encodeURIComponent(f.id)}`} className={({ isActive }) => `eml-folder${isActive ? ' active' : ''}`}>
          <Tag style={f.color ? { color: f.color } : undefined} /> <span className="eml-grow eml-ellipsis">{f.name}</span>
        </NavLink>
      ))}
    </nav>
  )
}
