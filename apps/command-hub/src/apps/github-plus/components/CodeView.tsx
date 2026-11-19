import { useMemo } from 'react'
import { highlightLines } from '@/lib/highlight'

/** Highlighted source with line numbers. With onLine, a line number is a button; `selected` marks one line. */
export default function CodeView({ code, path, selected, onLine }: { code: string; path: string; selected?: number | null; onLine?: (n: number) => void }) {
  const lines = useMemo(() => highlightLines(code, path), [code, path])
  return (
    <table className="code hljs">
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} id={`L${i + 1}`} className={selected === i + 1 ? 'selected' : undefined}>
            <td className="ln">
              {onLine ? <button className="ln-btn" onClick={() => onLine(i + 1)} title={`When did line ${i + 1} change?`}>{i + 1}</button> : i + 1}
            </td>
            <td className="lc" dangerouslySetInnerHTML={{ __html: l || ' ' }} />
          </tr>
        ))}
      </tbody>
    </table>
  )
}
