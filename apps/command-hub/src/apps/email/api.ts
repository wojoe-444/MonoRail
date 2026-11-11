import { isDesktop } from '@/modules/client'

import { invokeApp } from '../client'
import { sampleApi } from './sample'
import type { Account, DiscoverResult, Draft, EmailState, Folder, FolderList, ListOptions, SearchResult, Thread, ThreadPage } from './types'

/** Everything the Email app asks of its backend (electron/apps/email). */
export interface EmailApi {
  getState(): Promise<EmailState>
  saveConnectorConfig(kind: string, values: Record<string, string>, clearSecrets?: string[]): Promise<EmailState>
  /** Opens the provider's sign-in page in the browser; resolves once the user comes back. */
  signIn(kind: string): Promise<Account>
  cancelSignIn(): Promise<boolean>
  removeAccount(accountId: string): Promise<EmailState>
  /** Connectors without sign-in (Outlook): what can be added from this PC. */
  discover(kind: string): Promise<DiscoverResult>
  addStores(kind: string, picks: { key: string; readOnly: boolean }[]): Promise<{ added: Account[]; state: EmailState }>
  updateAccount(accountId: string, patch: { readOnly?: boolean; skipFolders?: string[] }): Promise<EmailState>
  listFolders(accountId: string): Promise<FolderList>
  listThreads(accountId: string, opts: ListOptions): Promise<ThreadPage>
  /** One search across several accounts, merged newest first. */
  searchAccounts(accountIds: string[], opts: Omit<ListOptions, 'folderId' | 'pageToken'>): Promise<SearchResult>
  getThread(accountId: string, threadId: string): Promise<Thread>
  modifyThread(accountId: string, threadId: string, add: string[], remove: string[]): Promise<{ id: string; labelIds: string[] }>
  archive(accountId: string, threadId: string): Promise<{ id: string }>
  markRead(accountId: string, threadId: string, read: boolean): Promise<{ id: string }>
  createFolder(accountId: string, name: string): Promise<Folder>
  send(accountId: string, draft: Draft): Promise<{ id: string; threadId: string }>
}

const APP_ID = 'email'

/**
 * An error the page acts on. code: reauth (sign-in expired: offer Reconnect),
 * not-running (Outlook is closed: say so, offer Retry), timeout, read-only,
 * store-missing, not-found, unavailable.
 */
export class MailError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'MailError'
    this.code = code
  }
}

/** Thrown when an account's sign-in expired; the page offers Reconnect. */
export class ReauthError extends MailError {
  constructor(message: string) {
    super('reauth', message)
    this.name = 'ReauthError'
  }
}

/** "[code] message" from the backend (IPC drops error fields), as an error. */
export function toMailError(msg: string): Error {
  const m = /^\[([a-z-]+)\] ([\s\S]*)$/.exec(msg)
  if (!m) return new Error(msg)
  return m[1] === 'reauth' ? new ReauthError(m[2]) : new MailError(m[1], m[2])
}

export const errorCode = (e: unknown) => (e instanceof MailError ? e.code : null)

/** Electron wraps errors as "Error invoking remote method '…': Error: msg"; keep just msg. */
async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invokeApp<T>(APP_ID, method, args)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    throw toMailError(msg)
  }
}

const desktopApi: EmailApi = {
  getState: () => call('getState'),
  saveConnectorConfig: (kind, values, clearSecrets) => call('saveConnectorConfig', { kind, values, clearSecrets }),
  signIn: (kind) => call('signIn', { kind }),
  cancelSignIn: () => call('cancelSignIn'),
  removeAccount: (accountId) => call('removeAccount', { accountId }),
  discover: (kind) => call('discover', { kind }),
  addStores: (kind, picks) => call('addStores', { kind, picks }),
  updateAccount: (accountId, patch) => call('updateAccount', { accountId, ...patch }),
  listFolders: (accountId) => call('listFolders', { accountId }),
  listThreads: (accountId, opts) => call('listThreads', { accountId, ...opts }),
  searchAccounts: (accountIds, opts) => call('searchAccounts', { accountIds, ...opts }),
  getThread: (accountId, threadId) => call('getThread', { accountId, threadId }),
  modifyThread: (accountId, threadId, add, remove) => call('modifyThread', { accountId, threadId, add, remove }),
  archive: (accountId, threadId) => call('archive', { accountId, threadId }),
  markRead: (accountId, threadId, read) => call('markRead', { accountId, threadId, read }),
  createFolder: (accountId, name) => call('createFolder', { accountId, name }),
  send: (accountId, draft) => call('send', { accountId, draft }),
}

/** In the browser dev server there is no backend, so the app shows a fictional sample inbox. */
export const api: EmailApi = isDesktop() ? desktopApi : sampleApi
