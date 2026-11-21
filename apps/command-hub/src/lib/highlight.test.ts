import { expect, test } from 'vitest'
import { highlightLines } from './highlight'

test('escapes HTML in plain text and preserves interior blank lines', () => {
  const source = '<script>&</script>\n\nnext\n'

  expect(highlightLines(source, 'example.unknown')).toEqual(['&lt;script&gt;&amp;&lt;/script&gt;', '', 'next'])
})

test('closes and reopens the highlighting span across a multiline comment', () => {
  const lines = highlightLines('/* first line\nsecond line */\n', 'example.js')

  expect(lines).toEqual([
    '<span class="hljs-comment">/* first line</span>',
    '<span class="hljs-comment">second line */</span>',
  ])
})
