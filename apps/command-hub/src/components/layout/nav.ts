import { useMemo } from 'react'
import { Bot, History, House, LayoutGrid, Settings } from 'lucide-react'

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
  /** Drawn at the bottom of the drawer instead of in the scrolling list (Settings). */
  pinned?: boolean
  items: NavItem[]
}

/**
 * Built-in destinations. Apps come from `src/apps/registry.ts`, modules add
 * theirs from `src/modules/registry.ts`, and installed extensions add theirs
 * through the same registries (src/extensions).
 */
function coreSections(list: ExtensionList): NavSection[] {
  // Workspace apps (GitHub+, Tasks, Email) are pages under the drawer; their
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
      // Last in the drawer: the Wiki module joins it from the registry.
      heading: 'Help',
      items: [],
    },
  ]
}

/** The section name that makes a module a Settings page. */
export const SETTINGS_SECTION = 'Settings'
/** The Settings home page: the one Settings button in the drawer opens it. */
export const SETTINGS_PATH = '/settings'

/**
 * Merge module nav entries into sections. New module sections go before
 * "Help". Settings pages (`nav.section: 'Settings'`) are not listed in the
 * drawer: they become subpages of the one Settings item, which sits in its
 * own pinned section at the bottom (no heading, so the breadcrumb reads
 * "MonoRail > Settings > Connections").
 */
export function buildNavSections(list: ExtensionList): NavSection[] {
  const sections = coreSections(list).filter((s) => s.items.length > 0 || s.heading === 'Help')
  const sorted = [...allModules(list)].sort((a, b) => (a.nav.order ?? 100) - (b.nav.order ?? 100))
  const settingsPages = sorted.filter((m) => m.nav.section === SETTINGS_SECTION)
  const home = settingsPages.find((m) => m.path === SETTINGS_PATH)
  for (const m of sorted) {
    if (m.nav.section === SETTINGS_SECTION) continue
    const item: NavItem = { path: m.path, label: m.title, icon: m.icon, badge: m.nav.badge }
    const parent = m.nav.parent ? findNavItem(sections, m.nav.parent)?.item : undefined
    if (parent) {
      parent.children = [...(parent.children ?? []), item]
      continue
    }
    let section = sections.find((s) => s.heading === m.nav.section)
    if (!section) {
      section = { heading: m.nav.section, items: [] }
      const helpIdx = sections.findIndex((s) => s.heading === 'Help')
      sections.splice(helpIdx === -1 ? sections.length : helpIdx, 0, section)
    }
    section.items.push(item)
  }
  const out = sections.filter((s) => s.items.length > 0)
  if (home) {
    const children = settingsPages.filter((m) => m !== home).map((m) => ({ path: m.path, label: m.title, icon: m.icon }))
    out.push({ pinned: true, items: [{ path: home.path, label: home.title, icon: Settings, children }] })
  }
  return out
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
