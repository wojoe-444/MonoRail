import type { ReactNode } from 'react'

interface PageBannerProps {
  /** Small line above the title, e.g. today's date. May start with an icon. */
  kicker?: ReactNode
  title: string
  description?: ReactNode
  /** Under the text: a large `SearchField`, a row of shortcut buttons. */
  children?: ReactNode
  /** Right-hand column on wide screens, e.g. a small "Today" card. */
  aside?: ReactNode
}

/**
 * Header style C: a tinted band with a large title, room for a big search
 * box and shortcuts, and an optional side card. The front door of the app or
 * of a section. Use it on one or two pages at most; it loses its point when
 * every page has one.
 */
export function PageBanner({ kicker, title, description, children, aside }: PageBannerProps) {
  return (
    <header className="relative isolate grid grid-cols-1 gap-6 overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-primary-soft to-primary-soft/40 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,var(--primary)_1px,transparent_1.5px)] bg-size-[18px_18px] opacity-15 [mask-image:linear-gradient(to_left,black,transparent_75%)]"
      />
      <div className="min-w-0">
        {kicker && (
          <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-primary-soft-foreground [&_svg]:size-4">{kicker}</div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">{description}</p>}
        {children && <div className="mt-6 flex max-w-xl flex-col gap-3">{children}</div>}
      </div>
      {aside && <div className="min-w-0 self-start">{aside}</div>}
    </header>
  )
}
