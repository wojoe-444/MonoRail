import { expect, test } from 'vitest'
import { frontMatter, headingsOf, parseAudience, plainText } from './document'

test('reads supported audiences and summary metadata and normalizes line endings', () => {
  const body = '# Example\n\nStart here.\n'
  const text = `---\nAudience: [AI, team, human, AI]\nsummary: Quick start\n---\n${body}`
  const { meta, body: parsed } = frontMatter(text.replaceAll('\n', '\r\n'))

  expect(parsed).toBe(body)
  expect(meta.summary).toBe('Quick start')
  expect(parseAudience(meta.audience)).toEqual(['human', 'ai'])
  expect(parseAudience(undefined)).toEqual([])
  expect(frontMatter(body)).toEqual({ meta: {}, body })
})

test('creates readable excerpts and heading anchors while omitting fenced code', () => {
  const markdown = [
    '# Example',
    '## `ctx.secrets` Résumé',
    'See [the guide](guide.md).',
    '```md\n## Ignored\n```',
    '### Subsection',
    '## Related',
  ].join('\n\n')

  expect(plainText('See [the guide](guide.md) for **setup**\n```js\nexample()\n```')).toBe('See the guide for setup')
  expect(headingsOf(markdown)).toEqual([{ id: 'ctxsecrets-résumé', text: 'ctx.secrets Résumé' }])
})
