import { useMemo } from 'react'
import { highlightLines } from '@/lib/highlight'

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
