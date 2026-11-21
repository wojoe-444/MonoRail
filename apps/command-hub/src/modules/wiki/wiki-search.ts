import { pages, wikiDocPath, type WikiPage as Page } from './index-data'

// Keep full-text search in a single lazy chunk, with no article loads.
const wikiText = import.meta.glob<string>(['../../../../../docs/**/*.md', '!../../../../../docs/extensions.md'], {
  query: '?wiki-text',
  import: 'default',
  eager: true,
})

export interface Hit {
  page: Page
  snippet: string
  score: number
}

export function search(query: string): Hit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits: Hit[] = []
  for (const page of pages) {
    const text = wikiText[wikiDocPath(page.id)] ?? ''
    const lower = text.toLowerCase()
    const title = page.title.toLowerCase()
    if (!words.every((w) => lower.includes(w) || title.includes(w))) continue
    const at = Math.max(0, lower.indexOf(words[0]))
    const start = Math.max(0, at - 60)
    const snippet = (start > 0 ? '…' : '') + text.slice(start, at + 140).trim() + (at + 140 < text.length ? '…' : '')
    const score = words.reduce((s, w) => s + (title.includes(w) ? 10 : 0) + lower.split(w).length - 1, 0)
    hits.push({ page, snippet, score })
  }
  return hits.sort((a, b) => b.score - a.score)
}
