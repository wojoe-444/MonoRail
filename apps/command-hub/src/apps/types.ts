import type { ComponentType, LazyExoticComponent } from 'react'
import type { IconComponent } from '@/modules/types'

/**
 * The app contract.
 *
 * An app is an experience with its own look that runs inside MonoRail: its
 * own colors, fonts, layout and in-app routing. Where it sits depends on
 * `placement`:
 *
 * - `workspace` (the built-in apps): a Workspace page. The hub's drawer and
 *   top bar stay on screen and the app fills the page body below them.
 * - `fullscreen` (the default, and every extension app): the app takes over
 *   the whole window under the 48px hub bar from `AppFrame`, whose "Back to
 *   MonoRail" button is the way out in every app.
 *
 * Adding an app is:
 *
 *   1. Create `src/apps/<id>/index.ts` exporting an `AppDefinition` with
 *      `path: '/apps/<id>'`.
 *   2. Add it to the list in `src/apps/registry.ts`. The router picks it up;
 *      a workspace app gets a nav item under Workspace, a full-screen app a
 *      card on the Apps page (behind the single "Apps" nav item).
 *   3. If it needs local data, create `electron/apps/<id>/index.cjs` exporting
 *      a backend (same shape as a module backend) and add it to
 *      `electron/apps/index.cjs`. Call it with `invokeApp(id, method, args)`.
 */
export interface AppDefinition {
  /** Stable kebab-case id. Also the IPC namespace ("app:<id>") and the AppData subfolder. */
  id: string
  /** Name shown in the nav, the top bar breadcrumb or the hub bar. */
  title: string
  /** One-line summary. */
  description: string
  icon: IconComponent
  /**
   * Route prefix, always "/apps/<id>". Everything under it belongs to the app,
   * so it can run its own router (e.g. react-router's HashRouter with
   * `basename={basePath}`).
   */
  path: string
  /** The app's root. Receives its route prefix. Use `lazy(() => import(...))`. */
  component: LazyExoticComponent<ComponentType<AppProps>> | ComponentType<AppProps>
  /** Where the app sits: a Workspace page under the hub's drawer and top bar, or full screen (default). */
  placement?: 'workspace' | 'fullscreen'
  /** Methods the app's backend (electron/apps/<id>) exposes, listed for visibility. */
  dataMethods?: readonly string[]
}

export interface AppProps {
  /** The app's route prefix ("/apps/<id>"); pass it to an in-app router as its basename. */
  basePath: string
}
