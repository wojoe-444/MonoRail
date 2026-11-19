import { useMemo, useRef, type KeyboardEvent } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import sql from 'highlight.js/lib/languages/sql'

import { cn } from '@/lib/utils'

import { interpolations } from './parse'

hljs.registerLanguage('sql', sql)
hljs.registerLanguage('javascript', javascript)

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function hl(code: string, language: 'sql' | 'javascript'): string {
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value
  } catch {
    return escape(code)
  }
}

// Interpolations are drawn as soft chips so the SQL around them stays readable.
const INTERP = 'rounded-sm bg-primary-soft text-primary-soft-foreground'

/** SQL with `${ ... }` interpolations marked; JavaScript as is. */
function highlightSqlx(code: string, language: 'sql' | 'javascript'): string {
  if (language === 'javascript') return hl(code, 'javascript')
  let out = ''
  let at = 0
  for (const r of interpolations(code)) {
    out += hl(code.slice(at, r.start), 'sql')
    out += `<span class="${INTERP}">${escape(code.slice(r.start, r.end))}</span>`
    at = r.end
  }
  return out + hl(code.slice(at), 'sql')
}

interface Props {
  value: string
  onChange: (value: string) => void
  language?: 'sql' | 'javascript'
  label: string
  placeholder?: string
  className?: string
  /** Lines to show at least, so an empty editor still has room to click into. */
  minLines?: number
  /** Larger type and line height, for the main query. */
  roomy?: boolean
}

/**
 * A textarea over highlighted SQLX, with line numbers. It grows with its
 * content (the page scrolls, not the editor). Tab indents, Shift+Tab outdents.
 */
export function SqlxCode({ value, onChange, language = 'sql', label, placeholder, className, minLines = 1, roomy }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const html = useMemo(() => highlightSqlx(value, language) + '\n', [value, language])
  const lines = Math.max(minLines, value.split('\n').length)

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return
    e.preventDefault()
    const el = e.currentTarget
    const { selectionStart: s, selectionEnd: end } = el
    if (e.shiftKey) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      if (value.slice(lineStart, lineStart + 2) === '  ') {
        onChange(value.slice(0, lineStart) + value.slice(lineStart + 2))
        requestAnimationFrame(() => el.setSelectionRange(Math.max(lineStart, s - 2), Math.max(lineStart, end - 2)))
      }
      return
    }
    onChange(value.slice(0, s) + '  ' + value.slice(end))
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
  }

  return (
    <div className={cn('relative flex overflow-x-auto font-mono', roomy ? 'text-[14px] leading-6' : 'text-[13px] leading-5', className)} onClick={() => ref.current?.focus()}>
      <div aria-hidden className="sticky left-0 z-10 shrink-0 bg-card py-3 pr-3 pl-4 text-right text-muted-foreground/50 select-none">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="relative grid min-w-max flex-1">
        <pre aria-hidden className="syntax-code pointer-events-none col-start-1 row-start-1 m-0 min-w-full py-3 pr-6 pl-2 whitespace-pre" dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={ref}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={keyDown}
          className="col-start-1 row-start-1 m-0 w-full resize-none overflow-hidden bg-transparent py-3 pr-6 pl-2 whitespace-pre text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-muted-foreground"
          style={{ height: `${lines * (roomy ? 24 : 20) + 24}px` }}
        />
      </div>
    </div>
  )
}
