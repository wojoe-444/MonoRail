import { useMemo } from 'react'
import hljs from 'highlight.js/lib/common'
import { languageFor } from '../util'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Split highlighted HTML into per-line HTML, closing and reopening spans that cross line breaks. */
export function highlightLines(code: string, path: string): string[] {
  const lang = languageFor(path)
  let html: string
  try {
    html = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : esc(code)
  } catch {
    html = esc(code)
  }
  const out: string[] = []
  const open: string[] = []
  for (const raw of html.split('\n')) {
    let line = open.join('') + raw
    for (const m of raw.matchAll(/<(\/?)span([^>]*)>/g)) {
      if (m[1]) open.pop()
      else open.push(`<span${m[2]}>`)
    }
    line += '</span>'.repeat(open.length)
    out.push(line)
  }
  if (out.length > 1 && out[out.length - 1] === '') out.pop() // trailing newline
  return out
}

export default function CodeView({ code, path }: { code: string; path: string }) {
  const lines = useMemo(() => highlightLines(code, path), [code, path])
  return (
    <table className="code hljs">
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} id={`L${i + 1}`}>
            <td className="ln">{i + 1}</td>
            <td className="lc" dangerouslySetInnerHTML={{ __html: l || ' ' }} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
