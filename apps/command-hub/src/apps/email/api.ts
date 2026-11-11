import { isDesktop } from '@/modules/client'

import { invokeApp } from '../client'
import { sampleApi } from './sample'
import type { Account, Draft, EmailState, Folder, Thread, ThreadPage } from './types'

/** Everything the Email app asks of its backend (electron/apps/email). */
export interface EmailApi {
  getState(): Promise<EmailState>
  saveConnectorConfig(kind: string, values: Record<string, string>, clearSecrets?: string[]): Promise<EmailState>
  /** Opens the provider's sign-in page in the browser; resolves once the user comes back. */
  signIn(kind: string): Promise<Account>
  cancelSignIn(): Promise<boolean>
  removeAccount(accountId: string): Promise<EmailState>
  listFolders(accountId: string): Promise<Folder[]>
  listThreads(accountId: string, opts: { folderId?: string; query?: string; pageToken?: string }): Promise<ThreadPage>
  getThread(accountId: string, threadId: string): Promise<Thread>
  modifyThread(accountId: string, threadId: string, add: string[], remove: string[]): Promise<{ id: string; labelIds: string[] }>
  archive(accountId: string, threadId: string): Promise<{ id: string }>
  markRead(accountId: string, threadId: string, read: boolean): Promise<{ id: string }>
  createFolder(accountId: string, name: string): Promise<Folder>
  send(accountId: string, draft: Draft): Promise<{ id: string; threadId: string }>
}

const APP_ID = 'email'

/** Thrown when an account's sign-in expired; the page offers Reconnect. */
export class ReauthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReauthError'
  }
}

/** Electron wraps errors as "Error invoking remote method '…': Error: msg"; keep just msg. */
async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invokeApp<T>(APP_ID, method, args)
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    if (msg.startsWith('[reauth] ')) throw new ReauthError(msg.slice(9))
    throw new Error(msg)
  }
}

const desktopApi: EmailApi = {
  getState: () => call('getState'),
  saveConnectorConfig: (kind, values, clearSecrets) => call('saveConnectorConfig', { kind, values, clearSecrets }),
  signIn: (kind) => call('signIn', { kind }),
  cancelSignIn: () => call('cancelSignIn'),
  removeAccount: (accountId) => call('removeAccount', { accountId }),
  listFolders: (accountId) => call('listFolders', { accountId }),
  listThreads: (accountId, opts) => call('listThreads', { accountId, ...opts }),
  getThread: (accountId, threadId) => call('getThread', { accountId, threadId }),
  modifyThread: (accountId, threadId, add, remove) => call('modifyThread', { accountId, threadId, add, remove }),
  archive: (accountId, threadId) => call('archive', { accountId, threadId }),
  markRead: (accountId, threadId, read) => call('markRead', { accountId, threadId, read }),
  createFolder: (accountId, name) => call('createFolder', { accountId, name }),
  send: (accountId, draft) => call('send', { accountId, draft }),
}

/** In the browser dev server there is no backend, so the app shows a fictional sample inbox. */
export const api: EmailApi = isDesktop() ? desktopApi : sampleApi
