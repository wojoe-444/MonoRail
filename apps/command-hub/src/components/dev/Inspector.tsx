import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, MousePointerClick, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { invokeModule, isDesktop } from '@/modules/client'
import { isInspecting, setInspecting, useDevMode, useInspecting } from '@/lib/devMode'

import { describe, elementLine, inspect, type Inspection } from './inspect'

/** Marks the inspector's own UI, which is never inspected or blocked. */
const OWN = 'data-monorail-inspector'

function pageName(): string {
  const nav = document.querySelector('header nav[aria-label="Breadcrumb"]')
  const parts = nav ? [...nav.querySelectorAll('span, button')].map((e) => e.textContent?.trim()).filter(Boolean) : []
  const hash = window.location.hash || '#/'
  return parts.length ? `${parts.join(' › ')} (${hash})` : hash
}

export function openDevTools(): void {
  if (isDesktop()) void invokeModule('developer', 'toggleDevTools').catch(() => {})
}

/**
 * Developer Mode's element inspector (docs/developer-mode.md): hover anything
 * to see the React component that drew it, click to pin it and copy its name
 * for feedback. Ctrl+Shift+C starts or stops it, Esc stops it, F12 opens
 * Chromium's full DevTools. Renders nothing while Developer Mode is off.
 */
export function Inspector() {
  const devMode = useDevMode()
  const active = useInspecting()
  const [hover, setHover] = useState<{ el: Element; rect: DOMRect; info: Inspection }>()
  const [pinned, setPinned] = useState<{ info: Inspection; page: string; rect: DOMRect }>()
  const [copied, setCopied] = useState(false)
  const frame = useRef(0)

  // Keyboard: Ctrl+Shift+C inspect, Esc stop / close, F12 DevTools.
  useEffect(() => {
    if (!devMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
        setPinned(undefined)
        setInspecting(!isInspecting())
      } else if (e.key === 'F12') {
        e.preventDefault()
        openDevTools()
      } else if (e.key === 'Escape' && isInspecting()) {
        e.preventDefault()
        e.stopPropagation()
        setInspecting(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [devMode])

  useEffect(() => {
    if (!devMode) setInspecting(false)
  }, [devMode])

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable: the text is on screen */
    }
  }, [])

  // While inspecting: follow the pointer, swallow clicks, pin on click.
  useEffect(() => {
    if (!active) {
      setHover(undefined)
      return
    }
    const own = (t: EventTarget | null) => t instanceof Element && !!t.closest(`[${OWN}]`)
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        if (!el || own(el)) return setHover(undefined)
        setHover((h) => (h?.el === el ? h : { el, rect: el.getBoundingClientRect(), info: inspect(el) }))
      })
    }
    const block = (e: Event) => {
      if (own(e.target)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onClick = (e: MouseEvent) => {
      if (own(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || own(el)) return
      const info = inspect(el)
      const page = pageName()
      setPinned({ info, page, rect: el.getBoundingClientRect() })
      void copy(describe(info, page))
      setInspecting(false)
    }
    const onScroll = () => setHover(undefined)
    document.addEventListener('pointermove', onMove, true)
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'contextmenu'] as const) document.addEventListener(t, block, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', onScroll, true)
    document.documentElement.style.cursor = 'crosshair'
    return () => {
      cancelAnimationFrame(frame.current)
      document.removeEventListener('pointermove', onMove, true)
      for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'contextmenu'] as const) document.removeEventListener(t, block, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', onScroll, true)
      document.documentElement.style.cursor = ''
    }
  }, [active, copy])

  if (!devMode) return null

  return (
    <>
      {active && hover && <Highlight rect={hover.rect} info={hover.info} />}
      {pinned && !active && <Highlight rect={pinned.rect} info={pinned.info} faint />}
      {active && (
        <div
          {...{ [OWN]: '' }}
          className="fixed bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground py-2 pr-2 pl-4 text-sm text-background shadow-elevation-3"
        >
          <MousePointerClick className="size-4" />
          <span>Hover to see a component's name, click to copy it</span>
          <kbd className="rounded bg-background/15 px-1.5 font-mono text-xs">Esc</kbd>
          <button
            type="button"
            onClick={() => setInspecting(false)}
            className="flex size-7 items-center justify-center rounded-full hover:bg-background/15"
            aria-label="Stop inspecting"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {pinned && !active && (
        <PinnedPanel
          info={pinned.info}
          page={pinned.page}
          copied={copied}
          onCopy={() => copy(describe(pinned.info, pinned.page))}
          onAgain={() => {
            setPinned(undefined)
            setInspecting(true)
          }}
          onClose={() => setPinned(undefined)}
        />
      )}
    </>
  )
}

function Highlight({ rect, info, faint }: { rect: DOMRect; info: Inspection; faint?: boolean }) {
  // Label above the box when there is room, else below; kept on screen.
  const above = rect.top > 56
  const top = above ? rect.top - 6 : rect.bottom + 6
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 360))
  return (
    <div {...{ [OWN]: '' }} className="pointer-events-none fixed inset-0 z-[999]" aria-hidden>
      <div
        className={faint ? 'absolute rounded-sm border-2 border-dashed border-primary' : 'absolute rounded-sm border-2 border-primary bg-primary/10'}
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />
      {!faint && (
        <div
          className="absolute flex max-w-[352px] items-center gap-2 rounded-md bg-foreground px-2 py-1 font-mono text-xs whitespace-nowrap text-background shadow-elevation-2"
          style={{ top, left, transform: above ? 'translateY(-100%)' : undefined }}
        >
          <span className="font-semibold">{info.component ?? `<${info.tag}>`}</span>
          {info.slot && <span className="opacity-70">{info.ownSlot ? info.slot : `in ${info.slot}`}</span>}
          <span className="opacity-60">
            {info.width}×{info.height}
          </span>
        </div>
      )}
    </div>
  )
}

interface PinnedPanelProps {
  info: Inspection
  page: string
  copied: boolean
  onCopy: () => void
  onAgain: () => void
  onClose: () => void
}

function PinnedPanel({ info, page, copied, onCopy, onAgain, onClose }: PinnedPanelProps) {
  return (
    <div
      {...{ [OWN]: '' }}
      role="dialog"
      aria-label="Inspected element"
      className="fixed right-6 bottom-6 z-[1000] flex w-[22rem] flex-col gap-3 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-elevation-3 ring-1 ring-foreground/10"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Component</div>
          <div className="truncate font-mono text-base font-semibold">{info.component ?? `<${info.tag}>`}</div>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-8" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      <dl className="flex flex-col divide-y text-xs">
        {info.chain.length > 1 && <Fact label="Inside" value={info.chain.slice(0, -1).join(' › ')} />}
        <Fact label="Element" value={elementLine(info)} />
        {info.text && <Fact label="Text" value={`“${info.text}”`} />}
        <Fact label="Page" value={page} />
      </dl>
      <div className="flex gap-2">
        <Button size="sm" onClick={onCopy}>
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy for feedback'}
        </Button>
        <Button size="sm" variant="outline" onClick={onAgain}>
          <MousePointerClick /> Inspect another
        </Button>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1.5 first:pt-0 last:pb-0">
      <dt className="w-14 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono break-words">{value}</dd>
    </div>
  )
}
