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
  /** IDs of pages linked from this document, in first-appearance order. */
  links: string[]
}

/** Split "---\nkey: value\n---" off the top of a page. */
export function frontMatter(markdown: string): { meta: Record<string, string>; body: string } {
  const text = markdown.replace(/\r\n/g, '\n')
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

export function parseWikiIndex(id: string, markdown: string): WikiPage {
  const slash = id.lastIndexOf('/')
  const group = slash < 0 ? '' : id.slice(0, slash)
  const { meta, body: text } = frontMatter(markdown)
  const title = /^# (.+)$/m.exec(text)?.[1].replace(/`/g, '').trim() ?? id
  const body = text.replace(/^# .+$/m, '')
  const para = body.split(/\n\s*\n/).find((p) => p.trim() && !/^\s*(#|```|\||[-*] |\d+\. )/.test(p)) ?? ''
  return { id, group, title, folderTitle: meta.folder, summary: meta.summary || plainText(para), audience: parseAudience(meta.audience), links: wikiLinkIds(id, text) }
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
export function resolveLink(fromId: string, href: string, hasPage: (id: string) => boolean): LinkTarget | undefined {
  if (/^https?:\/\//i.test(href)) return { kind: 'external', url: href }
  if (href.startsWith('#')) return { kind: 'anchor', anchor: href.slice(1) }
  if (/^[a-z]+:/i.test(href)) return undefined
  const [rel, anchor] = href.split('#')
  const repoPath = repoRelative(fromId, rel)
  if (repoPath === undefined) return undefined
  if (repoPath.startsWith('docs/') && repoPath.endsWith('.md')) {
    const id = repoPath.slice('docs/'.length, -'.md'.length)
    if (hasPage(id)) return { kind: 'page', id, anchor }
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

/** Collect relative wiki links. The renderer filters these against the bundled page IDs. */
function wikiLinkIds(id: string, markdown: string): string[] {
  const md = markdown.replace(/```[\s\S]*?```/g, '')
  const out = new Set<string>()
  for (const [, href] of md.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = resolveLink(id, href, () => true)
    if (target?.kind === 'page' && target.id !== id) out.add(target.id)
  }
  return [...out]
}

/** Top-level section headings (`## `) in a page, for the on-page jump strip. */
export function headingsOf(markdown: string): { id: string; text: string }[] {
  const md = markdown.replace(/```[\s\S]*?```/g, '')
  const out: { id: string; text: string }[] = []
  for (const [, raw] of md.matchAll(/^## (.+)$/gm)) {
    const text = plainText(raw)
    if (!text || text.toLowerCase() === 'related') continue
    out.push({ id: slug(raw.replace(/`/g, '')), text })
  }
  return out
}
