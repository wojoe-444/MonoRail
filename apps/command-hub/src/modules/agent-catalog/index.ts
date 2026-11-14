import { BookOpen } from 'lucide-react'

import type { ModuleDefinition } from '../types'
import TemplatesPage from './CatalogLayout'

/**
 * Agent Catalog: Claude Code subagents on this computer (~/.claude/agents and
 * each allowed repo's .claude/agents), with an explainer page per subagent and
 * create / edit / duplicate / delete (electron/modules/agent-catalog.cjs).
 */
export const agentCatalogModule: ModuleDefinition = {
  id: 'agent-catalog',
  title: 'Catalog',
  description: 'Your Claude Code subagents: what each one does, and create, edit or delete them.',
  icon: BookOpen,
  path: '/agents/catalog',
  nav: { section: 'Workspace', parent: '/agents' },
  component: TemplatesPage,
  dataMethods: ['list', 'get', 'create', 'update', 'reset', 'remove'],
}
