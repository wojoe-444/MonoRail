import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react'

import { BrandTile } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { openWiki } from '@/modules/wiki/store'

import { endTour, startTour, tourUnseen, useTourOpen } from './store'
import { TOUR_STEPS, type TourStep } from './steps'

/** Space between the highlighted element and its ring, and between the ring and the card. */
const PAD = 6
const GAP = 16
const CARD_W = 340

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/** Where a step's element is on screen, or undefined when it is missing or hidden. */
function measure(step: TourStep): Rect | undefined {
  if (!step.target) return undefined
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
  if (!el) return undefined
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return undefined
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function sameRect(a?: Rect, b?: Rect) {
  return a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)
}

/** Place the card beside the element (right of rail icons, below top bar items), kept on screen. */
function cardStyle(rect: Rect | undefined, step: TourStep, cardH: number): CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_W, vw - 32)
  if (!rect) return { width, left: (vw - width) / 2, top: Math.max(16, (vh - cardH) / 2) }
  const clampX = (x: number) => Math.min(Math.max(16, x), vw - width - 16)
  const clampY = (y: number) => Math.min(Math.max(16, y), vh - cardH - 16)
  if (step.side === 'bottom') return { width, left: clampX(rect.left + rect.width - width), top: clampY(rect.top + rect.height + GAP) }
  return { width, left: clampX(rect.left + rect.width + GAP), top: clampY(rect.top + rect.height / 2 - cardH / 2) }
}

/**
 * The new user tour: a dimmed screen with one part of the app frame lit up
 * and a card explaining it. Rendered once in the hub shell (App.tsx). Opens by
 * itself the first time a profile starts MonoRail; Esc or "Skip" closes it,
 * arrow keys step through it.
 */
export function TourHost() {
  const open = useTourOpen()

  // First start of this profile: open once the shell has painted. Not on a
  // phone-sized window, where the rail and top bar are cramped.
  useEffect(() => {
    if (!tourUnseen() || window.innerWidth < 768) return
    const t = window.setTimeout(startTour, 800)
    return () => window.clearTimeout(t)
  }, [])

  return open ? <Tour /> : null
}

function Tour() {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect>()
  const [cardH, setCardH] = useState(220)
  const cardRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1

  const next = useCallback(() => (last ? endTour() : setIndex((i) => i + 1)), [last])
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Follow the element while the window resizes or the layout shifts.
  useLayoutEffect(() => {
    let frame = 0
    let prevRect: Rect | undefined
    let prevH = -1
    const tick = () => {
      const r = measure(step)
      if (!sameRect(r, prevRect)) {
        prevRect = r
        setRect(r)
      }
      const h = cardRef.current?.offsetHeight ?? prevH
      if (h !== prevH) {
        prevH = h
        setCardH(h)
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [step])

  // Keep keyboard focus in the card, and give it back when the tour ends.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => before?.focus?.()
  }, [])
  useEffect(() => {
    primaryRef.current?.focus()
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        endTour()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Tab' && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>('button')]
        const at = items.indexOf(document.activeElement as HTMLElement)
        if (at === -1 || (e.shiftKey && at === 0) || (!e.shiftKey && at === items.length - 1)) {
          e.preventDefault()
          items[e.shiftKey ? items.length - 1 : 0]?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next, back])

  return (
    <div className="fixed inset-0 z-[100]" data-slot="tour">
      {/* Blocks clicks on the app while the tour is open; clicking it does nothing on purpose. */}
      <div className={cn('absolute inset-0', !rect && 'bg-black/55')} aria-hidden />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute flex flex-col gap-4 rounded-xl bg-popover p-5 text-popover-foreground shadow-elevation-3 ring-1 ring-foreground/10 transition-[top,left] duration-300 ease-out motion-reduce:transition-none"
        style={cardStyle(rect, step, cardH)}
      >
        <div className="flex items-start gap-3">
          {!step.target && <BrandTile className="size-9 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {index === 0 ? 'Welcome' : last ? 'Finished' : `Step ${index} of ${TOUR_STEPS.length - 2}`}
            </div>
            <h2 id="tour-title" className="mt-1 text-base font-semibold">
              {step.title}
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-8" onClick={endTour} aria-label="Close the tour">
            <X />
          </Button>
        </div>

        <p id="tour-body" className="text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="flex items-center gap-1.5" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30')} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {index === 0 ? (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={endTour}>
              Skip tour
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="mr-auto" onClick={back}>
              <ArrowLeft /> Back
            </Button>
          )}
          {last && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                endTour()
                openWiki('guide/first-ten-minutes')
              }}
            >
              <BookOpen /> First ten minutes
            </Button>
          )}
          <Button ref={primaryRef} size="sm" onClick={next}>
            {index === 0 ? 'Show me around' : last ? 'Done' : 'Next'} {!last && <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  )
}
