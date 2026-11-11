import type { ComponentType, LazyExoticComponent } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * The app contract.
 *
 * An app is a full-screen experience that runs inside MonoHub. Unlike a
 * module (one page inside the hub's drawer + top bar), an app takes over the
 * whole window and may have its own look: its own colors, fonts, layout and
 * in-app routing. The hub always keeps one thing on screen: the 48px hub bar
 * from `AppFrame`, with a "Back to MonoHub" button, so the way out is the
 * same in every app.
 *
 * Adding an app is:
 *
 *   1. Create `src/apps/<id>/index.ts` exporting an `AppDefinition` with
 *      `path: '/apps/<id>'`.
 *   2. Add it to the list in `src/apps/registry.ts`. The "Apps" nav section
 *      and the router pick it up.
 *   3. If it needs local data, create `electron/apps/<id>/index.cjs` exporting
 *      a backend (same shape as a module backend) and add it to
 *      `electron/apps/index.cjs`. Call it with `invokeApp(id, method, args)`.
 */
export interface AppDefinition {
  /** Stable kebab-case id. Also the IPC namespace ("app:<id>") and the AppData subfolder. */
  id: string
  /** Name shown in the nav and in the hub bar. */
  title: string
  /** One-line summary. */
  description: string
  icon: LucideIcon
  /**
   * Route prefix, always "/apps/<id>". Everything under it belongs to the app,
   * so it can run its own router (e.g. react-router's HashRouter with
   * `basename={basePath}`).
   */
  path: string
  /** The app's root. Receives its route prefix. Use `lazy(() => import(...))`. */
  component: LazyExoticComponent<ComponentType<AppProps>> | ComponentType<AppProps>
  /** Methods the app's backend (electron/apps/<id>) exposes, listed for visibility. */
  dataMethods?: readonly string[]
}

export interface AppProps {
  /** The app's route prefix ("/apps/<id>"); pass it to an in-app router as its basename. */
  basePath: string
}
