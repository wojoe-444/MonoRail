// Types for a MonoRail extension backend (the file named by "backend.main").
//
//   /** @type {import('../monorail-sdk/backend').Backend} */
//   module.exports = {
//     async start(ctx) { ... },              // optional, runs when the process starts
//     async stop(ctx) { ... },               // optional, runs before it is stopped
//     methods: {
//       async getStatus(ctx, args) { return { ok: true } },
//     },
//   }
//
// The backend runs in its own process under Node's permission model. It can
// read its own files, read and write ctx.dataDir, and use only what the
// manifest's "permissions" (and folders the user picked) allow. Return plain
// JSON-friendly values.

export interface BackendContext {
  /** Extension API version of the host, e.g. "1.0.0". */
  readonly apiVersion: string
  readonly extension: { readonly id: string; readonly name: string; readonly version: string }
  /** Private, writable folder for settings, caches and state. Kept across updates. */
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
  /** Push an event to the extension's open pages: monorail.on(channel, cb). */
  emit(channel: string, payload?: unknown): void
}

export type BackendMethod<A = any, R = unknown> = (ctx: BackendContext, args: A) => R | Promise<R>

export interface Backend {
  start?(ctx: BackendContext): void | Promise<void>
  stop?(ctx: BackendContext): void | Promise<void>
  methods: Record<string, BackendMethod>
}
