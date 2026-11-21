import { expect, test } from 'vitest'
import { frontMatter, headingsOf, parseAudience, plainText, type WikiPage } from './content'

test('reads supported audiences and summary metadata without changing the Markdown body', () => {
  const body = '# Example\n\nStart here.\n'
  const { meta, body: parsed } = frontMatter(`---\nAudience: [AI, team, human, AI]\nsummary: Quick start\n---\n${body}`)

  expect(parsed).toBe(body)
  expect(meta.summary).toBe('Quick start')
  expect(parseAudience(meta.audience)).toEqual(['human', 'ai'])
  expect(parseAudience(undefined)).toEqual([])
  expect(frontMatter(body)).toEqual({ meta: {}, body })
})

test('creates readable excerpts and heading anchors while omitting fenced code', () => {
  const page: WikiPage = {
    id: 'example',
    group: '',
    title: 'Example',
    summary: '',
    audience: ['human'],
    markdown: [
      '# Example',
      '## `ctx.secrets` Résumé',
      'See [the guide](guide.md).',
      '```md\n## Ignored\n```',
      '### Subsection',
      '## Related',
    ].join('\n\n'),
  }

  expect(plainText('See [the guide](guide.md) for **setup**\n```js\nexample()\n```')).toBe('See the guide for setup')
  expect(headingsOf(page)).toEqual([{ id: 'ctxsecrets-résumé', text: 'ctx.secrets Résumé' }])
})
