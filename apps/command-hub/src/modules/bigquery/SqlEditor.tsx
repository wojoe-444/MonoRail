import { useMemo, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'

import { cn } from '@/lib/utils'

hljs.registerLanguage('sql', sql)

function highlight(code: string): string {
  try {
    return hljs.highlight(code, { language: 'sql', ignoreIllegals: true }).value
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

export function SqlHighlight({ code, className }: { code: string; className?: string }) {
  const html = useMemo(() => highlight(code), [code])
  return <pre className={cn('syntax-code font-mono text-[13px] leading-5 whitespace-pre-wrap', className)} dangerouslySetInnerHTML={{ __html: html }} />
}

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onFormat: () => void
  onSelection: (selected: string) => void
  className?: string
  style?: CSSProperties
  /** Shown as a line marker, e.g. from an error "[3:14]". */
  errorLine?: number
}

/**
 * A plain textarea over syntax-highlighted SQL, with line numbers.
 * Ctrl+Enter runs (the selection, if any), Ctrl+Shift+F formats, Tab indents.
 */
export function SqlEditor({ value, onChange, onRun, onFormat, onSelection, className, style, errorLine }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const html = useMemo(() => highlight(value) + '\n', [value])
  const lines = value.split('\n').length

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      onRun()
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault()
      onFormat()
      return
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
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
  }

  function selectionChanged() {
    const el = ref.current
    if (!el) return
    onSelection(el.selectionStart !== el.selectionEnd ? value.slice(el.selectionStart, el.selectionEnd) : '')
  }

  return (
    <div className={cn('relative flex min-h-0 overflow-auto bg-card font-mono text-[13px] leading-5', className)} style={style} onClick={() => ref.current?.focus()}>
      <div aria-hidden className="sticky left-0 z-10 shrink-0 border-r bg-muted/40 py-3 pr-3 pl-4 text-right text-muted-foreground/70 select-none">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cn(errorLine === i + 1 && 'font-semibold text-destructive')}>
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative grid min-w-max flex-1">
        <pre aria-hidden className="syntax-code pointer-events-none col-start-1 row-start-1 m-0 min-w-full px-4 py-3 whitespace-pre" dangerouslySetInnerHTML={{ __html: html }} />
        <textarea
          ref={ref}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          aria-label="SQL query"
          placeholder="Write a GoogleSQL query. Ctrl+Enter runs it."
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={keyDown}
          onSelect={selectionChanged}
          onKeyUp={selectionChanged}
          onMouseUp={selectionChanged}
          className="col-start-1 row-start-1 m-0 min-h-full w-full resize-none overflow-hidden bg-transparent px-4 py-3 whitespace-pre text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-muted-foreground"
          style={{ height: `${lines * 20 + 24}px` }}
        />
      </div>
    </div>
  )
}
