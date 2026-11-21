import { frontMatter, resolveLink as resolveDocumentLink } from './document'
import { findPage, pages, wikiDocPath, type WikiPage } from './index-data'

const bodies = import.meta.glob<string>(['../../../../../docs/**/*.md', '!../../../../../docs/extensions.md'], {
  query: '?raw',
  import: 'default',
})

export async function loadMarkdown(id: string): Promise<string> {
  const load = bodies[wikiDocPath(id)]
  if (!load) throw new Error(`Unknown wiki page ${id}`)
  return frontMatter(await load()).body
}

export { findPage, pages, type WikiPage }
export { headingsOf, slug, type Audience } from './document'

/**
 * A folder under docs/, drawn as a collapsible node in the wiki's page tree.
 * Folders nest to any depth. A folder's README.md is its index page: the
 * folder's title opens it and the page lists everything in the folder.
 */
export interface WikiFolder {
  /** Path under docs/: "guide/agents"; "" for the loose top-level pages. */
  path: string
  title: string
  index?: WikiPage
  /** Pages and subfolders in reading order (the index page is not included). */
  children: WikiNode[]
}

export type WikiNode = { kind: 'page'; page: WikiPage } | { kind: 'folder'; folder: WikiFolder }

/**
 * Reading order inside a folder, by file or folder name. Optional: anything
 * not listed follows (pages by title, then folders by title).
 */
const ORDER: Record<string, string[]> = {
  guide: ['first-ten-minutes', 'search', 'private-data', 'agents', 'workspace', 'data', 'setup', 'glossary', 'faq'],
  'guide/agents': ['chat', 'create-an-agent', 'catalog', 'coordinator', 'flows', 'spend', 'agent-access', 'mochi-crew'],
  'guide/workspace': ['browse-repos', 'search-code', 'local-issues', 'tasks', 'tracker', 'notes', 'files', 'email', 'flashcards', 'docker', 'storage'],
  'guide/data': ['explore', 'openmetadata', 'services', 'bigquery', 'sqlx', 'malloy', 'semantic'],
  'guide/setup': ['connections', 'appearance', 'backups-and-updates', 'spending-limit', 'remote-access', 'extensions', 'saving', 'developer-mode'],
  standard: ['monorail', 'data-assets', 'governance', 'data-contracts', 'ontology', 'teams-and-users', 'data-quality', 'insights', 'collaboration', 'context-center', 'platform'],
  'standard/monorail': ['agents', 'workspace', 'learning', 'semantic', 'tracker'],
  'standard/data-assets': ['databases', 'messaging', 'dashboards', 'pipelines', 'ml-models', 'storage', 'search', 'apis', 'drives', 'metrics', 'ai'],
  'standard/data-assets/databases': ['database-service', 'database', 'database-schema', 'table', 'stored-procedure', 'query'],
  'standard/governance': ['domain', 'data-product', 'glossary', 'glossary-term', 'classification', 'tag', 'workflow-definition', 'intake-form'],
  'standard/teams-and-users': ['user', 'team', 'role', 'persona', 'policy', 'bot'],
  extensions: ['concepts', 'tutorial', 'manifest', 'page-api', 'backend-api', 'non-node-runtimes', 'permissions', 'lifecycle', 'testing', 'troubleshooting', 'roadmap'],
}

/** Top-level folders in this order; "" is the loose top-level pages, shown as one folder. */
const TOP_ORDER = ['guide', 'standard', '', 'extensions']
const ROOT_TITLE = 'Reference'

/** A folder's README is its index page. */
export const isIndex = (p: WikiPage) => p.id === 'README' || p.id.endsWith('/README')
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const titleCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')

function buildFolder(path: string): WikiFolder {
  const index = path ? pages.find((p) => p.id === `${path}/README`) : undefined
  const own = pages.filter((p) => p.group === path && !(path && isIndex(p)))
  const prefix = path ? `${path}/` : ''
  // The loose top-level pages ("") never collect the top-level folders.
  const subNames = path ? [...new Set(pages.filter((p) => p.group.startsWith(prefix)).map((p) => p.group.slice(prefix.length).split('/')[0]))] : []
  const order = ORDER[path] ?? []
  const nodes = [
    ...own.map((page) => ({ node: { kind: 'page', page } as WikiNode, name: baseName(page.id), title: page.title, folder: 0 })),
    ...subNames.map((name) => {
      const folder = buildFolder(prefix + name)
      return { node: { kind: 'folder', folder } as WikiNode, name, title: folder.title, folder: 1 }
    }),
  ]
  const rankOf = (n: { name: string; folder: number }) => {
    const i = order.indexOf(n.name)
    return i >= 0 ? i : order.length + n.folder
  }
  nodes.sort((a, b) => rankOf(a) - rankOf(b) || a.title.localeCompare(b.title))
  const title = path === '' ? ROOT_TITLE : (index?.folderTitle ?? titleCase(baseName(path)))
  return { path, title, index, children: nodes.map((n) => n.node) }
}

/** The page tree: the top-level folders, nesting to any depth. */
export const tree: WikiFolder[] = (() => {
  const tops = [...new Set(pages.map((p) => p.group.split('/')[0]))]
  const r = (g: string) => (TOP_ORDER.includes(g) ? TOP_ORDER.indexOf(g) : TOP_ORDER.length)
  tops.sort((a, b) => r(a) - r(b) || a.localeCompare(b))
  return tops.map(buildFolder)
})()

const folderByPath = new Map<string, WikiFolder>()
const indexFolders = (fs: WikiFolder[]) => {
  for (const f of fs) {
    folderByPath.set(f.path, f)
    indexFolders(f.children.flatMap((c) => (c.kind === 'folder' ? [c.folder] : [])))
  }
}
indexFolders(tree)

export function findFolder(path: string): WikiFolder | undefined {
  return folderByPath.get(path)
}

/** The folders from the top down to the one a page sits in, for breadcrumbs. A folder's index page sits in its parent. */
export function folderChain(page: WikiPage): WikiFolder[] {
  if (page.group === '') return [folderByPath.get('')].filter((f): f is WikiFolder => !!f)
  const parts = page.group.split('/')
  const chain = parts.map((_, i) => folderByPath.get(parts.slice(0, i + 1).join('/'))).filter((f): f is WikiFolder => !!f)
  return isIndex(page) ? chain.slice(0, -1) : chain
}

/** Every folder from the top down that contains a page, its own folder included (to expand the tree). */
export function openPathsFor(page: WikiPage): string[] {
  if (page.group === '') return ['']
  const parts = page.group.split('/')
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** All pages in reading order, depth first: a folder's index page, then its contents. */
export const readingOrder: WikiPage[] = (() => {
  const out: WikiPage[] = []
  const walk = (f: WikiFolder) => {
    if (f.index) out.push(f.index)
    for (const c of f.children) {
      if (c.kind === 'page') out.push(c.page)
      else walk(c.folder)
    }
  }
  tree.forEach(walk)
  return out
})()

export function resolveLink(fromId: string, href: string) {
  return resolveDocumentLink(fromId, href, (id) => findPage(id) !== undefined)
}

/** The wiki pages a page links to, in the order they first appear. */
export function linksFrom(page: WikiPage): WikiPage[] {
  return page.links.map(findPage).filter((target): target is WikiPage => !!target)
}

const backlinks = new Map<string, WikiPage[]>()
for (const p of pages) {
  for (const target of linksFrom(p)) backlinks.set(target.id, [...(backlinks.get(target.id) ?? []), p])
}

/** The pages that link to a page: its backlinks, shown as "Linked from". */
export function linksTo(page: WikiPage): WikiPage[] {
  return backlinks.get(page.id) ?? []
}
