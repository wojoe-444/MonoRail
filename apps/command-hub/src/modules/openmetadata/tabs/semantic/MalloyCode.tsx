import { useEffect, useMemo, useRef } from 'react'

import { cn } from '@/lib/utils'

import { highlightMalloy } from './malloyHighlight'

/**
 * Malloy text with line numbers and syntax colors. `mark` tints a range of
 * lines (the open source); `focus` scrolls a line into view and flashes it.
 */
export function MalloyCode({ text, mark, focus, className, numbers = true }: { text: string; mark?: [number, number]; focus?: { line: number; key: number }; className?: string; numbers?: boolean }) {
  const lines = useMemo(() => highlightMalloy(text), [text])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!focus || !box.current) return
    const row = box.current.querySelector<HTMLElement>(`[data-line="${focus.line}"]`)
    if (!row) return
    box.current.scrollTop = Math.max(0, row.offsetTop - 48)
  }, [focus])

  return (
    <div ref={box} className={cn('relative overflow-auto rounded-lg bg-muted/40 py-3 font-mono text-xs leading-5 ring-1 ring-foreground/10', className)}>
      <pre className="syntax-code min-w-fit">
        {lines.map((html, i) => {
          const n = i + 1
          const marked = mark && n >= mark[0] && n <= mark[1]
          return (
            <div key={i} data-line={n} className={cn('flex pr-4', marked && 'bg-primary-soft/60', !!focus?.key && focus.line === n && 'bg-warning-soft')}>
              {numbers && <span className="sticky left-0 w-12 shrink-0 bg-inherit pr-3 text-right text-muted-foreground/60 select-none">{n}</span>}
              <code className={cn('whitespace-pre', !numbers && 'pl-4')} dangerouslySetInnerHTML={{ __html: html || ' ' }} />
            </div>
          )
        })}
      </pre>
    </div>
  )
}
