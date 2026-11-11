// Types for client.js: the page side of a MonoRail extension.

export interface MonoRailInfo {
  /** The extension API version of the MonoRail that loaded the page, e.g. "1.0.0". */
  apiVersion: string
  extension: { id: string; name: string; version: string }
  /** Which contribution this page is: a module page inside the hub, or a full-screen app. */
  contribution: { id: string; kind: 'module' | 'app' }
  theme: 'light' | 'dark'
}

export interface GrantedFolder {
  path: string
  write: boolean
}

export interface MonoRailClient {
  /** True inside MonoRail; false when the page is opened on its own (e.g. a Vite dev server). */
  readonly inMonoRail: boolean
  ready(): Promise<MonoRailInfo>
  /** Call a method of this extension's backend. */
  invoke<T = unknown>(method: string, args?: unknown): Promise<T>
  /** Events the backend sends with ctx.emit(channel, payload). Returns an unsubscribe function. */
  on<T = unknown>(channel: string, cb: (payload: T) => void): () => void
  onTheme(cb: (theme: 'light' | 'dark') => void): () => void
  /** Needs "filesystem": { "pickFolders": true }. Resolves to null if the user cancels. */
  pickFolder(options?: { write?: boolean }): Promise<GrantedFolder | null>
  /** Open an https:// link in the user's browser. */
  openExternal(url: string): Promise<void>
}

export const monorail: MonoRailClient
export default monorail
