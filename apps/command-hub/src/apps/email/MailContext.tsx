import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api } from './api'
import type { Account, ConnectorCapabilities, ConnectorInfo, Draft, EmailState, Folder } from './types'

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
  foldersError: Error | null
  /** The folder walk stopped early (slow mailbox). */
  foldersTimedOut: boolean
  /** The connector of an account (current one by default). */
  connectorOf: (a?: Account | null) => ConnectorInfo | undefined
  /** Capabilities of the current account's connector. */
  caps: ConnectorCapabilities
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
  const [foldersError, setFoldersError] = useState<Error | null>(null)
  const [foldersTimedOut, setFoldersTimedOut] = useState(false)
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
      (r) => {
        setFolders(r.folders)
        setFoldersTimedOut(r.timedOut)
        setFoldersError(null)
      },
      (e) => setFoldersError(e instanceof Error ? e : new Error(String(e))),
    )
  }, [account])

  useEffect(() => {
    setFolders([])
    reloadFolders()
  }, [reloadFolders, version])

  const connectorOf = useCallback((a?: Account | null) => state?.connectors.find((c) => c.kind === (a ?? account)?.kind), [state, account])

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
    foldersTimedOut,
    connectorOf,
    caps: connectorOf()?.capabilities ?? {},
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
