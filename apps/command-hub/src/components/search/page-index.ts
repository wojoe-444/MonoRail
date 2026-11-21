import { useMemo } from 'react'

import { allApps } from '@/apps/registry'
import { flattenNav, SETTINGS_PATH, SETTINGS_SECTION, useNavSections } from '@/components/layout/nav'
import { useExtensionList } from '@/extensions/store'
import { allModules, findModuleByPath } from '@/modules/registry'
import { searchSettings } from '@/modules/settings/search'
import { useSettingsPages } from '@/modules/settings/SettingsLayout'
import type { IconComponent } from '@/modules/types'

import { matchesAll, rank, words } from './matching'

/** A page or a Settings page, card or option. */
export interface PageHit {
  kind: 'page' | 'setting'
  label: string
  detail: string
  path: string
  anchor?: string
  icon?: IconComponent
}

/**
 * Every page in the drawer (with its module's or app's description) plus the
 * Settings search (pages, cards and options). Settings pages come from the
 * Settings search only, so each is listed once.
 */
export function usePageIndex(): { pages: PageHit[]; settings: PageHit[]; search: (query: string) => PageHit[] } {
  const list = useExtensionList()
  const sections = useNavSections()
  const settingsPages = useSettingsPages()
  return useMemo(() => {
    const described = new Map<string, string>()
    for (const m of allModules(list)) described.set(m.path, m.description)
    for (const a of allApps(list)) described.set(a.path, a.description)
    const settingsPaths = new Set(settingsPages.map((p) => p.path))
    const iconOf = new Map(settingsPages.map((p) => [p.path, p.icon]))
    const pages: PageHit[] = flattenNav(sections)
      .filter((i) => i.path !== '/' && i.path !== SETTINGS_PATH && !settingsPaths.has(i.path))
      .map((i) => ({ kind: 'page', label: i.label, detail: described.get(i.path) ?? '', path: i.path, icon: i.icon }))
    const settings: PageHit[] = settingsPages.map((p) => ({
      kind: 'setting',
      label: p.path === SETTINGS_PATH ? 'Settings' : p.title,
      detail: p.description,
      path: p.path,
      icon: p.icon,
    }))

    const search = (query: string) => {
      const ws = words(query)
      if (!ws.length) return []
      // Best first: name starts with the first word, then name contains it,
      // then a match elsewhere. Pages come before Settings on a tie.
      const pageHits = pages.filter((h) => matchesAll(`${h.label} ${h.detail}`, ws)).map((h) => ({ h, score: rank(h.label, ws) }))
      // searchSettings already checks every word and orders its own hits.
      const settingsHits = searchSettings(query, settingsPages).map((s, i) => ({
        h: {
          kind: 'setting' as const,
          label: s.label,
          detail: s.page === s.label ? `Settings · ${s.detail}` : `Settings › ${s.page} · ${s.detail}`,
          path: s.path,
          anchor: s.anchor,
          icon: iconOf.get(s.path),
        },
        score: rank(s.label, ws) + 0.5 + i / 1000,
      }))
      return [...pageHits, ...settingsHits].sort((a, b) => a.score - b.score).map((x) => x.h)
    }
    return { pages, settings, search }
  }, [list, sections, settingsPages])
}

/** True on a Settings page: the palette then opens on the Settings scope. */
export const isSettingsPath = (path: string) => findModuleByPath(path)?.nav.section === SETTINGS_SECTION
