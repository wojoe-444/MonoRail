import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react'

import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'

/** One section of a page, shown as a tab. */
export interface PageTab {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
  /** Small count next to the label. */
  count?: number
}

interface PageTabsProps {
  tabs: PageTab[]
  active: string
  /** The route path of a tab, e.g. `/openmetadata/glossary`. Each tab is a real link. */
  pathFor: (id: string) => string
  'aria-label': string
  /** `sm` fits the 40px top bar (`PageCommandBar`). */
  size?: 'default' | 'sm'
  /** Leave out the icons (to fit more tabs in the top bar). */
  hideIcons?: boolean
  /** Stick under the top bar while the page scrolls (default). Pass `false` in the top bar. */
  sticky?: boolean
  className?: string
}

/**
 * Left-to-right sub-navigation inside a page (monorail-ui's PageTabs, chips
 * variant): tinted chips with an optional icon and count. Each tab is a link
 * to its own route, so tabs survive a reload and work with back / forward. On
 * narrow screens the row scrolls sideways.
 */
export function PageTabs({ tabs, active, pathFor, size = 'default', sticky = true, hideIcons = false, className, ...rest }: PageTabsProps) {
  const go = (e: MouseEvent, path: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(path)
  }
  const ref = useRef<HTMLElement>(null)
  // Which edges have tabs scrolled out of sight, so a fade can say there is more.
  const [more, setMore] = useState({ left: false, right: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setMore({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 })
    // A mouse wheel scrolls the row sideways.
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    el.addEventListener('wheel', wheel, { passive: false })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      el.removeEventListener('wheel', wheel)
      ro.disconnect()
    }
  }, [])
  // Keep the active tab in view.
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])
  const fade = more.left && more.right
    ? '[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]'
    : more.right
      ? '[mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]'
      : more.left
        ? '[mask-image:linear-gradient(to_right,transparent,black_2rem)]'
        : ''
  const row = (
    <nav ref={ref} aria-label={rest['aria-label']} className={cn('flex gap-1 overflow-x-auto [scrollbar-width:none]', fade)}>
      {tabs.map((tab) => {
        const current = tab.id === active
        const Icon = tab.icon
        const path = pathFor(tab.id)
        return (
          <a
            key={tab.id}
            href={`#${path}`}
            onClick={(e) => go(e, path)}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              size === 'sm' ? 'h-7 px-2.5' : 'h-9 px-3',
              current ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {Icon && !hideIcons && <Icon className="size-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', current ? 'bg-primary/15' : 'bg-muted text-muted-foreground')}>{tab.count}</span>
            )}
          </a>
        )
      })}
    </nav>
  )

  if (!sticky) return <div className={className}>{row}</div>
  // top-10 = TopBar height; the negative margins match the page padding in App.tsx.
  return <div className={cn('sticky top-10 z-[5] -mx-6 border-b bg-background/85 px-6 py-2 backdrop-blur lg:-mx-8 lg:px-8', className)}>{row}</div>
}
