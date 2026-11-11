import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * The module contract.
 *
 * A module is a self-contained feature of MonoHub: it owns one nav entry,
 * one route, one page, and (optionally) a backend data source that runs in the
 * Electron main process. Adding a module is:
 *
 *   1. Create `src/modules/<id>/index.ts` exporting a `ModuleDefinition`.
 *   2. Add it to the list in `src/modules/registry.ts`.
 *   3. If it needs local data, create `electron/modules/<id>.cjs` exporting a
 *      `ModuleBackend` and add it to `electron/modules/index.cjs`.
 *
 * The nav, router and top bar read from the registry, so nothing else changes.
 */
export interface ModuleDefinition {
  /** Stable kebab-case id. Also the IPC namespace and the AppData subfolder. */
  id: string
  /** Label used in the nav and the top bar. */
  title: string
  /** One-line summary, shown in page headers and module listings. */
  description: string
  icon: LucideIcon
  /** Route path, e.g. "/claude-stats". Must be unique across the app. */
  path: string
  nav: {
    /** Nav section heading. Sections are created on demand, in registry order. */
    section: string
    /** Lower sorts first within the section. Defaults to 100. */
    order?: number
    badge?: string
  }
  /** The page. Use `lazy(() => import(...))` so modules load on demand. */
  component: LazyExoticComponent<ComponentType> | ComponentType
  /**
   * Methods the module's backend (electron/modules/<id>.cjs) exposes. Listed
   * here so the contract between page and backend is visible in one place.
   */
  dataMethods?: readonly string[]
}

/** Shape of the bridge the Electron preload exposes as `window.commandHub`. */
export interface CommandHubBridge {
  platform: string
  invoke<T = unknown>(moduleId: string, method: string, args?: unknown): Promise<T>
}

declare global {
  interface Window {
    commandHub?: CommandHubBridge
  }
}
