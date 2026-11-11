import {
  Bot,
  BookOpen,
  History,
  House,
  KeyRound,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type PageId = 'home' | 'agents' | 'runs' | 'library' | 'connections' | 'settings'

export interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  badge?: string
}

export interface NavSection {
  heading?: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    items: [{ id: 'home', label: 'Home', icon: House }],
  },
  {
    heading: 'Workspace',
    items: [
      { id: 'agents', label: 'Agents', icon: Bot, badge: '4' },
      { id: 'runs', label: 'Runs', icon: History },
      { id: 'library', label: 'Library', icon: BookOpen },
    ],
  },
  {
    heading: 'Configure',
    items: [
      { id: 'connections', label: 'Connections', icon: KeyRound },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

export const allNavItems = navSections.flatMap((s) => s.items)
