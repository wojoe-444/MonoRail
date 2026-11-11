import type { AppDefinition, AppProps } from '@/apps/types'
import { PageHeader } from '@/components/layout/PageHeader'
import type { ModuleDefinition } from '@/modules/types'

import { ExtensionFrame } from './ExtensionFrame'
import { extensionIcon } from './ExtensionIcon'
import { activeExtensions } from './store'
import type { ExtensionList, ExtensionSummary } from './types'

/**
 * Turns installed extensions into the same ModuleDefinition / AppDefinition
 * objects the built-in registries use, so the nav, router and app frame treat
 * them like any other module or app.
 *
 *   extension module  -> route /x/<extension-id>/<module-id>
 *   extension app     -> id "<extension-id>.<app-id>", route /apps/<extension-id>.<app-id>
 */

const cache = new Map<string, ModuleDefinition | AppDefinition>()

function cached<T extends ModuleDefinition | AppDefinition>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined
  if (!v) cache.set(key, (v = make()))
  return v
}

function key(ext: ExtensionSummary, cid: string, apiVersion: string) {
  // Anything the definition captures is in the key, so a changed extension gets a fresh one.
  return JSON.stringify([ext.id, cid, ext.revision, ext.version, ext.name, ext.hasIcon, apiVersion, ext.contributes])
}

export function extensionModules(list: ExtensionList): ModuleDefinition[] {
  return activeExtensions(list).flatMap((ext) =>
    ext.contributes.modules.map((c) =>
      cached(`m:${key(ext, c.id, list.apiVersion)}`, (): ModuleDefinition => {
        function ExtensionModulePage() {
          return (
            <div className="flex flex-col gap-8">
              <PageHeader eyebrow={ext.name} title={c.title} description={c.description || undefined} />
              <ExtensionFrame ext={ext} contribution={c} kind="module" apiVersion={list.apiVersion} />
            </div>
          )
        }
        return {
          id: `x.${ext.id}.${c.id}`,
          title: c.title,
          description: c.description,
          icon: extensionIcon(ext.id, c.id, ext.hasIcon || !!c.icon),
          path: `/x/${ext.id}/${c.id}`,
          nav: { section: c.nav.section, order: c.nav.order },
          component: ExtensionModulePage,
        }
      }),
    ),
  )
}

export function extensionApps(list: ExtensionList): AppDefinition[] {
  return activeExtensions(list).flatMap((ext) =>
    ext.contributes.apps.map((c) =>
      cached(`a:${key(ext, c.id, list.apiVersion)}`, (): AppDefinition => {
        function ExtensionAppRoot(_props: AppProps) {
          return <ExtensionFrame ext={ext} contribution={c} kind="app" apiVersion={list.apiVersion} />
        }
        const id = `${ext.id}.${c.id}`
        return {
          id,
          title: c.title,
          description: c.description || ext.description,
          icon: extensionIcon(ext.id, c.id, ext.hasIcon || !!c.icon),
          path: `/apps/${id}`,
          component: ExtensionAppRoot,
        }
      }),
    ),
  )
}
