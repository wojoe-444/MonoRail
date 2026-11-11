import { useMemo } from 'react'
import { Bot, BookOpen, History, House, KeyRound, LayoutGrid } from 'lucide-react'

import { useExtensionList } from '@/extensions/store'
import type { ExtensionList } from '@/extensions/types'
import { allModules } from '@/modules/registry'
import type { IconComponent } from '@/modules/types'

export interface NavItem {
  /** Route path, e.g. "/agents". Also the item's identity. */
  path: string
  label: string
  icon: IconComponent
  badge?: string
}

export interface NavSection {
  heading?: string
  items: NavItem[]
}

/**
 * Built-in destinations. Apps come from `src/apps/registry.ts`, modules add
 * theirs from `src/modules/registry.ts`, and installed extensions add theirs
 * through the same registries (src/extensions).
 */
function coreSections(): NavSection[] {
  return [
    {
      // Apps is one destination: the Apps page shows every app (built in and
      // from extensions) as a card, and each app opens full screen.
      items: [
        { path: '/', label: 'Home', icon: House },
        { path: '/apps', label: 'Apps', icon: LayoutGrid },
      ],
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
        // Settings and Extensions are modules and join this section from the registry.
      ],
    },
  ]
}

/** Merge module nav entries into sections. New module sections go before "Configure". */
export function buildNavSections(list: ExtensionList): NavSection[] {
  const sections = coreSections().filter((s) => s.items.length > 0 || s.heading === 'Configure')
  const sorted = [...allModules(list)].sort((a, b) => (a.nav.order ?? 100) - (b.nav.order ?? 100))
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

/** Nav sections, updated when extensions are installed, removed or toggled. */
export function useNavSections(): NavSection[] {
  const list = useExtensionList()
  return useMemo(() => buildNavSections(list), [list])
}
