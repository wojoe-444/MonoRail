import { useMemo } from 'react'
import { Bot, History, House, LayoutGrid } from 'lucide-react'

import { apps, fullscreenApps, isWorkspaceApp } from '@/apps/registry'
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
  /** Subpages, drawn as a collapsible tree under this item. One level deep. */
  children?: NavItem[]
  /** Also the current item for any path under it (a workspace app's own routes). */
  matchPrefix?: boolean
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
function coreSections(list: ExtensionList): NavSection[] {
  // Workspace apps (GitHub+, Jira+, Email) are pages under the drawer; their
  // own routes all belong to their one nav item.
  const workspaceApps: NavItem[] = apps
    .filter(isWorkspaceApp)
    .map((a) => ({ path: a.path, label: a.title, icon: a.icon, matchPrefix: true }))
  return [
    {
      // Apps is one destination: the Apps page shows every full-screen app
      // (from extensions) as a card. Hidden while there are none.
      items: [
        { path: '/', label: 'Home', icon: House },
        ...(fullscreenApps(list).length > 0 ? [{ path: '/apps', label: 'Apps', icon: LayoutGrid }] : []),
      ],
    },
    {
      heading: 'Workspace',
      items: [
        {
          path: '/agents',
          label: 'Agents',
          icon: Bot,
          // Agent Chat (a module) joins these through nav.parent.
          children: [
            { path: '/agents/runs', label: 'Runs', icon: History },
          ],
        },
        ...workspaceApps,
      ],
    },
    {
      heading: 'Configure',
      items: [
        // Connections, Extensions and Settings are modules and join this section from the registry.
      ],
    },
    {
      // Last in the drawer: the Wiki module joins it from the registry.
      heading: 'Help',
      items: [],
    },
  ]
}

/** Merge module nav entries into sections. New module sections go before "Configure". */
export function buildNavSections(list: ExtensionList): NavSection[] {
  const sections = coreSections(list).filter((s) => s.items.length > 0 || s.heading === 'Configure' || s.heading === 'Help')
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
  return sections.filter((s) => s.items.length > 0 || s.heading === 'Configure')
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
  // A workspace app's own routes ("/apps/github-plus/..." or "...?q").
  for (const section of sections) {
    for (const item of section.items) {
      if (item.matchPrefix && (path.startsWith(`${item.path}/`) || path.startsWith(`${item.path}?`))) return { item, section }
    }
  }
  return undefined
}

/** Nav sections, updated when extensions are installed, removed or toggled. */
export function useNavSections(): NavSection[] {
  const list = useExtensionList()
  return useMemo(() => buildNavSections(list), [list])
}
