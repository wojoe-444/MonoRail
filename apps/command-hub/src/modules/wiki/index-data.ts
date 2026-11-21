import type { WikiPage } from './document'

export type { WikiPage }

/** Metadata is generated from the bundled docs without importing their Markdown. */
const index = import.meta.glob<WikiPage>(['../../../../../docs/**/*.md', '!../../../../../docs/extensions.md'], {
  query: '?wiki-meta',
  import: 'default',
  eager: true,
})

export const pages = Object.values(index).sort((a, b) => a.id.localeCompare(b.id))
const byId = new Map(pages.map((page) => [page.id, page]))

export function findPage(id: string | undefined): WikiPage | undefined {
  return id ? byId.get(id) : undefined
}

export const wikiDocPath = (id: string) => `../../../../../docs/${id}.md`
