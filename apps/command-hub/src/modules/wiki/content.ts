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
  /** Who the page is written for, from its front matter. */
  audience: Audience[]
  /** The page without its front matter. */
  markdown: string
}

export interface WikiGroup {
  id: string
  title: string
  pages: WikiPage[]
}

/** Reading order within a group; files not listed follow, by title. */
const ORDER: Record<string, string[]> = {
  guide: ['README', 'first-ten-minutes', 'private-data', 'chat', 'create-an-agent', 'browse-repos', 'connections', 'spend', 'agent-access', 'backups-and-updates', 'extensions', 'glossary', 'faq'],
  extensions: ['README', 'concepts', 'tutorial', 'manifest', 'page-api', 'backend-api', 'non-node-runtimes', 'permissions', 'lifecycle', 'testing', 'troubleshooting', 'roadmap'],
}

const GROUP_TITLES: Record<string, string> = { guide: 'Guides', '': 'Features in depth', extensions: 'Extensions' }
/** Group order; groups not listed follow, by name. */
const GROUP_ORDER = ['guide', '', 'extensions']

function groupRank(g: string) {
  const i = GROUP_ORDER.indexOf(g)
  return i < 0 ? GROUP_ORDER.length : i
}

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
  return { id, group, title, summary: meta.summary || plainText(para), audience: parseAudience(meta.audience), markdown: text }
}

function rank(page: WikiPage): number {
  const order = ORDER[page.group] ?? []
  const i = order.indexOf(page.id.slice(page.group ? page.group.length + 1 : 0))
  return i < 0 ? order.length : i
}

export const pages: WikiPage[] = Object.entries(files)
  .map(([file, md]) => parse(file, md))
  .sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.group.localeCompare(b.group) || rank(a) - rank(b) || a.title.localeCompare(b.title))

export const groups: WikiGroup[] = [...new Set(pages.map((p) => p.group))].map((g) => ({
  id: g,
  title: GROUP_TITLES[g] ?? g.charAt(0).toUpperCase() + g.slice(1).replace(/-/g, ' '),
  pages: pages.filter((p) => p.group === g),
}))

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
