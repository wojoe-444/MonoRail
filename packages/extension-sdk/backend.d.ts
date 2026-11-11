// Types for a MonoRail extension backend (the file named by "backend.main").
//
//   /** @type {import('../monorail-sdk/backend').Backend} */
//   module.exports = {
//     async migrate(ctx, fromVersion) { ... }, // optional, runs before start() after a version change
//     async start(ctx) { ... },                // optional, runs when the process starts
//     async stop(ctx) { ... },                 // optional, runs before it is stopped
//     methods: {
//       async getStatus(ctx, args) { return { ok: true } },
//     },
//   }
//
// The backend runs in its own process under Node's permission model. It can
// read its own files, read and write ctx.dataDir, and use only what the
// manifest's "permissions" (and folders the user picked) allow. Arguments,
// results and event payloads are plain JSON.

/** Error codes MonoRail itself uses. Your own codes can be any short identifier. */
export type MonoRailErrorCode =
  | 'EXT_BACKEND_ERROR'
  | 'EXT_UNKNOWN_METHOD'
  | 'EXT_TIMEOUT'
  | 'EXT_NOT_ACTIVE'
  | 'EXT_NO_BACKEND'
  | 'EXT_START_FAILED'
  | 'EXT_CRASHED'
  | 'EXT_BAD_PAYLOAD'
  | 'EXT_NETWORK_DENIED'
  | 'EXT_PROCESS_DENIED'
  | 'EXT_FS_DENIED'
  | 'EXT_SECRETS_UNAVAILABLE'
  | 'EXT_INVALID_SECRET'
  | 'EXT_INVALID_SETTINGS'
  | 'EXT_HOST_ERROR'

export interface Secrets {
  /** The stored value, or null if there is none. */
  get(name: string): Promise<string | null>
  /** Store a value (a string up to 64 KB). Names: 1-100 of A-Z a-z 0-9 . _ - */
  set(name: string, value: string): Promise<void>
  delete(name: string): Promise<void>
  /** Names of the stored secrets (never the values). */
  list(): Promise<string[]>
}

export interface BackendContext {
  /** Extension API version of the host, e.g. "1.1.0". */
  readonly apiVersion: string
  readonly extension: { readonly id: string; readonly name: string; readonly version: string }
  /** Private, writable folder for settings, caches and state. Kept across updates and reloads. */
  readonly dataDir: string
  /** The extension's own files (read-only). */
  readonly extensionDir: string
  /** Folders the user granted through monorail.pickFolder(). */
  readonly folders: ReadonlyArray<{ readonly path: string; readonly write: boolean }>
  /** The normalized permissions from monorail.json. */
  readonly permissions: {
    network: boolean | string[]
    process: boolean | string[]
    filesystem: { read: string[]; write: string[]; pickFolders: boolean }
  }
  log(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  /**
   * Push an event to every open page of this extension: monorail.on(channel, cb).
   * Fire and forget: not queued, dropped when no page is open. The payload must
   * be plain JSON under 1 MB (else throws EXT_BAD_PAYLOAD).
   */
  emit(channel: string, payload?: unknown): void
  /** Throw an error the page receives with this code, message and JSON details. */
  fail(code: string, message: string, details?: unknown): never
  /** Tokens and passwords, encrypted by MonoRail with the system key store (API 1.1). */
  readonly secrets: Secrets
  /** The settings declared in monorail.json, filled in by the user (API 1.1). */
  readonly settings: {
    /** Every field: saved value, else default, else null (false for booleans). Secret fields decrypted. */
    get<V extends Record<string, unknown> = Record<string, unknown>>(): Promise<V>
  }
}

export type BackendMethod<A = any, R = unknown> = (ctx: BackendContext, args: A) => R | Promise<R>

export interface Backend {
  /**
   * Bring ctx.dataDir up to this version. Runs before start() whenever the
   * version that last used the data folder differs from this one: after an
   * update, a downgrade, or on first run (fromVersion is null when MonoRail has
   * no record, e.g. a fresh install). Throwing stops the backend from starting
   * (EXT_START_FAILED) and it runs again on the next start. API 1.1.
   */
  migrate?(ctx: BackendContext, fromVersion: string | null): void | Promise<void>
  start?(ctx: BackendContext): void | Promise<void>
  /**
   * The user saved new settings. Without this hook MonoRail restarts the
   * backend instead, so start() reads the new values. API 1.1.
   */
  settingsChanged?(ctx: BackendContext, values: Record<string, unknown>): void | Promise<void>
  stop?(ctx: BackendContext): void | Promise<void>
  methods: Record<string, BackendMethod>
}
