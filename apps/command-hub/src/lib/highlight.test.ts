import { expect, test } from 'vitest'
import { highlightLines } from './highlight'

test('escapes HTML in plain text and preserves interior blank lines', async () => {
  const source = '<script>&</script>\n\nnext\n'

  expect(await highlightLines(source, 'example.unknown')).toEqual(['&lt;script&gt;&amp;&lt;/script&gt;', '', 'next'])
})

test('closes and reopens the highlighting span across a multiline comment', async () => {
  const lines = await highlightLines('/* first line\nsecond line */\n', 'example.js')

  expect(lines).toEqual([
    '<span class="hljs-comment">/* first line</span>',
    '<span class="hljs-comment">second line */</span>',
  ])
})
