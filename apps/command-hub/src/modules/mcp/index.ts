import { lazy } from 'react'
import { Plug } from 'lucide-react'

import type { ModuleDefinition } from '../types'

/**
 * Agent access: connect Claude Code and other agents to MonoRail's MCP
 * server (electron/mcp), which agents start as `MonoRail.exe --mcp`.
 */
export const mcpModule: ModuleDefinition = {
  id: 'mcp',
  title: 'Agent access',
  description: 'Let Claude Code and other agents read MonoRail through its MCP server.',
  icon: Plug,
  path: '/mcp',
  nav: { section: 'Configure', order: 110 },
  component: lazy(() => import('./McpPage')),
  dataMethods: ['getSetup'],
}
