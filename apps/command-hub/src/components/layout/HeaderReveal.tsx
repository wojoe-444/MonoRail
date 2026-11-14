import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Reveal = { open: boolean; enter: () => void; leave: () => void }
const Context = createContext<Reveal>({ open: false, enter: () => {}, leave: () => {} })

export function HeaderRevealProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enter = useCallback(() => { clearTimeout(timer.current); setOpen(true) }, [])
  const leave = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 250) }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return <Context.Provider value={{ open, enter, leave }}>{children}</Context.Provider>
}

/** The empty edge is visually invisible but can be focused to reveal controls. */
export function HeaderRevealTrigger() {
  const { enter, leave } = useContext(Context)
  return <button type="button" aria-label="Show page controls" onMouseEnter={enter} onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) leave() }} onFocus={enter} onBlur={(e) => { if (!e.currentTarget.matches(':hover')) leave() }} className="absolute inset-x-0 top-0 z-30 h-1.5 bg-transparent outline-none focus-visible:h-2 focus-visible:bg-primary" />
}

export function RevealableHeader({ children }: { children: ReactNode }) {
  const { open, enter, leave } = useContext(Context)
  return <div onMouseEnter={enter} onMouseLeave={(e) => { if (!e.currentTarget.contains(document.activeElement)) leave() }} onFocusCapture={enter} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !e.currentTarget.matches(':hover')) leave() }} className={cn('grid shrink-0 overflow-hidden transition-[grid-template-rows] motion-reduce:transition-none', open ? 'grid-rows-[1fr] duration-200' : 'grid-rows-[0fr] duration-500')}>
    <div className="min-h-0 overflow-hidden" inert={!open}>{children}</div>
  </div>
}
