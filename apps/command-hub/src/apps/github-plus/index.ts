import { lazy } from 'react'
import { FolderGit2 } from 'lucide-react'

import type { AppDefinition } from '../types'

export const gitHubPlusApp: AppDefinition = {
  id: 'github-plus',
  title: 'GitHub+',
  description: 'Browse local git repositories the way you would on GitHub. Nothing leaves this machine.',
  icon: FolderGit2,
  path: '/apps/github-plus',
  component: lazy(() => import('./GitHubPlusApp')),
  dataMethods: [
    'pickRepoFolder',
    'openRepo',
    'getRecents',
    'removeRecent',
    'listRefs',
    'listTree',
    'readBlob',
    'getLog',
    'countCommits',
    'getCommit',
    'compareRefs',
  ],
}
