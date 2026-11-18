import { lazy } from 'react'
import { Globe } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Browser: a tabbed web browser inside MonoRail with its own sign-ins, kept
 * per profile. Webview rules: electron/browser-pane.cjs; backend:
 * electron/modules/browser.cjs. Guide: docs/guide/workspace/browser.md.
 */
export const browserModule: ModuleDefinition = {
  id: 'browser',
  title: 'Browser',
  description: 'Browse the web inside MonoRail, with tabs. Sign in to a site once and you stay signed in.',
  icon: Globe,
  path: '/browser',
  nav: { section: 'Workspace', parent: '/tools' },
  layout: 'full',
  component: lazy(() => import('./BrowserPage')),
  dataMethods: ['clearData', 'openExternal'],
}
