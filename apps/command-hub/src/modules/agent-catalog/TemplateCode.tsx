import { useLayoutEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function TemplateTabs({ value, onChange }: { value: 'overview' | 'code'; onChange: (v: 'overview' | 'code') => void }) {
  return <div role="tablist" aria-label="Template view" className="flex gap-1 border-b">
    {(['overview', 'code'] as const).map((tab) => <button key={tab} type="button" role="tab" id={`template-tab-${tab}`} aria-selected={value === tab} aria-controls={`template-panel-${tab}`} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={(e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const next = value === 'overview' ? 'code' : 'overview'; onChange(next); document.getElementById(`template-tab-${next}`)?.focus() }
    }} className={cn('-mb-px border-b-2 px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring', value === tab ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>{tab === 'overview' ? 'Overview' : 'Code'}</button>)}
  </div>
}

export function SourceViewer({ files, description, focusText }: { files: { name: string; text: string }[]; description: string; focusText?: string }) {
  const [selected, setSelected] = useState(0)
  const scroller = useRef<HTMLPreElement>(null)
  const target = useRef<HTMLSpanElement>(null)
  const text = files[selected]?.text ?? ''
  const offset = focusText ? text.indexOf(focusText) : -1
  useLayoutEffect(() => {
    if (scroller.current && target.current) scroller.current.scrollTop += target.current.getBoundingClientRect().top - scroller.current.getBoundingClientRect().top
  }, [selected, focusText, text])
  return <Card className="min-w-0 gap-0 py-0"><CardHeader className="border-b px-6 py-5"><CardTitle>Source code</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="min-w-0 px-0 py-0">
    {files.length > 1 && <div className="flex flex-wrap gap-2 border-b px-4 py-3">{files.map((file, i) => <button type="button" key={file.name} onClick={() => setSelected(i)} aria-pressed={i === selected} className={cn('rounded-md px-2 py-1 font-mono text-xs', i === selected ? 'bg-primary-soft text-foreground' : 'text-muted-foreground hover:bg-accent')}>{file.name.split('/').pop()}</button>)}</div>}
    {files[selected] ? <><div className="border-b px-5 py-2 font-mono text-xs text-muted-foreground">{files[selected].name}</div><pre ref={scroller} tabIndex={0} className="max-h-[70vh] overflow-auto p-5 font-mono text-xs leading-relaxed"><code>{offset < 0 ? text : <>{text.slice(0, offset)}<span ref={target}>{text.slice(offset)}</span></>}</code></pre></> : <p className="px-6 py-5 text-sm text-muted-foreground">Source is unavailable in this preview.</p>}
  </CardContent></Card>
}
