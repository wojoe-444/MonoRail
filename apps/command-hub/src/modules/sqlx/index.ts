import { lazy } from 'react'
import { FileCode2 } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * SQLX: Dataform .sqlx files with the config block as a form, so the SQL gets
 * the room. Files are read and saved in place in project folders the user
 * picked (electron/modules/sqlx.cjs); nothing is cached or copied.
 */
export const sqlxModule: ModuleDefinition = {
  id: 'sqlx',
  title: 'SQLX',
  description: 'Dataform .sqlx files with the config as a form and the SQL given room to breathe.',
  icon: FileCode2,
  path: '/sqlx',
  nav: { section: 'Workspace', parent: '/tools' },
  component: lazy(() => import('./SqlxPage')),
  dataMethods: ['listProjects', 'addProject', 'removeProject', 'listFiles', 'readFile', 'saveFile'],
}
