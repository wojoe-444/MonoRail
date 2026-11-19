import { lazy } from 'react'
import { FolderOpen } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Files: a file explorer for this PC with tabs, split panes, previews, pins
 * and color tags (electron/modules/files.cjs). Deleting goes to the Recycle Bin.
 */
export const filesModule: ModuleDefinition = {
  id: 'files',
  title: 'Files',
  description: 'A file explorer with tabs, split view, previews, pins and color tags.',
  icon: FolderOpen,
  path: '/files',
  nav: { section: 'Workspace', parent: '/tools' },
  layout: 'full',
  component: lazy(() => import('./FilesPage')),
  dataMethods: ['places', 'list', 'preview', 'thumbnail', 'search', 'folderSize', 'statMany', 'createFolder', 'createFile', 'rename', 'paste', 'trash', 'open', 'reveal'],
}
