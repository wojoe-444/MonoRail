import { lazy } from 'react'
import { NotebookPen } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Notes: an unstructured info dump under Home. Each note is a Markdown file in a
 * local git repo in the module's data folder (electron/modules/notes.cjs), which
 * GitHub+ lists as "Notes". The repo never gets a remote.
 */
export const notesModule: ModuleDefinition = {
  id: 'notes',
  title: 'Notes',
  description: 'Unstructured info dump: Markdown notes kept in a local git repo.',
  icon: NotebookPen,
  path: '/notes',
  nav: { section: 'Home', parent: '/' },
  component: lazy(() => import('./NotesPage')),
  dataMethods: ['list', 'get', 'create', 'save', 'flush', 'remove', 'history', 'version'],
}
