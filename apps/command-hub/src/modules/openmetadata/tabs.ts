import type { ComponentType } from 'react'
import {
  BookOpenText,
  ChartPie,
  Compass,
  FileCode2,
  Gauge,
  GitFork,
  Home,
  Layers,
  Network,
  Server,
  Shapes,
  SlidersHorizontal,
  Sigma,
  Tags,
  Users,
} from 'lucide-react'

import { navigate } from '@/lib/router'

import type { View } from './util'

/**
 * The OpenMetadata page's tabs, after the MonoRail-Metadata app's drawer:
 * each is its own route (`/openmetadata/<id>`; Home is `/openmetadata`) and
 * shows in the page's command bar in the top bar. `catalog` is the
 * every-entity-type browser the page started as. `catalog: true` tabs read
 * the OpenMetadata catalog (local database, BigQuery copy or server) and wait
 * for it; the others (the semantic layer) do not.
 */
export interface OmTabDef {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Reads the OpenMetadata catalog, so it waits for the catalog to open. */
  catalog: boolean
  /** One line on what the tab is for (the command bar's info tooltip). */
  description: string
}

export const OM_TABS: OmTabDef[] = [
  { id: 'home', label: 'Home', icon: Home, catalog: true, description: 'What is in the catalog, what changed lately, and where to go next.' },
  { id: 'catalog', label: 'Catalog', icon: Shapes, catalog: true, description: 'Every entity type, the way OpenMetadata stores it: browse any of them and see every field, relationship and version.' },
  { id: 'explore', label: 'Explore', icon: Compass, catalog: true, description: 'Search and filter the data assets: tables, dashboards, pipelines, topics and more.' },
  { id: 'lineage', label: 'Lineage', icon: GitFork, catalog: true, description: 'Where data comes from and where it goes, as a graph around one asset.' },
  { id: 'semantic-models', label: 'Semantic models', icon: Network, catalog: false, description: "The semantic layer's models: entities, dimensions and measures over your tables." },
  { id: 'metrics', label: 'Metrics', icon: Sigma, catalog: false, description: 'Business metrics with their definition, lineage and dimensions.' },
  { id: 'query', label: 'Query builder', icon: SlidersHorizontal, catalog: false, description: 'Pick metrics, a time grain and group-bys, and run them through the semantic layer.' },
  { id: 'malloy', label: 'Malloy models', icon: FileCode2, catalog: false, description: 'Malloy source files: sources, joins, dimensions, measures and views.' },
  { id: 'glossary', label: 'Glossary', icon: BookOpenText, catalog: true, description: 'Business terms and what they mean, with the data assets that carry them.' },
  { id: 'classifications', label: 'Classifications', icon: Tags, catalog: true, description: 'Classifications and their tags, such as PII and Tier, and where they are used.' },
  { id: 'domains', label: 'Domains', icon: Layers, catalog: true, description: 'Business domains and their data products.' },
  { id: 'quality', label: 'Data quality', icon: Gauge, catalog: true, description: 'Test suites and test cases, with their latest results.' },
  { id: 'insights', label: 'Insights', icon: ChartPie, catalog: true, description: 'How complete the catalog is: descriptions, owners, tiers and tags across assets.' },
  { id: 'services', label: 'Services', icon: Server, catalog: true, description: 'The services the catalog reads from, and their ingestion pipelines.' },
  { id: 'teams', label: 'Teams and users', icon: Users, catalog: true, description: 'Teams, users, roles and the assets they own.' },
]

export const OM_PATH = '/openmetadata'

/** The route of a tab. Home is the page itself. */
export const tabPath = (id: string) => (id === 'home' ? OM_PATH : `${OM_PATH}/${id}`)

/** The tab a route shows: `/openmetadata/glossary` is Glossary, anything unknown is Home. */
export function tabFromPath(path: string): OmTabDef {
  const id = path.split('?')[0].slice(OM_PATH.length + 1).split('/')[0]
  return OM_TABS.find((t) => t.id === id) ?? OM_TABS[0]
}

let pending: View | undefined

/** Open one entity (or one type's list) in the Catalog tab, from any tab. Kept in memory only. */
export function openInCatalog(view: View) {
  pending = view
  window.dispatchEvent(new Event('monorail:om-open'))
  navigate(tabPath('catalog'))
}

/** The Catalog tab's side: the view another tab asked for, once. */
export function takePendingView(): View | undefined {
  const v = pending
  pending = undefined
  return v
}

/** Go to another tab. */
export const openTab = (id: string) => navigate(tabPath(id))
