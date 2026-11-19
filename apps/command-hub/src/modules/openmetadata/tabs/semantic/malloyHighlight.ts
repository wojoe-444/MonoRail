// Malloy syntax colors for the source view, as per-line HTML using the same
// hljs-* classes the app's `.syntax-code` styles color. Malloy is not one of
// highlight.js's languages, so this is a small line tokenizer: comments,
// annotations, strings, numbers, keywords and function calls. Every piece of
// the text is escaped.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const KEYWORDS = new Set(
  'is extend with on and or not pick when else true false null now as by desc asc import from refine run source query view measure dimension primary_key join_one join_many join_cross group_by aggregate nest select where having order_by limit top calculate index sample rename except accept declare timezone include partition_by all exclude cast'.split(' '),
)

const TOKEN = /(\/\/.*|--.*|#.*)|('(?:\\.|[^'\\])*'?|"(?:\\.|[^"\\])*"?|`[^`]*`?)|(@?\d[\d_]*(?:\.\d+)?(?:-\d+(?:-\d+)?)?)|([A-Za-z_]\w*)(\s*(?:\(|:))?/g

function span(cls: string, text: string) {
  return `<span class="hljs-${cls}">${esc(text)}</span>`
}

export function highlightMalloy(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    let out = ''
    let last = 0
    for (const m of line.matchAll(TOKEN)) {
      out += esc(line.slice(last, m.index))
      last = m.index + m[0].length
      const [all, comment, str, num, word, after] = m
      if (comment) out += span(comment.startsWith('#') ? 'meta' : 'comment', comment)
      else if (str) out += span('string', str)
      else if (num) out += span('number', num)
      else if (word && after?.trim() === ':' && KEYWORDS.has(word)) out += span('keyword', word) + esc(after)
      else if (word && after?.trim() === '(') out += span('built_in', word) + esc(after)
      else if (word && KEYWORDS.has(word)) out += span('keyword', word) + esc(after ?? '')
      else out += esc(all)
    }
    return out + esc(line.slice(last))
  })
}
