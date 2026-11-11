// Types for testing.mjs: run a MonoRail extension backend in plain Node tests.

import type { Backend, BackendContext } from './backend'

export interface TestOptions {
  /** monorail.json contents; read from `root` when omitted. */
  manifest?: { id?: string; name?: string; version?: string; permissions?: object; backend?: { main: string }; settings?: { key: string; type?: string; default?: unknown }[] }
  /** Data folder; a temporary one (deleted by close()) when omitted. */
  dataDir?: string
  extensionDir?: string
  /** Folders "the user picked". */
  folders?: { path: string; write: boolean }[]
  /** Secrets stored beforehand. */
  secrets?: Record<string, string>
  /** false simulates a computer without encryption (EXT_SECRETS_UNAVAILABLE). */
  secretsAvailable?: boolean
  /** Settings values "the user entered"; defaults come from manifest.settings. */
  settings?: Record<string, unknown>
}

export interface LoadOptions extends TestOptions {
  /** The extension folder; defaults to the current folder. */
  root?: string
  /** The backend file, if not backend.main from monorail.json. */
  main?: string
  /** The version that "last used" the data folder, passed to migrate(). Default null. */
  previousVersion?: string | null
}

export declare class MonoRailTestError extends Error {
  readonly code: string
  readonly details?: unknown
}

export interface TestRecord {
  events: { channel: string; payload: unknown }[]
  logs: { level: 'info' | 'warn' | 'error'; line: string }[]
  secrets: Map<string, string>
  dataDir: string
}

export declare function createTestContext(opts?: TestOptions): { ctx: BackendContext; record: TestRecord }

export interface LoadedBackend extends TestRecord {
  ctx: BackendContext
  backend: Backend
  invoke<T = unknown>(method: string, args?: unknown): Promise<T>
  /** Simulate saving settings: settingsChanged(), or stop() + start(). */
  changeSettings(values: Record<string, unknown>): Promise<void>
  close(opts?: { keepData?: boolean }): Promise<void>
}

export declare function loadBackend(opts?: LoadOptions): Promise<LoadedBackend>
