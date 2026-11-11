import { lazy } from 'react'
import { MessagesSquare } from 'lucide-react'

import type { ModuleDefinition } from '../types'

export const agentChatModule: ModuleDefinition = {
  id: 'agent-chat',
  title: 'Chat',
  description: 'Every local Claude Code and pi session, read from their logs on this machine.',
  icon: MessagesSquare,
  path: '/agents/chat',
  nav: { section: 'Workspace', parent: '/agents' },
  layout: 'fill',
  component: lazy(() => import('./AgentChatPage')),
  dataMethods: ['listSessions', 'getSession'],
}
