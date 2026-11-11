/**
 * The wiki's pages: every Markdown file under the repo's docs/ folder, read
 * at build time (Vite import.meta.glob with ?raw), so nothing is fetched at
 * runtime. A page's id is its path under docs/ without ".md", e.g.
 * "extensions/manifest". Its title is its first "# " heading.
 *
 * Every page starts with a small front matter block that says who it is
 * written for (a test fails on a page without one):
 *
 *   ---
 *   audience: human, ai
 *   summary: One line for the wiki's home page (optional).
 *   ---
 *
 * "human" pages are plain-language guides anyone can read; "ai" pages are
 * dense reference written for agents and developers (exact names, paths,
 * contracts). A page may be both. The wiki filters on it.
 *
 * Folders nest to any depth and become a collapsible tree; a folder's
 * README.md is its index page (front matter "folder:" gives its short name).
 * Pages are meant to be read by following links, like notes in a linked
 * notebook: links between docs open in the wiki, show a preview on hover,
 * and every page lists the pages that link to it.
 */

const files = import.meta.glob<string>(['../../../../../docs/**/*.md', '!../../../../../docs/extensions.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

export type Audience = 'human' | 'ai'
export const AUDIENCES: Audience[] = ['human', 'ai']

export interface WikiPage {
  /** Path under docs/ without .md: "extensions/backend-api". */
  id: string
  /** Folder under docs/ ("extensions"), or "" for top-level pages. */
  group: string
  title: string
  /** First paragraph, as plain text: shown on the wiki's home page and in search. */
  summary: string
  /** A README's short name for its folder in the page tree (front matter "folder:"). */
  folderTitle?: string
  /** Who the page is written for, from its front matter. */
  audience: Audience[]
  /** The page without its front matter. */
  markdown: string
}

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
  guide: ['first-ten-minutes', 'private-data', 'agents', 'workspace', 'setup', 'glossary', 'faq'],
  'guide/agents': ['chat', 'create-an-agent', 'coordinator', 'spend', 'agent-access'],
  'guide/workspace': ['browse-repos', 'local-issues', 'jira-plus', 'email'],
  'guide/setup': ['connections', 'appearance', 'backups-and-updates', 'extensions'],
  extensions: ['concepts', 'tutorial', 'manifest', 'page-api', 'backend-api', 'non-node-runtimes', 'permissions', 'lifecycle', 'testing', 'troubleshooting', 'roadmap'],
}

/** Top-level folders in this order; "" is the loose top-level pages, shown as one folder. */
const TOP_ORDER = ['guide', '', 'extensions']
const ROOT_TITLE = 'Features in depth'

/** Split "---\nkey: value\n---" off the top of a page. */
export function frontMatter(text: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!m) return { meta: {}, body: text }
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z]+):\s*(.*)$/i.exec(line.trim())
    if (kv) meta[kv[1].toLowerCase()] = kv[2].trim()
  }
  return { meta, body: text.slice(m[0].length) }
}

export function parseAudience(value: string | undefined): Audience[] {
  const words = (value ?? '').replace(/[[\]]/g, '').toLowerCase().split(/[\s,]+/)
  return AUDIENCES.filter((a) => words.includes(a))
}

/** Markdown to plain text, roughly: enough for summaries and search. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[>#]+/gm, ' ')
    .replace(/[*_|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parse(file: string, markdown: string): WikiPage {
  const id = file.replace(/^.*?\/docs\//, '').replace(/\.md$/, '')
  const slash = id.lastIndexOf('/')
  const group = slash < 0 ? '' : id.slice(0, slash)
  const { meta, body: text } = frontMatter(markdown.replace(/\r\n/g, '\n'))
  const title = /^# (.+)$/m.exec(text)?.[1].replace(/`/g, '').trim() ?? id
  const body = text.replace(/^# .+$/m, '')
  const para = body.split(/\n\s*\n/).find((p) => p.trim() && !/^\s*(#|```|\||[-*] |\d+\. )/.test(p)) ?? ''
  return { id, group, title, folderTitle: meta.folder, summary: meta.summary || plainText(para), audience: parseAudience(meta.audience), markdown: text }
}

export const pages: WikiPage[] = Object.entries(files)
  .map(([file, md]) => parse(file, md))
  .sort((a, b) => a.id.localeCompare(b.id))

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

export function findPage(id: string | undefined): WikiPage | undefined {
  return id ? pages.find((p) => p.id === id) : undefined
}

/** GitHub-style heading anchor: "ctx.secrets" -> "ctxsecrets", "Data across versions" -> "data-across-versions". */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const REPO = 'https://github.com/wojoe-444/MonoRail/blob/main/'

export type LinkTarget = { kind: 'page'; id: string; anchor?: string } | { kind: 'anchor'; anchor: string } | { kind: 'external'; url: string }

/**
 * Where a link in a page goes. Links between docs open in the wiki; links to
 * other repo files (source, the SDK) open on GitHub; http(s) links open in the
 * browser.
 */
export function resolveLink(fromId: string, href: string): LinkTarget | undefined {
  if (/^https?:\/\//i.test(href)) return { kind: 'external', url: href }
  if (href.startsWith('#')) return { kind: 'anchor', anchor: href.slice(1) }
  if (/^[a-z]+:/i.test(href)) return undefined
  const [rel, anchor] = href.split('#')
  const repoPath = repoRelative(fromId, rel)
  if (repoPath === undefined) return undefined
  if (repoPath.startsWith('docs/') && repoPath.endsWith('.md')) {
    const id = repoPath.slice('docs/'.length, -'.md'.length)
    if (findPage(id)) return { kind: 'page', id, anchor }
  }
  // Anything else in the repo (source, the SDK): show it on GitHub.
  return { kind: 'external', url: REPO + repoPath + (anchor ? `#${anchor}` : '') }
}

/** The repo path of `rel` as seen from docs/<fromId>.md. */
function repoRelative(fromId: string, rel: string): string | undefined {
  const parts = ['docs', ...fromId.split('/').slice(0, -1)]
  for (const part of rel.split('/')) {
    if (part === '..') {
      if (!parts.length) return undefined
      parts.pop()
    } else if (part && part !== '.') parts.push(part)
  }
  return parts.join('/')
}

/** The wiki pages a page links to, in the order they first appear. */
export function linksFrom(page: WikiPage): WikiPage[] {
  const md = page.markdown.replace(/```[\s\S]*?```/g, '')
  const out: WikiPage[] = []
  for (const [, href] of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const t = resolveLink(page.id, href)
    const target = t?.kind === 'page' ? findPage(t.id) : undefined
    if (target && target.id !== page.id && !out.includes(target)) out.push(target)
  }
  return out
}

const backlinks = new Map<string, WikiPage[]>()
for (const p of pages) {
  for (const target of linksFrom(p)) backlinks.set(target.id, [...(backlinks.get(target.id) ?? []), p])
}

/** The pages that link to a page: its backlinks, shown as "Linked from". */
export function linksTo(page: WikiPage): WikiPage[] {
  return backlinks.get(page.id) ?? []
}
