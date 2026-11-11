import { lazy } from 'react'
import { Mail } from 'lucide-react'

import type { AppDefinition } from '../types'

export const emailApp: AppDefinition = {
  id: 'email',
  title: 'Email',
  description: 'Read and send mail through inbox connectors. Starts with Google sign-in (Gmail).',
  icon: Mail,
  path: '/apps/email',
  component: lazy(() => import('./EmailApp')),
  dataMethods: [
    'getState',
    'saveConnectorConfig',
    'signIn',
    'cancelSignIn',
    'removeAccount',
    'listFolders',
    'listThreads',
    'getThread',
    'modifyThread',
    'archive',
    'markRead',
    'createFolder',
    'send',
  ],
}
