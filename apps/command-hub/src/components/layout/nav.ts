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
  /** Subpages, drawn indented under this item. One level deep. */
  children?: NavItem[]
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
        {
          path: '/agents',
          label: 'Agents',
          icon: Bot,
          badge: '4',
          // Agent Chat (a module) joins these through nav.parent.
          children: [
            { path: '/agents/runs', label: 'Runs', icon: History },
            { path: '/agents/library', label: 'Library', icon: BookOpen },
          ],
        },
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
    const item: NavItem = { path: m.path, label: m.title, icon: m.icon, badge: m.nav.badge }
    const parent = m.nav.parent ? findNavItem(sections, m.nav.parent)?.item : undefined
    if (parent) {
      parent.children = [...(parent.children ?? []), item]
      continue
    }
    let section = sections.find((s) => s.heading === m.nav.section)
    if (!section) {
      section = { heading: m.nav.section, items: [] }
      const configureIdx = sections.findIndex((s) => s.heading === 'Configure')
      sections.splice(configureIdx === -1 ? sections.length : configureIdx, 0, section)
    }
    section.items.push(item)
  }
  return sections
}

/** Every item, subpages included, in drawer order. */
export function flattenNav(sections: NavSection[]): NavItem[] {
  return sections.flatMap((s) => s.items.flatMap((i) => [i, ...(i.children ?? [])]))
}

/** Find an item (or subpage) by path, with its section and parent item. */
export function findNavItem(
  sections: NavSection[],
  path: string,
): { item: NavItem; section: NavSection; parent?: NavItem } | undefined {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.path === path) return { item, section }
      const child = item.children?.find((c) => c.path === path)
      if (child) return { item: child, section, parent: item }
    }
  }
  return undefined
}

/** Nav sections, updated when extensions are installed, removed or toggled. */
export function useNavSections(): NavSection[] {
  const list = useExtensionList()
  return useMemo(() => buildNavSections(list), [list])
}
