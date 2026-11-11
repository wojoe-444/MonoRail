import { lazy } from 'react'
import { LibraryBig } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Wiki: the documentation in the repo's docs/ folder, bundled into the app at
 * build time, so it always matches the installed version and works offline.
 * The repo files are the source; edit them, not this module.
 */
export const wikiModule: ModuleDefinition = {
  id: 'wiki',
  title: 'Wiki',
  description: 'How MonoRail works and how to build extensions, for this version.',
  icon: LibraryBig,
  path: '/wiki',
  nav: { section: 'Help', order: 100 },
  component: lazy(() => import('./WikiPage')),
}
