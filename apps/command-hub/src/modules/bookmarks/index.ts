import { lazy } from 'react'
import { Bookmark } from 'lucide-react'
import type { ModuleDefinition } from '../types'

export const bookmarksModule: ModuleDefinition = {
  id: 'bookmarks', title: 'Bookmarks', description: 'Quick access to links, files and folders.',
  icon: Bookmark, path: '/bookmarks', nav: { section: 'Workspace', parent: '/tools' },
  component: lazy(() => import('./BookmarksPage')), dataMethods: ['list', 'save', 'remove', 'open'],
}
