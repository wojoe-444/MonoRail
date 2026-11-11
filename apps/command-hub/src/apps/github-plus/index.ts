import { lazy } from 'react'
import { FolderGit2 } from 'lucide-react'

import type { AppDefinition } from '../types'

export const gitHubPlusApp: AppDefinition = {
  id: 'github-plus',
  title: 'GitHub+',
  description: 'Browse local git repositories the way you would on GitHub, next to your repositories on github.com.',
  icon: FolderGit2,
  path: '/apps/github-plus',
  placement: 'workspace',
  component: lazy(() => import('./GitHubPlusApp')),
  dataMethods: [
    'pickRepoFolder',
    'openRepo',
    'getRecents',
    'removeRecent',
    'getLinked',
    'listRefs',
    'listTree',
    'readBlob',
    'getLog',
    'countCommits',
    'getCommit',
    'compareRefs',
    'githubRepos',
    'githubTarget',
    'cloneGitHubRepo',
    'openOnGitHub',
  ],
}
