import {
  Bot,
  BookOpen,
  History,
  House,
  KeyRound,
  Settings,
  type LucideIcon,
} from 'lucide-react'

import { modules } from '@/modules/registry'

export interface NavItem {
  /** Route path, e.g. "/agents". Also the item's identity. */
  path: string
  label: string
  icon: LucideIcon
  badge?: string
}

export interface NavSection {
  heading?: string
  items: NavItem[]
}

/** Built-in destinations. Modules add theirs from `src/modules/registry.ts`. */
const coreSections: NavSection[] = [
  {
    items: [{ path: '/', label: 'Home', icon: House }],
  },
  {
    heading: 'Workspace',
    items: [
      { path: '/agents', label: 'Agents', icon: Bot, badge: '4' },
      { path: '/runs', label: 'Runs', icon: History },
      { path: '/library', label: 'Library', icon: BookOpen },
    ],
  },
  {
    heading: 'Configure',
    items: [
      { path: '/connections', label: 'Connections', icon: KeyRound },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** Merge module nav entries into sections. New module sections go before "Configure". */
function buildSections(): NavSection[] {
  const sections = coreSections.map((s) => ({ ...s, items: [...s.items] }))
  const sorted = [...modules].sort((a, b) => (a.nav.order ?? 100) - (b.nav.order ?? 100))
  for (const m of sorted) {
    let section = sections.find((s) => s.heading === m.nav.section)
    if (!section) {
      section = { heading: m.nav.section, items: [] }
      const configureIdx = sections.findIndex((s) => s.heading === 'Configure')
      sections.splice(configureIdx === -1 ? sections.length : configureIdx, 0, section)
    }
    section.items.push({ path: m.path, label: m.title, icon: m.icon, badge: m.nav.badge })
  }
  return sections
}

export const navSections: NavSection[] = buildSections()

export const allNavItems = navSections.flatMap((s) => s.items)
