import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api } from './api'
import type { Account, Draft, EmailState, Folder } from './types'

const ACCOUNT_KEY = 'monorail.email.account'

export interface ComposeRequest extends Partial<Draft> {
  /** Shown above the composer when replying. */
  title?: string
}

interface MailContextValue {
  state: EmailState | null
  stateError: string | null
  reloadState: () => Promise<EmailState | null>
  setState: (s: EmailState) => void
  account: Account | null
  selectAccount: (id: string) => void
  folders: Folder[]
  foldersError: string | null
  reloadFolders: () => void
  /** Bumped after a change (send, archive, label) so lists refetch. */
  version: number
  bump: () => void
  compose: ComposeRequest | null
  openCompose: (req?: ComposeRequest) => void
  closeCompose: () => void
  toast: string | null
  notify: (msg: string) => void
}

const Ctx = createContext<MailContextValue | null>(null)

export function useMail(): MailContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMail outside MailProvider')
  return v
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function MailProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EmailState | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(() => localStorage.getItem(ACCOUNT_KEY))
  const [folders, setFolders] = useState<Folder[]>([])
  const [foldersError, setFoldersError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [compose, setCompose] = useState<ComposeRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const reloadState = useCallback(async () => {
    try {
      const s = await api.getState()
      setState(s)
      setStateError(null)
      return s
    } catch (e) {
      setStateError(errText(e))
      return null
    }
  }, [])

  useEffect(() => {
    void reloadState()
  }, [reloadState])

  const account = useMemo(() => {
    const list = state?.accounts ?? []
    return list.find((a) => a.id === accountId) ?? list[0] ?? null
  }, [state, accountId])

  const selectAccount = useCallback((id: string) => {
    localStorage.setItem(ACCOUNT_KEY, id)
    setAccountId(id)
  }, [])

  const reloadFolders = useCallback(() => {
    if (!account) return
    api.listFolders(account.id).then(
      (f) => {
        setFolders(f)
        setFoldersError(null)
      },
      (e) => setFoldersError(errText(e)),
    )
  }, [account])

  useEffect(() => {
    setFolders([])
    reloadFolders()
  }, [reloadFolders, version])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200)
  }, [])

  const value: MailContextValue = {
    state,
    stateError,
    reloadState,
    setState,
    account,
    selectAccount,
    folders,
    foldersError,
    reloadFolders,
    version,
    bump: () => setVersion((v) => v + 1),
    compose,
    openCompose: (req = {}) => setCompose(req),
    closeCompose: () => setCompose(null),
    toast,
    notify,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
